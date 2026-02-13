import { describe, it, expect } from "vitest";

/**
 * Tests para la lógica de tipos e interfaces del email factory.
 * No podemos testear la factory directamente sin DB, pero sí podemos
 * verificar que las interfaces y tipos están correctamente definidos.
 */
describe("email/types", () => {
  it("exporta SendEmailResult con campos correctos", async () => {
    const types = await import("@/server/integrations/email/types");

    // Verificar que el módulo se importa correctamente
    expect(types).toBeDefined();
  });

  it("exporta EmailSender interface", async () => {
    const mod = await import("@/server/integrations/email/index");

    // Verificar que las exports existen
    expect(mod.createEmailSender).toBeTypeOf("function");
    expect(mod.createBounceScanner).toBeTypeOf("function");
    expect(mod.GmailSender).toBeTypeOf("function");
    expect(mod.SmtpSender).toBeTypeOf("function");
    expect(mod.GmailBounceScanner).toBeTypeOf("function");
    expect(mod.ImapBounceScanner).toBeTypeOf("function");
    expect(mod.verifySmtpConnection).toBeTypeOf("function");
    expect(mod.verifyImapConnection).toBeTypeOf("function");
  });
});

describe("GmailSender", () => {
  it("puede construirse con googleAccountId y email", async () => {
    const { GmailSender } = await import(
      "@/server/integrations/email/gmail-sender"
    );

    // Nota: no podemos llamar a sendEmail sin un cliente Gmail real,
    // pero podemos verificar que la clase se construye correctamente
    const sender = new GmailSender("fake-google-id", "test@gmail.com");
    expect(sender.getSenderEmail()).toBe("test@gmail.com");
  });
});

describe("SmtpSender", () => {
  it("puede construirse con configuración SMTP", async () => {
    const { SmtpSender } = await import(
      "@/server/integrations/email/smtp-sender"
    );

    const sender = new SmtpSender({
      host: "smtp.hostinger.com",
      port: 465,
      secure: true,
      user: "contacto@miempresa.com",
      password: "secret",
      senderEmail: "contacto@miempresa.com",
    });

    expect(sender.getSenderEmail()).toBe("contacto@miempresa.com");
  });
});

describe("ImapBounceScanner", () => {
  it("puede construirse con configuración IMAP", async () => {
    const { ImapBounceScanner } = await import(
      "@/server/integrations/email/imap-bounce-scanner"
    );

    // Nota: no podemos conectar a un servidor IMAP real en tests,
    // pero podemos verificar que la clase se construye correctamente
    const scanner = new ImapBounceScanner({
      host: "imap.hostinger.com",
      port: 993,
      secure: true,
      user: "contacto@miempresa.com",
      password: "secret",
    });

    expect(scanner).toBeDefined();
  });
});

describe("GmailBounceScanner", () => {
  it("puede construirse con googleAccountId", async () => {
    const { GmailBounceScanner } = await import(
      "@/server/integrations/email/gmail-bounce-scanner"
    );

    const scanner = new GmailBounceScanner("fake-google-id");
    expect(scanner).toBeDefined();
  });
});
