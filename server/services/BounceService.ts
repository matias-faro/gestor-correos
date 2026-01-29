import { getGoogleAccountByUserId } from "@/server/integrations/db/google-accounts-repo";
import {
  hasBounceEventByMessageId,
  getBounceEventsByIds,
  deleteBounceEventsByIds,
  insertBounceEvent,
} from "@/server/integrations/db/bounce-events-repo";
import {
  deleteContactsByEmails,
  setContactsBouncedByEmails,
} from "@/server/integrations/db/contacts-repo";
import {
  listBounceMessageIds,
  listBounceMessageIdsInTrash,
  getMessageFull,
  getMessageMetadata,
  extractBouncedEmailAndReason,
  processBounceMessage,
  trashMessage,
} from "@/server/integrations/gmail/bounces";
import type {
  CleanupBouncesInput,
  CleanupBouncesResponse,
  ScanBouncesInput,
  ScanBouncesResponse,
  ScanTrashCleanupInput,
  ScanTrashCleanupResponse,
} from "@/server/contracts/bounces";

// ─────────────────────────────────────────────────────────────────────────────
// Escanear rebotes en Gmail y suprimir contactos
// ─────────────────────────────────────────────────────────────────────────────
export async function scanBounces(
  input: ScanBouncesInput,
  userId: string
): Promise<ScanBouncesResponse> {
  const googleAccount = await getGoogleAccountByUserId(userId);
  if (!googleAccount) {
    throw new Error(
      "No hay cuenta de Gmail conectada para este usuario. Iniciá sesión con Google (la cuenta que recibe los rebotes)."
    );
  }

  const result: ScanBouncesResponse = {
    scanned: 0,
    created: 0,
    suppressed: 0,
    trashed: 0,
    errors: [],
  };

  // Listar mensajes de rebote
  const messageIds = await listBounceMessageIds({
    googleAccountId: googleAccount.id,
    maxResults: input.maxResults,
    newerThanDays: input.newerThanDays,
  });

  result.scanned = messageIds.length;
  if (result.scanned === 0) {
    console.warn(
      "[BounceService] 0 resultados en Gmail. Tip: verificar rango (newerThanDays) y que el mailbox contenga DSN (excluimos Spam/Papelera por diseño)."
    );
  }

  // Procesar cada mensaje
  const emailsToSuppress: string[] = [];

  for (const messageId of messageIds) {
    try {
      // Verificar si ya procesamos este mensaje (idempotencia)
      const alreadyProcessed = await hasBounceEventByMessageId(messageId);
      if (alreadyProcessed) {
        continue;
      }

      // Procesar mensaje
      const bounceInfo = await processBounceMessage({
        googleAccountId: googleAccount.id,
        messageId,
      });

      // Solo insertar si pudimos extraer un email
      if (bounceInfo.bouncedEmail) {
        await insertBounceEvent({
          googleAccountId: googleAccount.id,
          bouncedEmail: bounceInfo.bouncedEmail,
          reason: bounceInfo.reason,
          gmailMessageId: messageId,
          gmailPermalink: bounceInfo.permalink,
        });

        result.created++;
        emailsToSuppress.push(bounceInfo.bouncedEmail);

        // Mover a papelera si está habilitado
        if (input.trashProcessed) {
          try {
            await trashMessage({
              googleAccountId: googleAccount.id,
              messageId,
            });
            result.trashed++;
          } catch (trashError) {
            // No fallar todo el proceso por no poder mover a papelera
            console.warn(
              `[BounceService] No se pudo mover mensaje ${messageId} a papelera:`,
              trashError instanceof Error ? trashError.message : trashError
            );
          }
        }
      } else {
        // No pudimos extraer email, igual insertamos sin suprimir (para registro)
        await insertBounceEvent({
          googleAccountId: googleAccount.id,
          bouncedEmail: `unknown-${messageId.slice(0, 8)}`,
          reason: bounceInfo.reason ?? "No se pudo extraer email del mensaje de rebote",
          gmailMessageId: messageId,
          gmailPermalink: bounceInfo.permalink,
        });

        result.created++;

        // Mover a papelera aunque no hayamos podido extraer email
        if (input.trashProcessed) {
          try {
            await trashMessage({
              googleAccountId: googleAccount.id,
              messageId,
            });
            result.trashed++;
          } catch {
            // Ignorar error de trash
          }
        }
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Error desconocido";
      result.errors.push({ messageId, error: errorMessage });
      console.error(
        `[BounceService] Error procesando mensaje ${messageId}:`,
        errorMessage
      );
    }
  }

  // Suprimir contactos en batch
  if (emailsToSuppress.length > 0) {
    try {
      result.suppressed = await setContactsBouncedByEmails(emailsToSuppress);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Error desconocido";
      console.error(
        `[BounceService] Error suprimiendo contactos:`,
        errorMessage
      );
      // Agregar como error general pero no fallar
      result.errors.push({ messageId: "batch-suppress", error: errorMessage });
    }
  }

  console.log(
    `[BounceService] Escaneo completado: ${result.scanned} escaneados, ${result.created} creados, ${result.suppressed} suprimidos, ${result.trashed} movidos a papelera`
  );

  return result;
}

function uniqNormalizedEmails(emails: string[]): string[] {
  const set = new Set<string>();
  for (const e of emails) {
    const normalized = e.toLowerCase().trim();
    if (normalized) set.add(normalized);
  }
  return Array.from(set);
}

function chunk<T>(items: T[], size: number): T[][] {
  if (size <= 0) return [items];
  const result: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    result.push(items.slice(i, i + size));
  }
  return result;
}

