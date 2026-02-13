import { z } from "zod/v4";

// ─────────────────────────────────────────────────────────────────────────────
// Estados de campaña (debe coincidir con el enum de la DB)
// ─────────────────────────────────────────────────────────────────────────────
export const campaignStatusEnum = z.enum([
  "draft",
  "ready",
  "sending",
  "paused",
  "completed",
  "cancelled",
]);

export type CampaignStatus = z.infer<typeof campaignStatusEnum>;

// ─────────────────────────────────────────────────────────────────────────────
// Estados de draft item (debe coincidir con el enum de la DB)
// ─────────────────────────────────────────────────────────────────────────────
export const draftItemStateEnum = z.enum([
  "pending",
  "sending",
  "sent",
  "failed",
  "excluded",
]);

export type DraftItemState = z.infer<typeof draftItemStateEnum>;

// ─────────────────────────────────────────────────────────────────────────────
// Filtros de segmento para campaña (sin paginación, snapshot usa todo)
// ─────────────────────────────────────────────────────────────────────────────
export const campaignFiltersSchema = z.object({
  query: z.string().optional(),
  company: z.string().optional(),
  position: z.string().optional(),
  tagIds: z.array(z.string().uuid()).optional(),
});

export type CampaignFilters = z.infer<typeof campaignFiltersSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// Listar campañas
// ─────────────────────────────────────────────────────────────────────────────
export const listCampaignsSchema = z.object({
  query: z.string().optional(),
  status: campaignStatusEnum.optional(),
});

export type ListCampaignsFilters = z.infer<typeof listCampaignsSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// Crear campaña
// ─────────────────────────────────────────────────────────────────────────────
export const createCampaignSchema = z.object({
  name: z.string().min(1, "El nombre es obligatorio").max(200),
  templateId: z.string().uuid("Template ID inválido"),
  filters: campaignFiltersSchema.optional().default({}),
  fromAlias: z.string().max(200).optional(),
  signatureHtmlOverride: z.string().optional(),
});

export type CreateCampaignInput = z.infer<typeof createCampaignSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// Actualizar campaña (solo si está en draft)
// ─────────────────────────────────────────────────────────────────────────────
export const updateCampaignSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(200).optional(),
  templateId: z.string().uuid().optional(),
  filters: campaignFiltersSchema.optional(),
  fromAlias: z.string().max(200).nullable().optional(),
  signatureHtmlOverride: z.string().nullable().optional(),
  emailAccountId: z.string().uuid().nullable().optional(),
});

export type UpdateCampaignInput = z.infer<typeof updateCampaignSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// Borrar campaña
// ─────────────────────────────────────────────────────────────────────────────
export const deleteCampaignSchema = z.object({
  id: z.string().uuid(),
});

export type DeleteCampaignInput = z.infer<typeof deleteCampaignSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// Generar snapshot
// ─────────────────────────────────────────────────────────────────────────────
export const generateSnapshotSchema = z.object({
  force: z.boolean().optional().default(false),
});

export type GenerateSnapshotInput = z.infer<typeof generateSnapshotSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// Listar draft items
// ─────────────────────────────────────────────────────────────────────────────
export const listDraftItemsSchema = z.object({
  query: z.string().optional(),
  state: draftItemStateEnum.optional(),
  limit: z.coerce.number().int().min(1).max(100).optional().default(50),
  offset: z.coerce.number().int().min(0).optional().default(0),
});

export type ListDraftItemsFilters = z.infer<typeof listDraftItemsSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// Actualizar draft item (excluir/incluir)
// ─────────────────────────────────────────────────────────────────────────────
export const updateDraftItemSchema = z.object({
  id: z.string().uuid(),
  action: z.enum(["exclude", "include"]),
});

export type UpdateDraftItemInput = z.infer<typeof updateDraftItemSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// Incluir contacto manualmente (crear draft para contacto existente)
// ─────────────────────────────────────────────────────────────────────────────
export const includeContactManuallySchema = z.object({
  contactId: z.string().uuid("ID de contacto inválido"),
});

export type IncludeContactManuallyInput = z.infer<typeof includeContactManuallySchema>;

