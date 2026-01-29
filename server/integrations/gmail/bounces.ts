import type { gmail_v1 } from "googleapis";
import { getGmailClient } from "./client";

// ─────────────────────────────────────────────────────────────────────────────
// Tipos
// ─────────────────────────────────────────────────────────────────────────────
export type ParsedBounce = {
  bouncedEmail: string | null;
  reason: string | null;
};

export type BounceMessage = {
  id: string;
  threadId: string | null;
  bouncedEmail: string | null;
  reason: string | null;
  permalink: string;
};

type BounceSignals = {
  hasDeliveryStatusMime: boolean;
  hasContentTypeDeliveryStatusHeader: boolean;
  hasXFailedRecipientsHeader: boolean;
  hasSubjectKeyword: boolean;
  hasSystemSender: boolean;
  hasSmtpStatusCode: boolean;
  hasRemoteServerPhrase: boolean;
};

// ─────────────────────────────────────────────────────────────────────────────
// Construir query de búsqueda para rebotes
// ─────────────────────────────────────────────────────────────────────────────
function buildBounceQuery(newerThanDays: number): string {
  // Alineado a la lógica solicitada:
  // from:mailer-daemon OR from:postmaster OR subject:"Delivery Status Notification"
  // + ampliar con remitente/subject típicos de rebote sin perder precisión.
  const timeCriteria = newerThanDays > 0 ? `newer_than:${newerThanDays}d` : "";
  const criteria = [
    "from:mailer-daemon@googlemail.com",
    "from:mailer-daemon",
    "from:postmaster",
    "from:\"Mail Delivery Subsystem\"",
    "subject:\"Delivery Status Notification\"",
    "subject:\"Undeliverable:\"",
    "subject:\"Message not delivered\"",
    "subject:\"Returned mail: see transcript for details\"",
  ].join(" OR ");

  // Importante: NO buscar en Spam ni Papelera.
  // Usamos `in:anywhere` para incluir archivados, pero excluimos explícitamente.
  return `in:anywhere -in:spam -in:trash ${timeCriteria} (${criteria})`.trim();
}

// ─────────────────────────────────────────────────────────────────────────────
// Listar IDs de mensajes de rebote
// ─────────────────────────────────────────────────────────────────────────────
export async function listBounceMessageIds(options: {
  googleAccountId: string;
  maxResults: number;
  newerThanDays: number;
  sortOldestFirst?: boolean;
}): Promise<string[]> {
  const gmail = await getGmailClient(options.googleAccountId);
  const query = buildBounceQuery(options.newerThanDays);

  console.log("[gmail/bounces] Buscando rebotes en Gmail", {
    googleAccountId: options.googleAccountId,
    newerThanDays: options.newerThanDays,
    maxResults: options.maxResults,
    query,
  });

  const messageIds: string[] = [];
  let pageToken: string | undefined;
  let pages = 0;

  do {
    const response = await gmail.users.messages.list({
      userId: "me",
      q: query,
      maxResults: Math.min(options.maxResults - messageIds.length, 100),
      pageToken,
    });

    pages++;
    if (pages === 1) {
      console.log("[gmail/bounces] Resultado búsqueda Gmail (página 1)", {
        resultSizeEstimate: response.data.resultSizeEstimate ?? null,
        returnedMessages: (response.data.messages ?? []).length,
        hasNextPageToken: Boolean(response.data.nextPageToken),
      });
    }

    const messages = response.data.messages ?? [];
    for (const msg of messages) {
      if (msg.id) {
        messageIds.push(msg.id);
      }
      if (messageIds.length >= options.maxResults) {
        break;
      }
    }

    pageToken = response.data.nextPageToken ?? undefined;
  } while (pageToken && messageIds.length < options.maxResults);

  if (messageIds.length === 0) {
    console.warn("[gmail/bounces] Búsqueda sin resultados", { query });
    return messageIds;
  }

  if (options.sortOldestFirst) {
    const withDates = await mapInBatches(messageIds, 20, async (id) => {
      try {
        const res = await gmail.users.messages.get({
          userId: "me",
          id,
          format: "metadata",
        });
        const ms = Number(res.data.internalDate ?? 0);
        return { id, internalDateMs: Number.isFinite(ms) ? ms : 0 };
      } catch {
        // Si falla, lo mandamos al final.
        return { id, internalDateMs: Number.MAX_SAFE_INTEGER };
      }
    });

    withDates.sort((a, b) => a.internalDateMs - b.internalDateMs);
    const sortedIds = withDates.map((x) => x.id);

    console.log("[gmail/bounces] IDs ordenados (más antiguos primero)", {
      count: sortedIds.length,
    });

    return sortedIds;
  }

  {
    console.log("[gmail/bounces] IDs recolectados", {
      count: messageIds.length,
      pages,
    });
  }

  return messageIds;
}

