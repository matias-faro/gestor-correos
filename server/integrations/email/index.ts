// ─────────────────────────────────────────────────────────────────────────────
// Capa de abstracción de email — agnóstica de proveedor
// ─────────────────────────────────────────────────────────────────────────────

// Tipos e interfaces
export type {
  SendEmailInput,
  SendEmailResult,
  EmailSender,
  BounceMessage,
  BounceScanner,
  VerifyConnectionResult,
} from "./types";

// Factories (punto de entrada principal)
export { createEmailSender, createBounceScanner } from "./factory";

// Implementaciones específicas (para uso directo si se necesita)
export { GmailSender, createGmailSender } from "./gmail-sender";
export { SmtpSender, verifySmtpConnection, type SmtpConfig } from "./smtp-sender";
export { GmailBounceScanner } from "./gmail-bounce-scanner";
export { ImapBounceScanner, verifyImapConnection, type ImapConfig } from "./imap-bounce-scanner";
