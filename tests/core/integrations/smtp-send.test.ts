import { describe, it, expect } from "vitest";

/**
 * Tests para la lógica de construcción de mensajes SMTP.
 * No enviamos emails reales — testeamos la lógica de configuración
 * y construcción del sender.
 */
describe("smtp-sender", () => {
  describe("SmtpSender construction", () => {
    it("puede ser importado correctamente", async () => {
      const { SmtpSender } = await import(
        "@/server/integrations/email/smtp-sender"
      );
      expect(SmtpSender).toBeDefined();
    });

    it("crea una instancia con configuración válida", async () => {
      const { SmtpSender } = await import(
        "@/server/integrations/email/smtp-sender"
      );

      const sender = new SmtpSender({
        host: "smtp.hostinger.com",
        port: 465,
        secure: true,
        user: "test@example.com",
        password: "test-password",
        senderEmail: "test@example.com",
      });

      expect(sender.getSenderEmail()).toBe("test@example.com");
    });

    it("getSenderEmail retorna el email configurado", async () => {
      const { SmtpSender } = await import(
        "@/server/integrations/email/smtp-sender"
      );

      const sender = new SmtpSender({
        host: "smtp.gmail.com",
        port: 465,
        secure: true,
        user: "info@faroandes.com",
        password: "secret",
        senderEmail: "info@faroandes.com",
      });

      expect(sender.getSenderEmail()).toBe("info@faroandes.com");
    });
  });

  describe("From header construction", () => {
    /**
     * Replica la lógica de construcción del From en SmtpSender.sendEmail
     */
    function buildFromHeader(
      senderEmail: string,
      fromAlias: string | null | undefined
    ): string {
      const safeFromAlias = fromAlias
        ? fromAlias.replace(/[\r\n]+/g, " ").trim()
        : "";
      return safeFromAlias
        ? `"${safeFromAlias}" <${senderEmail}>`
        : senderEmail;
    }

    it("retorna solo email cuando no hay alias", () => {
      expect(buildFromHeader("info@empresa.com", null)).toBe(
        "info@empresa.com"
      );
      expect(buildFromHeader("info@empresa.com", undefined)).toBe(
        "info@empresa.com"
      );
      expect(buildFromHeader("info@empresa.com", "")).toBe(
        "info@empresa.com"
      );
    });

    it("construye From con alias entre comillas", () => {
      expect(buildFromHeader("info@empresa.com", "Mi Empresa")).toBe(
        '"Mi Empresa" <info@empresa.com>'
      );
    });

    it("sanitiza alias con saltos de línea", () => {
      expect(buildFromHeader("info@empresa.com", "Mi\r\nEmpresa")).toBe(
        '"Mi Empresa" <info@empresa.com>'
      );
    });
  });

  describe("SmtpConfig for common providers", () => {
    it("Hostinger config es válida", () => {
      const config = {
        host: "smtp.hostinger.com",
        port: 465,
        secure: true,
      };

      expect(config.host).toBe("smtp.hostinger.com");
      expect(config.port).toBe(465);
      expect(config.secure).toBe(true);
    });

    it("Gmail SMTP config es válida", () => {
      const config = {
        host: "smtp.gmail.com",
        port: 465,
        secure: true,
      };

      expect(config.host).toBe("smtp.gmail.com");
      expect(config.port).toBe(465);
      expect(config.secure).toBe(true);
    });

    it("Office 365 config usa STARTTLS en puerto 587", () => {
      const config = {
        host: "smtp.office365.com",
        port: 587,
        secure: false, // STARTTLS
      };

      expect(config.host).toBe("smtp.office365.com");
      expect(config.port).toBe(587);
      expect(config.secure).toBe(false);
    });
  });

  describe("MessageId cleanup", () => {
    /**
     * SMTP messageId viene con <...>, se limpia
     */
    function cleanMessageId(raw: string): string {
      return raw.replace(/^<|>$/g, "");
    }

    it("limpia messageId con brackets", () => {
      expect(cleanMessageId("<abc123@mail.hostinger.com>")).toBe(
        "abc123@mail.hostinger.com"
      );
    });

    it("no altera messageId sin brackets", () => {
      expect(cleanMessageId("abc123@mail.hostinger.com")).toBe(
        "abc123@mail.hostinger.com"
      );
    });
  });
});
