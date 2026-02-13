import type { EmailSender, SendEmailInput, SendEmailResult } from "./types";
import { sendEmail as gmailSendEmail } from "@/server/integrations/gmail/send";
import { getSenderEmail } from "@/server/integrations/gmail/client";

// ─────────────────────────────────────────────────────────────────────────────
// GmailSender — Implementación de EmailSender usando Gmail API
// Wrapper de la integración existente en server/integrations/gmail/send.ts
// ─────────────────────────────────────────────────────────────────────────────

export class GmailSender implements EmailSender {
  constructor(
    private readonly googleAccountId: string,
    private readonly senderEmail: string
  ) {}

  async sendEmail(input: SendEmailInput): Promise<SendEmailResult> {
    const result = await gmailSendEmail({
      googleAccountId: this.googleAccountId,
      to: input.to,
      subject: input.subject,
      html: input.html,
      fromAlias: input.fromAlias,
    });

    return {
      messageId: result.messageId,
      threadId: result.threadId,
      permalink: result.permalink,
    };
  }

  getSenderEmail(): string {
    return this.senderEmail;
  }
}

/**
 * Crea un GmailSender para una cuenta de Google.
 */
export async function createGmailSender(
  googleAccountId: string
): Promise<GmailSender> {
  const email = await getSenderEmail(googleAccountId);
  return new GmailSender(googleAccountId, email);
}
