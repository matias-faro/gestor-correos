import { describe, it, expect } from "vitest";
import {
  appendSignatureHtml,
  resolveEffectiveSignature,
} from "@/server/domain/signature";

describe("signature domain helpers", () => {
  describe("resolveEffectiveSignature", () => {
    it("prioriza override de campaña sobre firma global", () => {
      const override = "<p>Firma campaña</p>";
      const global = "<p>Firma global</p>";

      expect(resolveEffectiveSignature(override, global)).toBe(override);
    });

    it("usa firma global cuando no hay override", () => {
      const global = "<p>Firma global</p>";
      expect(resolveEffectiveSignature(null, global)).toBe(global);
    });

    it("retorna null cuando ambas firmas están vacías", () => {
      expect(resolveEffectiveSignature("", "   ")).toBeNull();
    });
  });

  describe("appendSignatureHtml", () => {
    it("agrega la firma al final cuando no hay cierre de body", () => {
      const html = "<p>Hola</p>";
      const signature = "<p>Firma</p>";

      const result = appendSignatureHtml({ html, signatureHtml: signature });
      expect(result).toContain("<p>Hola</p>");
      expect(result).toContain(signature);
    });

    it("inserta la firma antes de </body> si existe", () => {
      const html = "<html><body><p>Hola</p></body></html>";
      const signature = "<p>Firma</p>";

      const result = appendSignatureHtml({ html, signatureHtml: signature });
      expect(result.indexOf(signature)).toBeLessThan(result.indexOf("</body>"));
    });

    it("devuelve html original si no hay firma", () => {
      const html = "<p>Contenido</p>";
      expect(appendSignatureHtml({ html, signatureHtml: null })).toBe(html);
    });
  });
});
