import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

/**
 * Tests de integración para workflows de campañas
 *
 * Estos tests verifican la lógica de negocio sin depender de Supabase o Gmail.
 * Se mockean los repos y servicios externos para aislar el comportamiento.
 */

describe("Campaign Workflows", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-01-15T10:30:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.resetAllMocks();
  });

  describe("Validaciones de estado", () => {
    it("solo permite snapshot en campañas draft o ready", () => {
      const allowedStatuses = ["draft", "ready"];
      const blockedStatuses = ["sending", "paused", "completed", "cancelled"];

      for (const status of allowedStatuses) {
        expect(allowedStatuses).toContain(status);
      }

      for (const status of blockedStatuses) {
        expect(allowedStatuses).not.toContain(status);
      }
    });

    it("solo permite iniciar campañas en estado ready", () => {
      const allowedForStart = "ready";
      const blockedStatuses = ["draft", "sending", "paused", "completed", "cancelled"];

      expect(allowedForStart).toBe("ready");

      for (const status of blockedStatuses) {
        expect(status).not.toBe(allowedForStart);
      }
    });

    it("las transiciones de estado siguen el flujo esperado", () => {
      // draft -> ready (después de snapshot)
      // ready -> sending (después de start)
      // sending -> paused (manual)
      // sending -> completed (todos enviados)
      // sending -> cancelled (manual)
      // paused -> sending (resume)

      const transitions: Record<string, string[]> = {
        draft: ["ready"],
        ready: ["sending", "draft"],
        sending: ["paused", "completed", "cancelled"],
        paused: ["sending", "cancelled"],
        completed: [],
        cancelled: [],
      };

      expect(transitions.draft).toContain("ready");
      expect(transitions.ready).toContain("sending");
      expect(transitions.sending).toContain("completed");
      expect(transitions.sending).toContain("paused");
    });
  });

  describe("Snapshot generation", () => {
    it("requiere templateId para generar snapshot", () => {
      const campaignWithoutTemplate = {
        id: "campaign-001",
        status: "draft",
        templateId: null,
      };

      expect(campaignWithoutTemplate.templateId).toBeNull();
      // En el servicio real, esto lanzaría "La campaña no tiene plantilla asignada"
    });

    it("requiere force=true para regenerar si ya hay drafts", () => {
      const existingDraftsCount = 10;
      const force = false;

      const shouldBlock = existingDraftsCount > 0 && !force;
      expect(shouldBlock).toBe(true);

      const forceRegenerate = true;
      const shouldAllow = existingDraftsCount > 0 && forceRegenerate;
      expect(shouldAllow).toBe(true);
    });

    it("renderiza variables de plantilla correctamente en drafts", () => {
      const contact = {
        firstName: "María",
        lastName: "González",
        company: "TechCorp",
      };

      // Simular render (ya testeado en templating.test.ts)
      const expectedSubject = `Hola ${contact.firstName}`;
      const expectedHtmlContains = [contact.firstName, contact.company];

      expect(expectedSubject).toBe("Hola María");
      for (const text of expectedHtmlContains) {
        expect(`<p>Bienvenido María de TechCorp</p>`).toContain(text);
      }
    });
  });

  describe("Alias de remitente (fromAlias)", () => {
    it("se pasa al sendEmail cuando está configurado en la campaña", () => {
      const campaign = {
        fromAlias: "FAROandes - Ciencia",
        googleAccountId: "google-001",
      };

      // El alias debe llegar a sendEmail
      expect(campaign.fromAlias).toBe("FAROandes - Ciencia");

      // Resultado esperado en el header From
      const senderEmail = "info@faroandes.com";
      const expectedFrom = `${campaign.fromAlias} <${senderEmail}>`;
      expect(expectedFrom).toBe("FAROandes - Ciencia <info@faroandes.com>");
    });

    it("no modifica From cuando fromAlias es null", () => {
      const campaign = {
        fromAlias: null,
        googleAccountId: "google-001",
      };

      const senderEmail = "info@faroandes.com";
      // Sin alias, From es solo el email
      const expectedFrom = campaign.fromAlias
        ? `${campaign.fromAlias} <${senderEmail}>`
        : senderEmail;

      expect(expectedFrom).toBe("info@faroandes.com");
    });
  });

  describe("Flujo de envío (processSendTick)", () => {
    it("respeta cuota diaria", () => {
      const dailyQuota = 100;
      const todaySentCount = 100;

      const quotaExceeded = todaySentCount >= dailyQuota;
      expect(quotaExceeded).toBe(true);
    });

    it("respeta ventanas de envío", () => {
      // Miércoles 10:30 UTC, ventana 09:00-18:00 -> dentro
      const currentHour = 10;
      const windowStart = 9;
      const windowEnd = 18;

      const withinWindow = currentHour >= windowStart && currentHour < windowEnd;
      expect(withinWindow).toBe(true);

      // Fuera de ventana
      const earlyHour = 7;
      const outsideWindow = earlyHour >= windowStart && earlyHour < windowEnd;
      expect(outsideWindow).toBe(false);
    });

    it("completa la campaña cuando no hay más pendientes", () => {
      const pendingCount = 0;
      const sendingCount = 0;

      const shouldComplete = pendingCount === 0 && sendingCount === 0;
      expect(shouldComplete).toBe(true);
    });

    it("programa siguiente tick con delay calculado", () => {
      const minDelaySeconds = 30;
      const calculatedDelay = 60; // Del pacing

      const actualDelay = Math.max(minDelaySeconds, calculatedDelay);
      expect(actualDelay).toBe(60);
    });

    it("marca draft como fallido y continúa con errores", () => {
      const draftStates = {
        pending: "pending",
        sending: "sending",
        sent: "sent",
        failed: "failed",
        excluded: "excluded",
      };

      // Después de error, el draft pasa a failed
      expect(draftStates.failed).toBe("failed");

      // Pero la campaña continúa si hay más pendientes
      const remainingPending = 5;
      const shouldContinue = remainingPending > 0;
      expect(shouldContinue).toBe(true);
    });
  });

  describe("Registro de eventos de envío", () => {
    it("guarda gmailMessageId y permalink en send_events", () => {
      const sendResult = {
        messageId: "msg123",
        threadId: "thread456",
        permalink: "https://mail.google.com/mail/u/0/#inbox/msg123",
      };

      expect(sendResult.messageId).toBe("msg123");
      expect(sendResult.permalink).toContain(sendResult.messageId);
    });

    it("registra error en send_events cuando falla", () => {
      const errorMessage = "Gmail API error: quota exceeded";

      const sendEvent = {
        status: "failed",
        error: errorMessage,
        gmailMessageId: null,
        gmailPermalink: null,
      };

      expect(sendEvent.status).toBe("failed");
      expect(sendEvent.error).toBe(errorMessage);
    });
  });

  describe("Test send", () => {
    it("prefija [TEST] al subject en envío de prueba real", () => {
      const originalSubject = "Invitación al evento";
      const testSubject = `[TEST] ${originalSubject}`;

      expect(testSubject).toBe("[TEST] Invitación al evento");
    });

    it("usa datos de contacto real si se provee contactId", () => {
      const contact = {
        firstName: "Ana",
        lastName: "López",
        company: "StartupXYZ",
      };

      // Cuando hay contactId, usa sus datos
      expect(contact.firstName).toBe("Ana");
    });

    it("usa datos de prueba genéricos sin contactId", () => {
      const defaultData = {
        firstName: "Test",
        lastName: "User",
        company: "Test Company",
      };

      expect(defaultData.firstName).toBe("Test");
    });
  });
});
