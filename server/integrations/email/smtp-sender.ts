import { createTransport, type Transporter } from "nodemailer";
import type {
  EmailSender,
  SendEmailInput,
  SendEmailResult,
  VerifyConnectionResult,
} from "./types";
import { assertValidEmail, sanitizeHeaderValue } from "@/server/domain/email";

// ─────────────────────────────────────────────────────────────────────────────
// SmtpSender — Implementación de EmailSender usando SMTP (nodemailer)
// Funciona con cualquier proveedor: Hostinger, Office 365, etc.
// ─────────────────────────────────────────────────────────────────────────────

export type SmtpConfig = {
  host: string;
  port: number;
  secure: boolean; // true = SSL/TLS directo (465), false = STARTTLS (587)
  user: string;
  password: string;
  senderEmail: string;
};

export class SmtpSender implements EmailSender {
  private transporter: Transporter;

  constructor(private readonly config: SmtpConfig) {
    this.transporter = createTransport({
      host: config.host,
      port: config.port,
      secure: config.secure,
      auth: {
        user: config.user,
        pass: config.password,
      },
      // Timeouts razonables para evitar colgarse
      connectionTimeout: 10_000,
      greetingTimeout: 10_000,
      socketTimeout: 30_000,
    });
  }

  async sendEmail(input: SendEmailInput): Promise<SendEmailResult> {
    const toEmail = assertValidEmail(input.to, "Email de destino");
    const safeFromAlias = input.fromAlias
      ? sanitizeHeaderValue(input.fromAlias)
      : "";

    // Construir From con alias opcional
    const from = safeFromAlias
      ? `"${safeFromAlias}" <${this.config.senderEmail}>`
      : this.config.senderEmail;

    const info = await this.transporter.sendMail({
      from,
      to: toEmail,
      subject: input.subject,
      html: input.html,
    });

    // El messageId de SMTP viene con <...>, lo limpiamos
    const messageId = (info.messageId ?? "").replace(/^<|>$/g, "");

    return {
      messageId,
      threadId: null, // SMTP no tiene concepto de threads
      permalink: null, // No hay webmail link genérico
    };
  }

  getSenderEmail(): string {
    return this.config.senderEmail;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Verificar conexión SMTP
// ─────────────────────────────────────────────────────────────────────────────
export async function verifySmtpConnection(
  config: Omit<SmtpConfig, "senderEmail">
): Promise<VerifyConnectionResult> {
  const transporter = createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: {
      user: config.user,
      pass: config.password,
    },
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
  });

  try {
    await transporter.verify();
    return { success: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error desconocido";
    return { success: false, error: message };
  } finally {
    transporter.close();
  }
}
