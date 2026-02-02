import { createServiceClient } from "@/lib/supabase/server";
import type { SyncContactsPayload } from "@/server/contracts/contact-sources";
import { scheduleContactSync } from "@/server/integrations/qstash/client";
import { getSheetHeader, getSheetRows } from "@/server/integrations/google/sheets";

type ContactSource = {
  id: string;
  spreadsheet_id: string;
  sheet_tab: string;
  google_account_id: string | null;
  last_sync_processed: number | null;
  last_sync_skipped: number | null;
  last_sync_last_row: number | null;
  last_sync_removed_memberships: number | null;
  last_sync_deleted_contacts: number | null;
};

type SyncResult = {
  action: "completed" | "scheduled_next";
  processed: number;
  skipped: number;
  nextStartRow?: number;
};

function getEnvInt(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

const CONTACT_SYNC_BATCH_DELAY_SECONDS = getEnvInt(
  "CONTACT_SYNC_BATCH_DELAY_SECONDS",
  2
);

const CONTACT_SYNC_RATE_LIMIT_BASE_DELAY_SECONDS = getEnvInt(
  "CONTACT_SYNC_RATE_LIMIT_BASE_DELAY_SECONDS",
  60
);

const CONTACT_SYNC_RATE_LIMIT_MAX_DELAY_SECONDS = getEnvInt(
  "CONTACT_SYNC_RATE_LIMIT_MAX_DELAY_SECONDS",
  15 * 60
);

function isSheetsRateLimitMessage(message: string): boolean {
  const m = message.toLowerCase();

  return (
    m.includes("quota exceeded") ||
    m.includes("read requests per minute") ||
    m.includes("user-rate limit") ||
    m.includes("userratelimitexceeded") ||
    m.includes("ratelimitexceeded") ||
    m.includes("rate limit")
  );
}

function computeRateLimitDelaySeconds(attempt: number): number {
  const safeAttempt = Math.max(0, Math.min(20, attempt));
  const multiplier = Math.min(8, 2 ** safeAttempt);
  return Math.min(
    CONTACT_SYNC_RATE_LIMIT_MAX_DELAY_SECONDS,
    CONTACT_SYNC_RATE_LIMIT_BASE_DELAY_SECONDS * multiplier
  );
}

const KNOWN_HEADERS = new Set([
  "email 1",
  "email 2",
  "email",
  "nombre",
  "apellido",
  "empresa",
  "posicion",
]);

const IGNORED_HEADERS = new Set([
  "estado",
  "estado rebote",
  "copia estado rebote",
  "desde",
]);

function normalizeHeader(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/\s+/g, " ");
}

function getCell(row: string[], index: number | null): string {
  if (index === null || index < 0 || index >= row.length) return "";
  return String(row[index] ?? "").trim();
}