// ─────────────────────────────────────────────────────────────────────────────
// Escanear Papelera (Trash) y eliminar contactos por email rebotado (paginado)
// ─────────────────────────────────────────────────────────────────────────────
export async function scanTrashAndCleanupContacts(
  input: ScanTrashCleanupInput,
  userId: string
): Promise<ScanTrashCleanupResponse> {
  const googleAccount = await getGoogleAccountByUserId(userId);
  if (!googleAccount) {
    throw new Error(
      "No hay cuenta de Gmail conectada para este usuario. Iniciá sesión con Google (la cuenta que recibe los rebotes)."
    );
  }

  const result: ScanTrashCleanupResponse = {
    scanned: 0,
    extracted: 0,
    uniqueEmails: 0,
    deletedContacts: 0,
    nextPageToken: null,
    errors: [],
  };

  const { messageIds, nextPageToken } = await listBounceMessageIdsInTrash({
    googleAccountId: googleAccount.id,
    maxResults: input.maxResults,
    newerThanDays: input.newerThanDays,
    pageToken: input.pageToken,
  });

  result.scanned = messageIds.length;
  result.nextPageToken = nextPageToken;

  const extractedEmails: string[] = [];

  for (const messageId of messageIds) {
    try {
      // Primero intentamos metadata (más barato). Si no alcanza, caemos a full.
      const meta = await getMessageMetadata({
        googleAccountId: googleAccount.id,
        messageId,
      });

      let parsed = extractBouncedEmailAndReason(meta);

      if (!parsed.bouncedEmail) {
        const full = await getMessageFull({
          googleAccountId: googleAccount.id,
          messageId,
        });
        parsed = extractBouncedEmailAndReason(full);
      }

      if (parsed.bouncedEmail) {
        extractedEmails.push(parsed.bouncedEmail);
        result.extracted += 1;
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Error desconocido";
      result.errors.push({ messageId, error: errorMessage });
    }
  }

  const uniqueEmails = uniqNormalizedEmails(extractedEmails);
  result.uniqueEmails = uniqueEmails.length;

  if (input.deleteContacts && uniqueEmails.length > 0) {
    // En algunos entornos PostgREST puede sufrir con IN gigantes; lo hacemos en chunks.
    const chunks = chunk(uniqueEmails, 500);
    for (const emailsChunk of chunks) {
      result.deletedContacts += await deleteContactsByEmails(emailsChunk);
    }
  }

  return result;
}

// ─────────────────────────────────────────────────────────────────────────────
// Limpieza manual: eliminar contactos rebotados + mandar a papelera el mail DSN
// ─────────────────────────────────────────────────────────────────────────────
export async function cleanupBounces(
  input: CleanupBouncesInput,
  userId: string
): Promise<CleanupBouncesResponse> {
  const result: CleanupBouncesResponse = {
    selected: input.ids.length,
    deletedContacts: 0,
    trashed: 0,
    skippedUnknownEmails: 0,
    skippedMissingMessageId: 0,
    errors: [],
  };

  const bounceEvents = await getBounceEventsByIds(input.ids);

  // Eliminar contactos (si aplica)
  if (input.deleteContacts) {
    const emails = bounceEvents
      .map((b) => b.bouncedEmail)
      .filter((e) => !e.startsWith("unknown-"));

    result.skippedUnknownEmails = bounceEvents.length - emails.length;

    try {
      result.deletedContacts = await deleteContactsByEmails(emails);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Error desconocido";
      result.errors.push({ bounceEventId: "delete-contacts", error: msg });
    }
  }

  // Mandar mensajes a papelera (si aplica)
  if (input.trashGmailMessages) {
    const googleAccount = await getGoogleAccountByUserId(userId);
    if (!googleAccount) {
      throw new Error(
        "No hay cuenta de Gmail conectada para este usuario. Iniciá sesión con Google."
      );
    }

    for (const bounce of bounceEvents) {
      const messageId = bounce.gmailMessageId;
      if (!messageId) {
        result.skippedMissingMessageId++;
        continue;
      }

      try {
        await trashMessage({ googleAccountId: googleAccount.id, messageId });
        result.trashed++;
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Error desconocido";
        result.errors.push({ bounceEventId: bounce.id, error: msg });
      }
    }
  }

  // Eliminar registros de bounce_events para que no sigan apareciendo en la UI
  // (por defecto true).
  if (input.deleteBounceEvents) {
    try {
      await deleteBounceEventsByIds(input.ids);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Error desconocido";
      result.errors.push({ bounceEventId: "delete-bounce-events", error: msg });
    }
  }

  return result;
}
