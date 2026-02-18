import { describe, it, expect } from "vitest";

// Para testear la construcción del email sin depender de Gmail API real,
// necesitamos testear la lógica de construcción del mensaje MIME y encoding

describe("gmail/send", () => {
  describe("Construcción de mensaje MIME", () => {
    /**
     * Esta función replica la lógica interna de createMimeMessage
     * para poder testarla de forma aislada
     */
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

    it("genera header From correctamente sin alias", () => {
      const mimeMessage = createMimeMessage({
        from: "sender@example.com",
        to: "recipient@example.com",
        subject: "Test",
        html: "<p>Hello</p>",
      });

      expect(mimeMessage).toContain("From: sender@example.com");
    });

    it("genera header From con alias correctamente", () => {
      const mimeMessage = createMimeMessage({
        from: "FAROandes <sender@example.com>",
        to: "recipient@example.com",
        subject: "Test",
        html: "<p>Hello</p>",
      });

      expect(mimeMessage).toContain("From: FAROandes <sender@example.com>");
    });

    it("codifica subject en UTF-8 Base64", () => {
      const mimeMessage = createMimeMessage({
        from: "sender@example.com",
        to: "recipient@example.com",
        subject: "Invitación al evento",
        html: "<p>Hello</p>",
      });

      // Subject debe estar en formato =?UTF-8?B?...?=
      expect(mimeMessage).toMatch(/Subject: =\?UTF-8\?B\?[A-Za-z0-9+/=]+\?=/);

      // Verificar que el subject decodificado es correcto
      const subjectMatch = mimeMessage.match(/Subject: =\?UTF-8\?B\?([A-Za-z0-9+/=]+)\?=/);
      if (subjectMatch) {
        const decodedSubject = Buffer.from(subjectMatch[1], "base64").toString("utf8");
        expect(decodedSubject).toBe("Invitación al evento");
      }
    });

    it("maneja caracteres especiales en subject", () => {
      const mimeMessage = createMimeMessage({
        from: "sender@example.com",
        to: "recipient@example.com",
        subject: "🎉 Evento especial: ¡Únete!",
        html: "<p>Hello</p>",
      });

      // Debe poder decodificarse correctamente
      const subjectMatch = mimeMessage.match(/Subject: =\?UTF-8\?B\?([A-Za-z0-9+/=]+)\?=/);
      expect(subjectMatch).not.toBeNull();
      if (subjectMatch) {
        const decodedSubject = Buffer.from(subjectMatch[1], "base64").toString("utf8");
        expect(decodedSubject).toBe("🎉 Evento especial: ¡Únete!");
      }
    });

    it("codifica HTML body en base64", () => {
      const htmlContent = "<p>Hola {{FirstName}}, bienvenido a <strong>FAROandes</strong></p>";
      const mimeMessage = createMimeMessage({
        from: "sender@example.com",
        to: "recipient@example.com",
        subject: "Test",
        html: htmlContent,
      });

      // El body debe estar después de la línea vacía
      const parts = mimeMessage.split("\r\n\r\n");
      expect(parts.length).toBe(2);

      const encodedBody = parts[1];
      const decodedBody = Buffer.from(encodedBody, "base64").toString("utf8");
      expect(decodedBody).toBe(htmlContent);
    });

    it("incluye headers MIME correctos", () => {
      const mimeMessage = createMimeMessage({
        from: "sender@example.com",
        to: "recipient@example.com",
        subject: "Test",
        html: "<p>Hello</p>",
      });

      expect(mimeMessage).toContain("MIME-Version: 1.0");
      expect(mimeMessage).toContain('Content-Type: text/html; charset="UTF-8"');
      expect(mimeMessage).toContain("Content-Transfer-Encoding: base64");
    });

    it("genera header To correctamente", () => {
      const mimeMessage = createMimeMessage({
        from: "sender@example.com",
        to: "recipient@example.com",
        subject: "Test",
        html: "<p>Hello</p>",
      });

      expect(mimeMessage).toContain("To: recipient@example.com");
    });
  });

  describe("Construcción de From con alias", () => {
    /**
     * Replica la lógica de construcción del From en sendEmail
     */
    function buildFromHeader(senderEmail: string, fromAlias: string | null | undefined): string {
      const safeFromAlias = fromAlias ? fromAlias.replace(/[\r\n]+/g, " ").trim() : "";
      return safeFromAlias ? `${safeFromAlias} <${senderEmail}>` : senderEmail;
    }

    it("retorna solo email cuando no hay alias", () => {
      expect(buildFromHeader("info@faroandes.com", null)).toBe("info@faroandes.com");
      expect(buildFromHeader("info@faroandes.com", undefined)).toBe("info@faroandes.com");
      expect(buildFromHeader("info@faroandes.com", "")).toBe("info@faroandes.com");
    });

    it("construye From con alias cuando está presente", () => {
      expect(buildFromHeader("info@faroandes.com", "FAROandes")).toBe(
        "FAROandes <info@faroandes.com>"
      );
    });

    it("sanitiza alias con saltos de línea", () => {
      expect(buildFromHeader("info@faroandes.com", "FARO\r\nandes")).toBe(
        "FARO andes <info@faroandes.com>"
      );
    });

    it("maneja alias con caracteres especiales válidos", () => {
      expect(buildFromHeader("info@faroandes.com", "FAROandes - Ciencia & Tech")).toBe(
        "FAROandes - Ciencia & Tech <info@faroandes.com>"
      );
    });

    it("elimina espacios extras en alias", () => {
      expect(buildFromHeader("info@faroandes.com", "  FAROandes  ")).toBe(
        "FAROandes <info@faroandes.com>"
      );
    });
  });

  describe("Encoding para Gmail API", () => {
    /**
     * Replica la lógica de encoding para Gmail API
     */
    function encodeForGmailApi(mimeMessage: string): string {
      return Buffer.from(mimeMessage)
        .toString("base64")
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=+$/, "");
    }

    it("convierte a base64url (sin +, /, ni padding)", () => {
      const message = "Test message with special chars: +/=";
      const encoded = encodeForGmailApi(message);

      expect(encoded).not.toContain("+");
      expect(encoded).not.toContain("/");
      expect(encoded).not.toMatch(/=$/);
    });

    it("puede decodificarse correctamente", () => {
      const original = "From: test@example.com\r\nTo: dest@example.com\r\n\r\nBody";
      const encoded = encodeForGmailApi(original);

      // Revertir base64url a base64 estándar
      const base64 = encoded.replace(/-/g, "+").replace(/_/g, "/");
      const decoded = Buffer.from(base64, "base64").toString("utf8");

      expect(decoded).toBe(original);
    });
  });

  describe("Permalink", () => {
    it("construye permalink correcto", () => {
      const messageId = "abc123xyz";
      const permalink = `https://mail.google.com/mail/u/0/#inbox/${messageId}`;

      expect(permalink).toBe("https://mail.google.com/mail/u/0/#inbox/abc123xyz");
    });
  });
});
