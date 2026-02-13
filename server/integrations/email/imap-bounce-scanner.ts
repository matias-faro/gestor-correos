import { ImapFlow } from "imapflow";
import type {
  BounceScanner,
  BounceMessage,
  VerifyConnectionResult,
} from "./types";

// ─────────────────────────────────────────────────────────────────────────────
// ImapBounceScanner — Implementación de BounceScanner usando IMAP
// Funciona con cualquier proveedor: Hostinger, Office 365, etc.
// ─────────────────────────────────────────────────────────────────────────────

export type ImapConfig = {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  password: string;
};

// Patrones para detectar emails del sistema (no son contactos reales)
const SYSTEM_EMAIL_PATTERNS = [
  /^mailer-daemon@/i,
  /^postmaster@/i,
  /^noreply@/i,
  /^no-reply@/i,
  /^mail-daemon@/i,
  /^mailerdaemon@/i,
];

function isSystemEmail(email: string): boolean {
  return SYSTEM_EMAIL_PATTERNS.some((pattern) => pattern.test(email));
}

// Patrones para extraer email rebotado del body
const BOUNCE_EMAIL_PATTERNS = [
  /X-Failed-Recipients:\s*([^\s<>]+@[^\s<>]+)/i,
  /Final-Recipient:\s*(?:rfc822|RFC822);\s*([^\s<>]+@[^\s<>]+)/i,
  /Original-Recipient:\s*(?:rfc822|RFC822);\s*([^\s<>]+@[^\s<>]+)/i,
  /(?:^|\n)To:\s*<?([^\s<>]+@[^\s<>]+)>?/im,
  /address(?:es)?\s+failed[^:]*:\s*<?([^\s<>]+@[^\s<>]+)>?/i,
  /recipient\s+failed[^:]*:\s*<?([^\s<>]+@[^\s<>]+)>?/i,
  /<([^\s<>]+@[^\s<>]+)>:\s/,
];

// Patrones para extraer razón del rebote
const BOUNCE_REASON_PATTERNS = [
  /The response from the remote server was:\s*([^\r\n]+)/i,
  /(^|\n)\s*((?:450|452|550|554)[^\r\n]*)/i,
  /Status:\s*(\d+\.\d+\.\d+[^\r\n]*)/i,
  /Diagnostic-Code:\s*[^;]*;\s*([^\r\n]+)/i,
  /Action:\s*(failed[^\r\n]*)/i,
  /said:\s*(\d{3}[^\r\n]*)/i,
  /SMTP\s+error[^:]*:\s*([^\r\n]+)/i,
  /(The email account[^\r\n.]+)/i,
  /((?:user|mailbox|recipient)\s+(?:unknown|not\s+found|does\s+not\s+exist)[^\r\n]*)/i,
  /\b(5\d{2}\s+\d+\.\d+\.\d+[^\r\n]*)/i,
];

function extractBouncedEmailFromText(text: string): string | null {
  for (const pattern of BOUNCE_EMAIL_PATTERNS) {
    const match = text.match(pattern);
    if (match?.[1]) {
      const email = match[1].toLowerCase().trim();
      if (!isSystemEmail(email)) {
        return email;
      }
    }
  }
  return null;
}

function extractBounceReasonFromText(text: string): string | null {
  for (const pattern of BOUNCE_REASON_PATTERNS) {
    const match = text.match(pattern);
    const candidate = (match?.[1] ?? match?.[2])?.trim();
    if (candidate && candidate.length > 10 && candidate.length < 500) {
      return candidate;
    }
  }
  return null;
}

function isBounceSubject(subject: string): boolean {
  const s = subject.trim().toLowerCase();
  if (!s) return false;
  const keywords = [
    "delivery status notification",
    "undeliverable:",
    "undeliverable",
    "message not delivered",
    "returned mail",
    "mail delivery failed",
    "failure notice",
    "delivery failure",
  ];
  return keywords.some((k) => s.includes(k));
}

function isBounceFrom(from: string): boolean {
  const value = from.trim().toLowerCase();
  if (!value) return false;
  return (
    value.includes("mailer-daemon") ||
    value.includes("postmaster") ||
    value.includes("mail delivery")
  );
}

