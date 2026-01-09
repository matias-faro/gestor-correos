import { z } from "zod/v4";

// ─────────────────────────────────────────────────────────────────────────────
// Filtros para listar plantillas (por ahora vacío, extensible)
// ─────────────────────────────────────────────────────────────────────────────
export const listTemplatesSchema = z.object({
  query: z.string().optional(),
});

export type ListTemplatesFilters = z.infer<typeof listTemplatesSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// Crear plantilla
// ─────────────────────────────────────────────────────────────────────────────
export const createTemplateSchema = z.object({
  name: z.string().min(1, "El nombre es obligatorio").max(200),
  subjectTpl: z.string().min(1, "El asunto es obligatorio").max(500),
  htmlTpl: z.string().min(1, "El contenido HTML es obligatorio"),
});

export type CreateTemplateInput = z.infer<typeof createTemplateSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// Actualizar plantilla
// ─────────────────────────────────────────────────────────────────────────────
export const updateTemplateSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(200).optional(),
  subjectTpl: z.string().min(1).max(500).optional(),
  htmlTpl: z.string().min(1).optional(),
});

export type UpdateTemplateInput = z.infer<typeof updateTemplateSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// Borrar plantilla
// ─────────────────────────────────────────────────────────────────────────────
export const deleteTemplateSchema = z.object({
  id: z.string().uuid(),
});

export type DeleteTemplateInput = z.infer<typeof deleteTemplateSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// Preview de plantilla (sin guardar)
// ─────────────────────────────────────────────────────────────────────────────
export const previewTemplateSchema = z.object({
  subjectTpl: z.string(),
  htmlTpl: z.string(),
  contactId: z.string().uuid().optional(),
  unsubscribeUrl: z.string().url().optional(),
});

export type PreviewTemplateInput = z.infer<typeof previewTemplateSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// Respuesta de plantilla (para el cliente)
// ─────────────────────────────────────────────────────────────────────────────
export type TemplateResponse = {
  id: string;
  name: string;
  subjectTpl: string;
  htmlTpl: string;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
};

export type TemplatesListResponse = {
  templates: TemplateResponse[];
};

// ─────────────────────────────────────────────────────────────────────────────
// Respuesta de preview
// ─────────────────────────────────────────────────────────────────────────────
export type PreviewResponse = {
  subject: string;
  html: string;
};
