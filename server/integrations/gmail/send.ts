import { getGmailClient, getSenderEmail } from "./client";
import { assertValidEmail, sanitizeHeaderValue } from "@/server/domain/email";

// ─────────────────────────────────────────────────────────────────────────────
// Tipos
// ─────────────────────────────────────────────────────────────────────────────
export type SendEmailResult = {
  messageId: string;
  threadId: string;
  permalink: string;
};

// ─────────────────────────────────────────────────────────────────────────────
// Crear mensaje MIME (RFC 2822)
// ─────────────────────────────────────────────────────────────────────────────
function createMimeMessage(options: {
  from: string;
  to: string;
  subject: string;
  html: string;
}): string {
  const { from, to, subject, html } = options;

  // Codificar subject en UTF-8 Base64 para caracteres especiales
  const encodedSubject = `=?UTF-8?B?${Buffer.from(subject).toString("base64")}?=`;

  const messageParts = [
    `From: ${from}`,
    `To: ${to}`,
    `Subject: ${encodedSubject}`,
    "MIME-Version: 1.0",
    'Content-Type: text/html; charset="UTF-8"',
    "Content-Transfer-Encoding: base64",
    "",
    Buffer.from(html).toString("base64"),
  ];

  return messageParts.join("\r\n");
}

// ─────────────────────────────────────────────────────────────────────────────
// Enviar email vía Gmail API
// ─────────────────────────────────────────────────────────────────────────────
export async function sendEmail(options: {
  googleAccountId: string;
  to: string;
  subject: string;
  html: string;
  fromAlias?: string | null;
}): Promise<SendEmailResult> {
  const { googleAccountId, to, subject, html, fromAlias } = options;

  const gmail = await getGmailClient(googleAccountId);
  const senderEmail = await getSenderEmail(googleAccountId);

  const toEmail = assertValidEmail(to, "Email de destino");
  const safeFromAlias = fromAlias ? sanitizeHeaderValue(fromAlias) : "";

  // Construir el "From" con alias opcional
  const from = safeFromAlias ? `${safeFromAlias} <${senderEmail}>` : senderEmail;

  // Crear mensaje MIME
  const mimeMessage = createMimeMessage({ from, to: toEmail, subject, html });

  // Codificar para Gmail API (base64url)
  const encodedMessage = Buffer.from(mimeMessage)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

  // Enviar
  const response = await gmail.users.messages.send({
    userId: "me",
    requestBody: {
      raw: encodedMessage,
    },
  });

  const messageId = response.data.id;
  const threadId = response.data.threadId;

  if (!messageId || !threadId) {
    throw new Error("Gmail no retornó messageId o threadId");
  }

  // Construir permalink
  const permalink = `https://mail.google.com/mail/u/0/#inbox/${messageId}`;

  return {
    messageId,
    threadId,
    permalink,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Agregar label a un mensaje (opcional, para categorizar por campaña)
// ─────────────────────────────────────────────────────────────────────────────
export async function addLabelToMessage(options: {
  googleAccountId: string;
  messageId: string;
  labelName: string;
}): Promise<void> {
  const { googleAccountId, messageId, labelName } = options;

  const gmail = await getGmailClient(googleAccountId);

  // Buscar o crear label
  const labelsResponse = await gmail.users.labels.list({ userId: "me" });
  const labels = labelsResponse.data.labels ?? [];

  let labelId = labels.find((l) => l.name === labelName)?.id;

  if (!labelId) {
    // Crear label
    const createResponse = await gmail.users.labels.create({
      userId: "me",
      requestBody: {
        name: labelName,
        labelListVisibility: "labelShow",
        messageListVisibility: "show",
      },
    });
    labelId = createResponse.data.id;
  }

  if (!labelId) {
    throw new Error(`No se pudo crear/obtener label: ${labelName}`);
  }

  // Aplicar label al mensaje
  await gmail.users.messages.modify({
    userId: "me",
    id: messageId,
    requestBody: {
      addLabelIds: [labelId],
    },
  });
}