function chunkArray<T>(items: T[], size: number): T[][] {
  if (size <= 0) return [items];
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

function pickHeaderIndex(headers: string[], candidates: string[]): number | null {
  const normalized = headers.map(normalizeHeader);
  for (const candidate of candidates) {
    const idx = normalized.indexOf(candidate);
    if (idx >= 0) return idx;
  }
  return null;
}

export async function processContactSync(
  payload: SyncContactsPayload
): Promise<SyncResult> {
  const supabase = await createServiceClient();
  let resetRemoved = 0;
  let resetDeleted = 0;
  const {
    sourceId,
    startRow,
    batchSize,
    syncStartedAt,
    headers: payloadHeaders,
    attempt: payloadAttempt,
  } = payload;
  const attempt = payloadAttempt ?? 0;
  let headers: string[] | undefined = payloadHeaders;

  const { data: source, error: sourceError } = await supabase
    .from("contact_sources")
    .select(
      "id, spreadsheet_id, sheet_tab, google_account_id, last_sync_processed, last_sync_skipped, last_sync_last_row, last_sync_removed_memberships, last_sync_deleted_contacts"
    )
    .eq("id", sourceId)
    .single();

  if (sourceError || !source) {
    throw new Error(
      `Fuente no encontrada o inválida: ${sourceError?.message ?? sourceId}`
    );
  }

  const typedSource = source as ContactSource;
  if (!typedSource.google_account_id) {
    throw new Error("La fuente no tiene una cuenta de Google asociada");
  }

  const syncStartIso = syncStartedAt;

  try {
    if (startRow === 2) {
      await supabase
        .from("contact_sources")
        .update({
          last_sync_started_at: syncStartIso,
          last_sync_status: "running",
          last_sync_error: null,
          last_sync_processed: 0,
          last_sync_skipped: 0,
          last_sync_last_row: null,
          last_sync_removed_memberships: 0,
          last_sync_deleted_contacts: 0,
        })
        .eq("id", sourceId);

      const { data: existingMemberships, error: existingMembershipsError } =
        await supabase
          .from("contact_source_memberships")
          .select("contact_id")
          .eq("source_id", sourceId);

      if (existingMembershipsError) {
        throw new Error(
          `Error al cargar contactos existentes: ${existingMembershipsError.message}`
        );
      }

      const existingContactIds = Array.from(
        new Set((existingMemberships ?? []).map((row) => row.contact_id as string))
      );

      if (existingContactIds.length > 0) {
        const { error: deleteMembershipsError } = await supabase
          .from("contact_source_memberships")
          .delete()
          .eq("source_id", sourceId);

        if (deleteMembershipsError) {
          throw new Error(
            `Error al resetear memberships: ${deleteMembershipsError.message}`
          );
        }

        resetRemoved = existingContactIds.length;

        const referencedIds = new Set<string>();
        for (const batch of chunkArray(existingContactIds, 500)) {
          const { data: referenced, error: referencedError } = await supabase
            .from("contact_source_memberships")
            .select("contact_id")
            .in("contact_id", batch)
            .neq("source_id", sourceId);

          if (referencedError) {
            throw new Error(
              `Error al validar referencias de contactos: ${referencedError.message}`
            );
          }

          (referenced ?? []).forEach((row) => {
            referencedIds.add(row.contact_id as string);
          });
        }

        const orphanContactIds = existingContactIds.filter(
          (id) => !referencedIds.has(id)
        );

        for (const batch of chunkArray(orphanContactIds, 500)) {
          const { error: deleteError } = await supabase
            .from("contacts")
            .delete()
            .in("id", batch);

          if (deleteError) {
            throw new Error(
              `Error al eliminar contactos reseteados: ${deleteError.message}`
            );
          }
        }

        resetDeleted = orphanContactIds.length;
      }

      await supabase
        .from("contact_sources")
        .update({
          last_sync_removed_memberships: resetRemoved,
          last_sync_deleted_contacts: resetDeleted,
        })
        .eq("id", sourceId);
    }

    if (!headers) {
      headers = await getSheetHeader({
        googleAccountId: typedSource.google_account_id,
        spreadsheetId: typedSource.spreadsheet_id,
        sheetTab: typedSource.sheet_tab,
      });
    }

    if (headers.length === 0) {
      throw new Error("La hoja no tiene headers en la fila 1");
    }

    const email1Index = pickHeaderIndex(headers, ["email 1", "email"]);
    const email2Index = pickHeaderIndex(headers, ["email 2"]);
    const firstNameIndex = pickHeaderIndex(headers, ["nombre"]);
    const lastNameIndex = pickHeaderIndex(headers, ["apellido"]);
    const companyIndex = pickHeaderIndex(headers, ["empresa"]);
    const positionIndex = pickHeaderIndex(headers, ["posicion"]);

    const rows = await getSheetRows({
      googleAccountId: typedSource.google_account_id,
      spreadsheetId: typedSource.spreadsheet_id,
      sheetTab: typedSource.sheet_tab,
      startRow,
      endRow: startRow + batchSize - 1,
    });

    let processed = 0;
    let skipped = 0;
    const contactsToUpsert: Array<{
      email: string;
      first_name: string | null;
      last_name: string | null;
      company: string | null;
      position: string | null;
      extra: Record<string, string> | null;
    }> = [];

    for (const row of rows) {
      const email =
        getCell(row, email1Index).toLowerCase() ||
        getCell(row, email2Index).toLowerCase();

      if (!email) {
        skipped += 1;
        continue;
      }

      const extra: Record<string, string> = {};

      headers.forEach((header, idx) => {
        const normalized = normalizeHeader(header);
        if (KNOWN_HEADERS.has(normalized)) return;
        if (IGNORED_HEADERS.has(normalized)) return;
        if (normalized.endsWith("ia")) return;
        const value = getCell(row, idx);
        if (!value) return;
        extra[header] = value;
      });

      contactsToUpsert.push({
        email,
        first_name: getCell(row, firstNameIndex) || null,
        last_name: getCell(row, lastNameIndex) || null,
        company: getCell(row, companyIndex) || null,
        position: getCell(row, positionIndex) || null,
        extra: Object.keys(extra).length > 0 ? extra : null,
      });
    }

    if (contactsToUpsert.length > 0) {
      const { data: upserted, error: upsertError } = await supabase
        .from("contacts")
        .upsert(contactsToUpsert, { onConflict: "email" })
        .select("id, email");

      if (upsertError) {
        throw new Error(`Error al upsert contactos: ${upsertError.message}`);
      }

      const memberships = (upserted ?? []).map((row) => ({
        source_id: sourceId,
        contact_id: row.id as string,
        last_seen_at: syncStartIso,
      }));

      if (memberships.length > 0) {
        const { error: membershipError } = await supabase
          .from("contact_source_memberships")
          .upsert(memberships, { onConflict: "source_id,contact_id" });

        if (membershipError) {
          throw new Error(
            `Error al upsert memberships: ${membershipError.message}`
          );
        }
      }

      processed = contactsToUpsert.length;
    }

    const baseProcessed = startRow === 2 ? 0 : typedSource.last_sync_processed ?? 0;
    const baseSkipped = startRow === 2 ? 0 : typedSource.last_sync_skipped ?? 0;
    const processedSoFar = baseProcessed + processed;
    const skippedSoFar = baseSkipped + skipped;
    const lastRow =
      rows.length > 0
        ? startRow + rows.length - 1
        : startRow === 2
          ? null
          : typedSource.last_sync_last_row ?? null;

    await supabase
      .from("contact_sources")
      .update({
        last_sync_processed: processedSoFar,
        last_sync_skipped: skippedSoFar,
        last_sync_last_row: lastRow,
      })
      .eq("id", sourceId);

    const shouldContinue = rows.length === batchSize;
    if (shouldContinue) {
      const nextStartRow = startRow + batchSize;
      await scheduleContactSync({
        sourceId,
        startRow: nextStartRow,
        batchSize,
        syncStartedAt: syncStartIso,
        headers,
        attempt: 0,
        delaySeconds: CONTACT_SYNC_BATCH_DELAY_SECONDS,
      });

      return {
        action: "scheduled_next",
        processed,
        skipped,
        nextStartRow,
      };
    }

    const { data: staleMemberships, error: staleMembershipsError } =
      await supabase
        .from("contact_source_memberships")
        .select("contact_id")
        .eq("source_id", sourceId)
        .lt("last_seen_at", syncStartIso);

    if (staleMembershipsError) {
      throw new Error(
        `Error al detectar contactos obsoletos: ${staleMembershipsError.message}`
      );
    }

    const staleContactIds = Array.from(
      new Set((staleMemberships ?? []).map((row) => row.contact_id as string))
    );

    await supabase
      .from("contact_source_memberships")
      .delete()
      .eq("source_id", sourceId)
      .lt("last_seen_at", syncStartIso);

    const baseRemoved =
      startRow === 2
        ? resetRemoved
        : typedSource.last_sync_removed_memberships ?? 0;
    const baseDeleted =
      startRow === 2 ? resetDeleted : typedSource.last_sync_deleted_contacts ?? 0;
    let staleRemoved = 0;
    let staleDeleted = 0;

    if (staleContactIds.length > 0) {
      const referencedIds = new Set<string>();

      for (const batch of chunkArray(staleContactIds, 500)) {
        const { data: referenced, error: referencedError } = await supabase
          .from("contact_source_memberships")
          .select("contact_id")
          .in("contact_id", batch);

        if (referencedError) {
          throw new Error(
            `Error al validar referencias de contactos: ${referencedError.message}`
          );
        }

        (referenced ?? []).forEach((row) => {
          referencedIds.add(row.contact_id as string);
        });
      }

      const orphanContactIds = staleContactIds.filter(
        (id) => !referencedIds.has(id)
      );

      for (const batch of chunkArray(orphanContactIds, 500)) {
        const { error: deleteError } = await supabase
          .from("contacts")
          .delete()
          .in("id", batch);

        if (deleteError) {
          throw new Error(
            `Error al eliminar contactos obsoletos: ${deleteError.message}`
          );
        }
      }

      staleRemoved = staleContactIds.length;
      staleDeleted = orphanContactIds.length;
    }

    await supabase
      .from("contact_sources")
      .update({
        last_sync_removed_memberships: baseRemoved + staleRemoved,
        last_sync_deleted_contacts: baseDeleted + staleDeleted,
      })
      .eq("id", sourceId);

    await supabase
      .from("contact_sources")
      .update({
        last_synced_at: new Date().toISOString(),
        last_sync_status: "completed",
        last_sync_error: null,
      })
      .eq("id", sourceId);

    return { action: "completed", processed, skipped };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error desconocido";

    // Si Google Sheets aplica rate-limit, reprogramamos el MISMO batch con backoff
    // para poder continuar sin que el sync quede "clavado" en el mismo punto.
    if (isSheetsRateLimitMessage(message)) {
      const delaySeconds = computeRateLimitDelaySeconds(attempt);

      await scheduleContactSync({
        sourceId,
        startRow,
        batchSize,
        syncStartedAt: syncStartIso,
        headers,
        attempt: attempt + 1,
        delaySeconds,
      });

      await supabase
        .from("contact_sources")
        .update({
          last_sync_status: "running",
          last_sync_error: `Rate limit de Google Sheets. Reintentando en ~${delaySeconds}s. ${message}`,
        })
        .eq("id", sourceId);

      return {
        action: "scheduled_next",
        processed: 0,
        skipped: 0,
        nextStartRow: startRow,
      };
    }

    await supabase
      .from("contact_sources")
      .update({
        last_sync_status: "failed",
        last_sync_error: message,
      })
      .eq("id", sourceId);

    throw err;
  }
}