async function mapInBatches<T, R>(
  items: T[],
  batchSize: number,
  mapper: (item: T) => Promise<R>
): Promise<R[]> {
  const results: R[] = [];
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    const mapped = await Promise.all(batch.map(mapper));
    results.push(...mapped);
  }
  return results;
}

// ─────────────────────────────────────────────────────────────────────────────
// Obtener mensaje completo
// ─────────────────────────────────────────────────────────────────────────────
export async function getMessageFull(options: {
  googleAccountId: string;
  messageId: string;
}): Promise<gmail_v1.Schema$Message> {
  const gmail = await getGmailClient(options.googleAccountId);

  const response = await gmail.users.messages.get({
    userId: "me",
    id: options.messageId,
    format: "full",
  });

  return response.data;
}

// ─────────────────────────────────────────────────────────────────────────────
// Extraer email rebotado y razón del mensaje
// ─────────────────────────────────────────────────────────────────────────────
export function extractBouncedEmailAndReason(
  message: gmail_v1.Schema$Message
): ParsedBounce {
  let bouncedEmail: string | null = null;
  let reason: string | null = null;

  // Intentar extraer del payload
  const payload = message.payload;
  if (!payload) {
    return { bouncedEmail, reason };
  }

  const headers = payload.headers ?? [];
  const subject = getHeaderValue(headers, "Subject");
  const from = getHeaderValue(headers, "From");
  const xFailedRecipientsHeader = getHeaderValue(headers, "X-Failed-Recipients");
  const contentTypeHeader = getHeaderValue(headers, "Content-Type");

  // Obtener el texto del mensaje (body o parts)
  const bodyText = extractBodyText(payload);

  const signals: BounceSignals = {
    hasDeliveryStatusMime: payloadHasMimeType(payload, "message/delivery-status"),
    hasContentTypeDeliveryStatusHeader:
      /message\/delivery-status/i.test(contentTypeHeader) ||
      /Content-Type:\s*message\/delivery-status/i.test(bodyText),
    hasXFailedRecipientsHeader: /@/.test(xFailedRecipientsHeader),
    hasSubjectKeyword: subjectMatchesBounceKeywords(subject),
    hasSystemSender: fromMatchesSystemSenders(from),
    hasSmtpStatusCode: /\b(450|452|550|554)\b/.test(bodyText),
    hasRemoteServerPhrase: /The response from the remote server was:/i.test(bodyText),
  };

  // Si no hay señales claras, no “inventar” emails por heurísticas débiles.
  const isBounceCandidate =
    signals.hasSystemSender ||
    signals.hasSubjectKeyword ||
    signals.hasDeliveryStatusMime ||
    signals.hasContentTypeDeliveryStatusHeader ||
    signals.hasXFailedRecipientsHeader ||
    signals.hasSmtpStatusCode ||
    signals.hasRemoteServerPhrase;

  if (!isBounceCandidate) {
    return { bouncedEmail, reason };
  }

  // Intentar extraer email de distintas fuentes
  bouncedEmail =
    extractEmailFromXFailedRecipientsHeader(xFailedRecipientsHeader) ??
    extractEmailFromBody(bodyText);

  // Intentar extraer razón
  reason = extractReasonFromBody(bodyText, message.snippet ?? null);

  return { bouncedEmail, reason };
}

