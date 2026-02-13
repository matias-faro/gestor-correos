import type { EmailSender, BounceScanner } from "./types";
import { getEmailAccountWithPassword } from "@/server/integrations/db/email-accounts-repo";
import { createGmailSender } from "./gmail-sender";
import { SmtpSender } from "./smtp-sender";
import { GmailBounceScanner } from "./gmail-bounce-scanner";
import { ImapBounceScanner } from "./imap-bounce-scanner";

// ─────────────────────────────────────────────────────────────────────────────
// Factory: crear EmailSender a partir de un email_account_id
// ─────────────────────────────────────────────────────────────────────────────

export async function createEmailSender(
  emailAccountId: string
): Promise<EmailSender> {
  const account = await getEmailAccountWithPassword(emailAccountId);

  if (!account) {
    throw new Error(`Cuenta de email no encontrada: ${emailAccountId}`);
  }

  switch (account.provider) {
    case "google": {
      if (!account.googleAccountId) {
        throw new Error(
          `Cuenta de email ${emailAccountId} es de tipo Google pero no tiene google_account_id asociado`
        );
      }
      return createGmailSender(account.googleAccountId);
    }

    case "imap_smtp": {
      if (!account.smtpHost || !account.smtpPort || !account.imapSmtpUser || !account.imapSmtpPassword) {
        throw new Error(
          `Cuenta de email ${emailAccountId} tiene configuración SMTP incompleta. ` +
          "Verificá host, puerto, usuario y contraseña."
        );
      }

      return new SmtpSender({
        host: account.smtpHost,
        port: account.smtpPort,
        secure: account.smtpSecure,
        user: account.imapSmtpUser,
        password: account.imapSmtpPassword,
        senderEmail: account.email,
      });
    }

    default:
      throw new Error(`Tipo de proveedor desconocido: ${account.provider}`);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Factory: crear BounceScanner a partir de un email_account_id
// ─────────────────────────────────────────────────────────────────────────────

export async function createBounceScanner(
  emailAccountId: string
): Promise<BounceScanner> {
  const account = await getEmailAccountWithPassword(emailAccountId);

  if (!account) {
    throw new Error(`Cuenta de email no encontrada: ${emailAccountId}`);
  }

  switch (account.provider) {
    case "google": {
      if (!account.googleAccountId) {
        throw new Error(
          `Cuenta de email ${emailAccountId} es de tipo Google pero no tiene google_account_id asociado`
        );
      }
      return new GmailBounceScanner(account.googleAccountId);
    }

    case "imap_smtp": {
      if (!account.imapHost || !account.imapPort || !account.imapSmtpUser || !account.imapSmtpPassword) {
        throw new Error(
          `Cuenta de email ${emailAccountId} tiene configuración IMAP incompleta. ` +
          "Verificá host, puerto, usuario y contraseña."
        );
      }

      return new ImapBounceScanner({
        host: account.imapHost,
        port: account.imapPort,
        secure: account.imapSecure,
        user: account.imapSmtpUser,
        password: account.imapSmtpPassword,
      });
    }

    default:
      throw new Error(`Tipo de proveedor desconocido: ${account.provider}`);
  }
}