// ─────────────────────────────────────────────────────────────────────────────
// Enviar prueba (simulada o real)
// ─────────────────────────────────────────────────────────────────────────────
export const testSendSchema = z.object({
  contactId: z.string().uuid("ID de contacto inválido").optional(),
  toEmail: z.string().email("Email inválido").optional(),
  sendReal: z.boolean().optional().default(false),
}).refine(
  (data) => data.contactId || data.toEmail,
  { message: "Se requiere contactId o toEmail" }
);

export type TestSendInput = z.infer<typeof testSendSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// Respuesta de campaña (para el cliente)
// ─────────────────────────────────────────────────────────────────────────────
export type CampaignResponse = {
  id: string;
  name: string;
  status: CampaignStatus;
  templateId: string | null;
  templateName: string | null;
  filtersSnapshot: CampaignFilters;
  fromAlias: string | null;
  signatureHtmlOverride: string | null;
  createdBy: string | null;
  googleAccountId: string | null;
  emailAccountId: string | null;
  activeLock: boolean;
  createdAt: string;
  updatedAt: string;
};

// ─────────────────────────────────────────────────────────────────────────────
// Estadísticas de campaña
// ─────────────────────────────────────────────────────────────────────────────
export type CampaignStatsResponse = {
  totalDrafts: number;
  pending: number;
  sent: number;
  failed: number;
  excluded: number;
};

// ─────────────────────────────────────────────────────────────────────────────
// Respuesta de draft item (para el cliente)
// ─────────────────────────────────────────────────────────────────────────────
export type DraftItemResponse = {
  id: string;
  campaignId: string;
  contactId: string | null;
  toEmail: string;
  renderedSubject: string;
  renderedHtml: string;
  state: DraftItemState;
  includedManually: boolean;
  excludedManually: boolean;
  error: string | null;
  createdAt: string;
  updatedAt: string;
};

// ─────────────────────────────────────────────────────────────────────────────
// Respuesta de test send event
// ─────────────────────────────────────────────────────────────────────────────
export type TestSendEventResponse = {
  id: string;
  campaignId: string;
  contactId: string | null;
  toEmail: string;
  renderedSubject: string;
  renderedHtml: string;
  createdAt: string;
};

// ─────────────────────────────────────────────────────────────────────────────
// Respuestas de listas
// ─────────────────────────────────────────────────────────────────────────────
export type CampaignsListResponse = {
  campaigns: CampaignResponse[];
};

export type DraftItemsListResponse = {
  draftItems: DraftItemResponse[];
  total: number;
  limit: number;
  offset: number;
};

export type TestSendEventsListResponse = {
  testSendEvents: TestSendEventResponse[];
};

// ─────────────────────────────────────────────────────────────────────────────
// Estados de send run (debe coincidir con el enum de la DB)
// ─────────────────────────────────────────────────────────────────────────────
export const sendRunStatusEnum = z.enum([
  "running",
  "paused",
  "completed",
  "cancelled",
]);

export type SendRunStatus = z.infer<typeof sendRunStatusEnum>;

// ─────────────────────────────────────────────────────────────────────────────
// Estados de send event (debe coincidir con el enum de la DB)
// ─────────────────────────────────────────────────────────────────────────────
export const sendEventStatusEnum = z.enum(["sent", "failed"]);

export type SendEventStatus = z.infer<typeof sendEventStatusEnum>;

// ─────────────────────────────────────────────────────────────────────────────
// Payload del tick de QStash
// ─────────────────────────────────────────────────────────────────────────────
export const sendTickPayloadSchema = z.object({
  campaignId: z.string().uuid(),
  sendRunId: z.string().uuid(),
});

export type SendTickPayload = z.infer<typeof sendTickPayloadSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// Respuesta de send run (para el cliente)
// ─────────────────────────────────────────────────────────────────────────────
export type SendRunResponse = {
  id: string;
  campaignId: string;
  status: SendRunStatus;
  startedAt: string;
  endedAt: string | null;
  nextTickAt: string | null;
};

// ─────────────────────────────────────────────────────────────────────────────
// Respuesta de send event (para el cliente)
// ─────────────────────────────────────────────────────────────────────────────
export type SendEventResponse = {
  id: string;
  campaignId: string;
  draftItemId: string;
  sentAt: string;
  gmailMessageId: string | null;
  gmailThreadId: string | null;
  gmailPermalink: string | null;
  status: SendEventStatus;
  error: string | null;
};
