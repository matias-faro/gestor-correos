// ─────────────────────────────────────────────────────────────────────────────
// Interfaces agnósticas de proveedor para envío de email y escaneo de bounces
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Input para enviar un email (agnóstico de proveedor).
 */
export type SendEmailInput = {
  to: string;
  subject: string;
  html: string;
  fromAlias?: string | null;
};

/**
 * Resultado de enviar un email.
 * - `threadId` y `permalink` pueden ser null para proveedores SMTP genéricos.
 */
export type SendEmailResult = {
  messageId: string;
  threadId: string | null;
  permalink: string | null;
};

/**
 * Interfaz para enviar emails.
 * Implementaciones: GmailSender (Gmail API) y SmtpSender (nodemailer).
 */
export interface EmailSender {
  sendEmail(input: SendEmailInput): Promise<SendEmailResult>;
  getSenderEmail(): string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Bounce Scanner
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Información de un mensaje de rebote procesado.
 */
export type BounceMessage = {
  id: string;
  threadId: string | null;
  bouncedEmail: string | null;
  reason: string | null;
  permalink: string | null;
};

/**
 * Interfaz para escanear mensajes de rebote (DSN).
 * Implementaciones: GmailBounceScanner (Gmail API) y ImapBounceScanner (IMAP).
 */
export interface BounceScanner {
  /**
   * Lista IDs de mensajes que parecen rebotes.
   */
  listBounceMessageIds(options: {
    maxResults: number;
    newerThanDays: number;
  }): Promise<string[]>;

  /**
   * Lista IDs de mensajes de rebote en la papelera.
   */
  listBounceMessageIdsInTrash(options: {
    maxResults: number;
    newerThanDays: number;
    pageToken?: string;
  }): Promise<{ messageIds: string[]; nextPageToken: string | null }>;

  /**
   * Procesa un mensaje de rebote completo: descarga, parsea y extrae email/razón.
   */
  processBounceMessage(messageId: string): Promise<BounceMessage>;

  /**
   * Obtiene mensaje completo (para re-parseo si metadata no alcanza).
   */
  getMessageForBounceExtraction(messageId: string): Promise<{
    bouncedEmail: string | null;
    reason: string | null;
  }>;

  /**
   * Mueve un mensaje a la papelera.
   */
  trashMessage(messageId: string): Promise<void>;
}

// ─────────────────────────────────────────────────────────────────────────────
// Verificación de conexión
// ─────────────────────────────────────────────────────────────────────────────

export type VerifyConnectionResult = {
  success: boolean;
  error?: string;
};