export class ImapBounceScanner implements BounceScanner {
  constructor(private readonly config: ImapConfig) {}

  private createClient(): ImapFlow {
    return new ImapFlow({
      host: this.config.host,
      port: this.config.port,
      secure: this.config.secure,
      auth: {
        user: this.config.user,
        pass: this.config.password,
      },
      logger: false,
    });
  }

  async listBounceMessageIds(options: {
    maxResults: number;
    newerThanDays: number;
  }): Promise<string[]> {
    const client = this.createClient();
    const messageIds: string[] = [];

    try {
      await client.connect();
      const lock = await client.getMailboxLock("INBOX");

      try {
        // Construir criterio de búsqueda
        const searchCriteria: Record<string, unknown> = {};

        if (options.newerThanDays > 0) {
          const since = new Date();
          since.setDate(since.getDate() - options.newerThanDays);
          searchCriteria.since = since;
        }

        // Buscar mensajes de mailer-daemon y postmaster
        const fromSearches = ["mailer-daemon", "postmaster"];
        const seenUids = new Set<string>();

        for (const fromTerm of fromSearches) {
          const searchResult = await client.search({
            ...searchCriteria,
            from: fromTerm,
          });

          if (searchResult && Array.isArray(searchResult)) {
            for (const uid of searchResult) {
              const uidStr = String(uid);
              if (!seenUids.has(uidStr)) {
                seenUids.add(uidStr);
                messageIds.push(uidStr);
              }
              if (messageIds.length >= options.maxResults) break;
            }
          }

          if (messageIds.length >= options.maxResults) break;
        }

        // También buscar por subject si no tenemos suficientes
        if (messageIds.length < options.maxResults) {
          const subjectSearches = [
            "Delivery Status Notification",
            "Undeliverable",
            "Mail Delivery Failed",
          ];

          for (const subjectTerm of subjectSearches) {
            const searchResult = await client.search({
              ...searchCriteria,
              subject: subjectTerm,
            });

            if (searchResult && Array.isArray(searchResult)) {
              for (const uid of searchResult) {
                const uidStr = String(uid);
                if (!seenUids.has(uidStr)) {
                  seenUids.add(uidStr);
                  messageIds.push(uidStr);
                }
                if (messageIds.length >= options.maxResults) break;
              }
            }

            if (messageIds.length >= options.maxResults) break;
          }
        }
      } finally {
        lock.release();
      }
    } finally {
      await client.logout();
    }

    return messageIds.slice(0, options.maxResults);
  }

  async listBounceMessageIdsInTrash(options: {
    maxResults: number;
    newerThanDays: number;
    pageToken?: string;
  }): Promise<{ messageIds: string[]; nextPageToken: string | null }> {
    const client = this.createClient();
    const messageIds: string[] = [];

    try {
      await client.connect();

      // Intentar abrir Trash (diferentes proveedores usan distintos nombres)
      const trashFolders = ["Trash", "[Gmail]/Trash", "Deleted", "Deleted Items", "Papelera"];
      let trashFolder: string | null = null;

      const mailboxes = await client.list();
      for (const mailbox of mailboxes) {
        const name = mailbox.path;
        if (trashFolders.some((tf) => name.toLowerCase() === tf.toLowerCase())) {
          trashFolder = name;
          break;
        }
        // Algunas implementaciones usan el flag \Trash
        if (mailbox.specialUse === "\\Trash") {
          trashFolder = name;
          break;
        }
      }

      if (!trashFolder) {
        return { messageIds: [], nextPageToken: null };
      }

      const lock = await client.getMailboxLock(trashFolder);

      try {
        const searchCriteria: Record<string, unknown> = {};

        if (options.newerThanDays > 0) {
          const since = new Date();
          since.setDate(since.getDate() - options.newerThanDays);
          searchCriteria.since = since;
        }

        const fromSearches = ["mailer-daemon", "postmaster"];
        const seenUids = new Set<string>();

        for (const fromTerm of fromSearches) {
          const searchResult = await client.search({
            ...searchCriteria,
            from: fromTerm,
          });

          if (searchResult && Array.isArray(searchResult)) {
            for (const uid of searchResult) {
              const uidStr = String(uid);
              if (!seenUids.has(uidStr)) {
                seenUids.add(uidStr);
                messageIds.push(uidStr);
              }
              if (messageIds.length >= options.maxResults) break;
            }
          }

          if (messageIds.length >= options.maxResults) break;
        }
      } finally {
        lock.release();
      }
    } finally {
      await client.logout();
    }

    // IMAP no tiene paginación por token — retornamos null
    return {
      messageIds: messageIds.slice(0, options.maxResults),
      nextPageToken: null,
    };
  }

