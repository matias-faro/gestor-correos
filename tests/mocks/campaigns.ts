import type { CampaignResponse, DraftItemResponse } from "@/server/contracts/campaigns";

/**
 * Factory para crear campañas de prueba
 */
export function createMockCampaign(overrides: Partial<CampaignResponse> = {}): CampaignResponse {
  return {
    id: "campaign-001",
    name: "Test Campaign",
    templateId: "template-001",
    templateName: "Test Template",
    status: "draft",
    filtersSnapshot: {},
    fromAlias: null,
    signatureHtmlOverride: null,
    googleAccountId: "google-account-001",
    emailAccountId: null,
    createdBy: "user-001",
    activeLock: false,
    createdAt: "2025-01-15T10:00:00.000Z",
    updatedAt: "2025-01-15T10:00:00.000Z",
    ...overrides,
  };
}

/**
 * Factory para crear draft items de prueba
 */
export function createMockDraftItem(overrides: Partial<DraftItemResponse> = {}): DraftItemResponse {
  return {
    id: "draft-001",
    campaignId: "campaign-001",
    contactId: "contact-001",
    toEmail: "test@example.com",
    renderedSubject: "Hola Test",
    renderedHtml: "<p>Contenido del email</p>",
    state: "pending",
    includedManually: false,
    excludedManually: false,
    error: null,
    createdAt: "2025-01-15T10:00:00.000Z",
    updatedAt: "2025-01-15T10:00:00.000Z",
    ...overrides,
  };
}

/**
 * Factory para crear templates de prueba
 */
export function createMockTemplate(overrides: Partial<{
  id: string;
  name: string;
  subjectTpl: string;
  htmlTpl: string;
  createdAt: string;
  updatedAt: string;
}> = {}) {
  return {
    id: "template-001",
    name: "Test Template",
    subjectTpl: "Hola {{FirstName}}",
    htmlTpl: "<p>Bienvenido {{FirstName}} {{LastName}} de {{Company}}</p>",
    createdAt: "2025-01-15T10:00:00.000Z",
    updatedAt: "2025-01-15T10:00:00.000Z",
    ...overrides,
  };
}

/**
 * Factory para crear contactos de prueba
 */
export function createMockContact(overrides: Partial<{
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  company: string | null;
  position: string | null;
  subscriptionStatus: "active" | "unsubscribed";
}> = {}) {
  return {
    id: "contact-001",
    email: "juan@example.com",
    firstName: "Juan",
    lastName: "Pérez",
    company: "Acme Inc",
    position: "Developer",
    subscriptionStatus: "active" as const,
    ...overrides,
  };
}