// ─────────────────────────────────────────────────────────────────────────────
// Extraer texto del body del mensaje
// ─────────────────────────────────────────────────────────────────────────────
function extractBodyText(payload: gmail_v1.Schema$MessagePart): string {
  let text = "";

  // Decodificar body si existe
  if (payload.body?.data) {
    text += decodeBase64Url(payload.body.data);
  }

  // Buscar en parts recursivamente
  if (payload.parts) {
    for (const part of payload.parts) {
      // Priorizar text/plain, text/html y message/delivery-status
      if (
        part.mimeType === "text/plain" ||
        part.mimeType === "text/html" ||
        part.mimeType === "message/delivery-status"
      ) {
        if (part.body?.data) {
          const decoded = decodeBase64Url(part.body.data);
          text += "\n" + decoded;
          if (part.mimeType === "text/html") {
            text += "\n" + stripHtml(decoded);
          }
        }
      }
      // Recursivo para multipart
      if (part.parts) {
        text += "\n" + extractBodyText(part);
      }
    }
  }

  return text;
}

// ─────────────────────────────────────────────────────────────────────────────
// Decodificar base64url
// ─────────────────────────────────────────────────────────────────────────────
function decodeBase64Url(data: string): string {
  try {
    const base64 = data.replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), "=");
    return Buffer.from(padded, "base64").toString("utf-8");
  } catch {
    return "";
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Extraer email del body usando heurísticas
// ─────────────────────────────────────────────────────────────────────────────
function extractEmailFromBody(bodyText: string): string | null {
  // Priorizar patrones “determinísticos” del reporte DSN / Delivery Status
  const patterns = [
    // X-Failed-Recipients: email@example.com
    /X-Failed-Recipients:\s*([^\s<>]+@[^\s<>]+)/i,
    // Final-Recipient: rfc822; email@example.com
    /Final-Recipient:\s*(?:rfc822|RFC822);\s*([^\s<>]+@[^\s<>]+)/i,
    // Original-Recipient: rfc822; email@example.com
    /Original-Recipient:\s*(?:rfc822|RFC822);\s*([^\s<>]+@[^\s<>]+)/i,
    // To: email@example.com (en contexto de rebote)
    /(?:^|\n)To:\s*<?([^\s<>]+@[^\s<>]+)>?/im,
    // The following address(es) failed: email@example.com
    /address(?:es)?\s+failed[^:]*:\s*<?([^\s<>]+@[^\s<>]+)>?/i,
    // Delivery to the following recipient failed: email@example.com
    /recipient\s+failed[^:]*:\s*<?([^\s<>]+@[^\s<>]+)>?/i,
    // <email@example.com>: ... (formato común en postfix)
    /<([^\s<>]+@[^\s<>]+)>:\s/,
  ];

  for (const pattern of patterns) {
    const match = bodyText.match(pattern);
    if (match?.[1]) {
      const email = match[1].toLowerCase().trim();
      // Filtrar emails de sistema
      if (!isSystemEmail(email)) {
        return email;
      }
    }
  }

  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Verificar si es un email de sistema (no queremos suprimir estos)
// ─────────────────────────────────────────────────────────────────────────────
function isSystemEmail(email: string): boolean {
  const systemPatterns = [
    /^mailer-daemon@/i,
    /^postmaster@/i,
    /^noreply@/i,
    /^no-reply@/i,
    /^mail-daemon@/i,
    /^mailerdaemon@/i,
  ];

  return systemPatterns.some((pattern) => pattern.test(email));
}

// ─────────────────────────────────────────────────────────────────────────────
// Extraer razón del rebote
// ─────────────────────────────────────────────────────────────────────────────
function extractReasonFromBody(
  bodyText: string,
  snippet: string | null
): string | null {
  // Patrones para extraer códigos/razones de error
  const patterns = [
    // The response from the remote server was: 550 5.1.1 ...
    /The response from the remote server was:\s*([^\r\n]+)/i,
    // Línea con código SMTP de interés (550/554/450/452)
    /(^|\n)\s*((?:450|452|550|554)[^\r\n]*)/i,
    // Status: 5.1.1 (User unknown)
    /Status:\s*(\d+\.\d+\.\d+[^\r\n]*)/i,
    // Diagnostic-Code: smtp; 550 User not found
    /Diagnostic-Code:\s*[^;]*;\s*([^\r\n]+)/i,
    // Action: failed
    /Action:\s*(failed[^\r\n]*)/i,
    // Remote-MTA: ... / said: 550 ...
    /said:\s*(\d{3}[^\r\n]*)/i,
    // SMTP error from remote mail server after ...
    /SMTP\s+error[^:]*:\s*([^\r\n]+)/i,
    // The email account that you tried to reach does not exist
    /(The email account[^\r\n.]+)/i,
    // User unknown / mailbox not found
    /((?:user|mailbox|recipient)\s+(?:unknown|not\s+found|does\s+not\s+exist)[^\r\n]*)/i,
    // 550 5.1.1 ...
    /\b(5\d{2}\s+\d+\.\d+\.\d+[^\r\n]*)/i,
  ];

  for (const pattern of patterns) {
    const match = bodyText.match(pattern);
    const candidate = (match?.[1] ?? match?.[2])?.trim();
    if (candidate) {
      const reason = candidate;
      if (reason.length > 10 && reason.length < 500) {
        return reason;
      }
    }
  }

  // Fallback: usar snippet si está disponible
  if (snippet && snippet.length > 10) {
    return snippet.slice(0, 200);
  }

  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers de headers / detección
// ─────────────────────────────────────────────────────────────────────────────
function getHeaderValue(
  headers: gmail_v1.Schema$MessagePartHeader[],
  name: string
): string {
  const found = headers.find((h) => (h.name ?? "").toLowerCase() === name.toLowerCase());
  return found?.value ?? "";
}

function subjectMatchesBounceKeywords(subject: string): boolean {
  const s = subject.trim().toLowerCase();
  if (!s) return false;
  const keywords = [
    "delivery status notification (failure)",
    "delivery status notification",
    "undeliverable:",
    "message not delivered",
    "returned mail: see transcript for details",
  ];
  return keywords.some((k) => s.includes(k));
}

function extractEmailFromXFailedRecipientsHeader(value: string): string | null {
  const match = value.match(/([^\s<>]+@[^\s<>]+)/i);
  if (!match?.[1]) return null;
  const email = match[1].toLowerCase().trim();
  return isSystemEmail(email) ? null : email;
}

function fromMatchesSystemSenders(fromHeader: string): boolean {
  const value = fromHeader.trim();
  if (!value) return false;

  // Puede venir como "Name <email@domain>" o solo el email.
  const addrMatch = value.match(/<([^>]+)>/);
  const addr = (addrMatch?.[1] ?? value).trim();

  if (/^mailer-daemon@googlemail\.com$/i.test(addr)) return true;
  if (/^postmaster@/i.test(addr)) return true;
  if (/mailer-daemon/i.test(value)) return true;
  if (/mail delivery subsystem/i.test(value)) return true;

  return false;
}

function payloadHasMimeType(payload: gmail_v1.Schema$MessagePart, mime: string): boolean {
  if ((payload.mimeType ?? "").toLowerCase() === mime.toLowerCase()) return true;
  for (const part of payload.parts ?? []) {
    if (payloadHasMimeType(part, mime)) return true;
  }
  return false;
}

function stripHtml(html: string): string {
  return html
    .replace(/<style[\s\S]*?>[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// ─────────────────────────────────────────────────────────────────────────────
// Mover mensaje a papelera
// ─────────────────────────────────────────────────────────────────────────────
export async function trashMessage(options: {
  googleAccountId: string;
  messageId: string;
}): Promise<void> {
  const gmail = await getGmailClient(options.googleAccountId);

  await gmail.users.messages.trash({
    userId: "me",
    id: options.messageId,
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Procesar un mensaje de rebote completo
// ─────────────────────────────────────────────────────────────────────────────
export async function processBounceMessage(options: {
  googleAccountId: string;
  messageId: string;
}): Promise<BounceMessage> {
  const message = await getMessageFull({
    googleAccountId: options.googleAccountId,
    messageId: options.messageId,
  });

  const parsed = extractBouncedEmailAndReason(message);

  return {
    id: options.messageId,
    threadId: message.threadId ?? null,
    bouncedEmail: parsed.bouncedEmail,
    reason: parsed.reason,
    permalink: `https://mail.google.com/mail/u/0/#inbox/${options.messageId}`,
  };
}