  async processBounceMessage(messageId: string): Promise<BounceMessage> {
    const client = this.createClient();

    try {
      await client.connect();
      const lock = await client.getMailboxLock("INBOX");

      try {
        const message = await client.fetchOne(messageId, {
          source: true,
          envelope: true,
        }, { uid: true });

        if (!message) {
          return {
            id: messageId,
            threadId: null,
            bouncedEmail: null,
            reason: null,
            permalink: null,
          };
        }

        const msgObj = message as { source?: Buffer; envelope?: { subject?: string; from?: Array<{ address?: string }> } };
        const rawSource = msgObj.source?.toString("utf-8") ?? "";
        const subject = msgObj.envelope?.subject ?? "";
        const from = msgObj.envelope?.from?.[0]?.address ?? "";

        // Extraer email rebotado y razón del raw source
        const bouncedEmail = extractBouncedEmailFromText(rawSource);
        const reason = extractBounceReasonFromText(rawSource);

        // Verificar que es realmente un bounce
        const isBounce =
          isBounceSubject(subject) ||
          isBounceFrom(from) ||
          rawSource.toLowerCase().includes("message/delivery-status") ||
          bouncedEmail !== null;

        return {
          id: messageId,
          threadId: null, // IMAP no tiene concepto de threads nativos
          bouncedEmail: isBounce ? bouncedEmail : null,
          reason: isBounce ? reason : null,
          permalink: null,
        };
      } finally {
        lock.release();
      }
    } finally {
      await client.logout();
    }
  }

  async getMessageForBounceExtraction(messageId: string): Promise<{
    bouncedEmail: string | null;
    reason: string | null;
  }> {
    const result = await this.processBounceMessage(messageId);
    return {
      bouncedEmail: result.bouncedEmail,
      reason: result.reason,
    };
  }

  async trashMessage(messageId: string): Promise<void> {
    const client = this.createClient();

    try {
      await client.connect();

      // Encontrar la carpeta Trash
      const trashFolders = ["Trash", "[Gmail]/Trash", "Deleted", "Deleted Items", "Papelera"];
      let trashFolder: string | null = null;

      const mailboxes = await client.list();
      for (const mailbox of mailboxes) {
        const name = mailbox.path;
        if (trashFolders.some((tf) => name.toLowerCase() === tf.toLowerCase())) {
          trashFolder = name;
          break;
        }
        if (mailbox.specialUse === "\\Trash") {
          trashFolder = name;
          break;
        }
      }

      if (!trashFolder) {
        console.warn("[ImapBounceScanner] No se encontró carpeta Trash");
        return;
      }

      const lock = await client.getMailboxLock("INBOX");
      try {
        await client.messageMove(messageId, trashFolder, { uid: true });
      } finally {
        lock.release();
      }
    } finally {
      await client.logout();
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Verificar conexión IMAP
// ─────────────────────────────────────────────────────────────────────────────
export async function verifyImapConnection(
  config: ImapConfig
): Promise<VerifyConnectionResult> {
  const client = new ImapFlow({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: {
      user: config.user,
      pass: config.password,
    },
    logger: false,
  });

  try {
    await client.connect();
    // Intentar listar mailboxes como prueba
    await client.list();
    await client.logout();
    return { success: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error desconocido";
    try {
      await client.logout();
    } catch {
      // Ignorar errores de logout
    }
    return { success: false, error: message };
  }
}
