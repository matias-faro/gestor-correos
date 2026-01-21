import { createServiceClient } from "@/lib/supabase/server";
import type { SyncContactsPayload } from "@/server/contracts/contact-sources";
import { scheduleContactSync } from "@/server/integrations/qstash/client";
import { getSheetHeader, getSheetRows } from "@/server/integrations/google/sheets";

type ContactSource = {
  id: string;
  spreadsheet_id: string;
  sheet_tab: string;
  google_account_id: string | null;
};

type SyncResult = {
  action: "completed" | "scheduled_next";
  processed: number;
  skipped: number;
  nextStartRow?: number;
};

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
  const { sourceId, startRow, batchSize, syncStartedAt } = payload;

  const { data: source, error: sourceError } = await supabase
    .from("contact_sources")
    .select("id, spreadsheet_id, sheet_tab, google_account_id")
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
          last_sync_status: "running",
          last_sync_error: null,
        })
        .eq("id", sourceId);
    }

    const headers = await getSheetHeader({
      googleAccountId: typedSource.google_account_id,
      spreadsheetId: typedSource.spreadsheet_id,
      sheetTab: typedSource.sheet_tab,
    });

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

    if (rows.length === 0) {
      await supabase
        .from("contact_sources")
        .update({
          last_synced_at: new Date().toISOString(),
          last_sync_status: "completed",
          last_sync_error: null,
        })
        .eq("id", sourceId);

      return { action: "completed", processed: 0, skipped: 0 };
    }

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

    const shouldContinue = rows.length === batchSize;
    if (shouldContinue) {
      const nextStartRow = startRow + batchSize;
      await scheduleContactSync({
        sourceId,
        startRow: nextStartRow,
        batchSize,
        syncStartedAt: syncStartIso,
        delaySeconds: 1,
      });

      return {
        action: "scheduled_next",
        processed,
        skipped,
        nextStartRow,
      };
    }

    await supabase
      .from("contact_source_memberships")
      .delete()
      .eq("source_id", sourceId)
      .lt("last_seen_at", syncStartIso);

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
