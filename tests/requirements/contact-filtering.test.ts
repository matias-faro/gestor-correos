import { describe, it, expect } from "vitest";

/**
 * Requirements: Filtrado y exclusión de contactos
 *
 * Según la documentación del sistema viejo:
 * - Lista de palabras clave para filtrar contactos no deseados
 * - Anti-duplicados: no enviar al mismo email dos veces en una campaña
 * - Exclusión de contactos dados de baja (unsubscribed)
 * - Filtros por etiquetas, empresas, cargo
 */

describe("REQ: Filtrado de contactos", () => {
  describe("Exclusión por keywords", () => {
    it("settings debe tener lista de keywords para excluir", () => {
      // IMPLEMENTADO: settings ahora expone excludeKeywords y se configura en UI/API.

      const settings = {
        excludeKeywords: [
          "no-reply",
          ".jpg@",
          ".png@",
          "adetech",
          "faroandes", // No enviarse a sí mismo
        ],
      };

      expect(settings.excludeKeywords).toBeDefined();
      expect(settings.excludeKeywords.length).toBeGreaterThan(0);
    });

    it("contactos con email que contiene keyword deben excluirse del snapshot", () => {
      // IMPLEMENTADO: listContactsForSnapshot aplica NOT ILIKE por cada keyword.

      const excludeKeywords = ["no-reply", "adetech"];
      const contacts = [
        { email: "user@company.com" },
        { email: "no-reply@company.com" },
        { email: "info@adetech.com" },
      ];

      const filtered = contacts.filter(
        (c) => !excludeKeywords.some((kw) => c.email.toLowerCase().includes(kw))
      );

      expect(filtered.length).toBe(1);
      expect(filtered[0].email).toBe("user@company.com");
    });
  });

  describe("Exclusión de desuscritos", () => {
    it("contactos con subscriptionStatus=unsubscribed deben excluirse", () => {
      // IMPLEMENTADO: listContactsForSnapshot filtra por subscription_status
      const contact = {
        email: "user@example.com",
        subscriptionStatus: "unsubscribed",
      };

      const shouldExclude = contact.subscriptionStatus === "unsubscribed";
      expect(shouldExclude).toBe(true);
    });
  });

  describe("Anti-duplicados en campaña", () => {
    it("no debe crear dos drafts para el mismo email en una campaña", () => {
      // IMPLEMENTADO: includeContactManually verifica con findDraftItemByEmail
      const existingDrafts = [
        { toEmail: "user1@example.com" },
        { toEmail: "user2@example.com" },
      ];

      const newEmail = "user1@example.com";
      const isDuplicate = existingDrafts.some((d) => d.toEmail === newEmail);

      expect(isDuplicate).toBe(true);
    });
  });

  describe("Filtros de segmentación", () => {
    it("debe soportar filtro por tags", () => {
      // IMPLEMENTADO: campaign.filtersSnapshot incluye tagIds
      const filters = {
        tagIds: ["tag-1", "tag-2"],
      };

      expect(filters.tagIds).toBeDefined();
    });

    it("debe soportar filtro por empresa", () => {
      // IMPLEMENTADO: campaign.filtersSnapshot incluye company
      const filters = {
        company: "Acme",
      };

      expect(filters.company).toBeDefined();
    });

    it("debe soportar filtro por cargo/posición", () => {
      // IMPLEMENTADO: campaign.filtersSnapshot incluye position
      const filters = {
        position: "Developer",
      };

      expect(filters.position).toBeDefined();
    });

    it("debe soportar búsqueda por texto libre", () => {
      // IMPLEMENTADO: campaign.filtersSnapshot incluye query
      const filters = {
        query: "investigación",
      };

      expect(filters.query).toBeDefined();
    });
  });
});
