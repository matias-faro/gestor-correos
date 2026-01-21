import { z } from "zod/v4";

// ─────────────────────────────────────────────────────────────────────────────
// Filtros para listar contactos
// ─────────────────────────────────────────────────────────────────────────────
export const contactsFiltersSchema = z.object({
  query: z.string().optional(),
  company: z.string().optional(),
  position: z.string().optional(),
  tagIds: z.array(z.string().uuid()).optional(),
  sourceId: z.string().uuid().optional(),
  includeUnsubscribed: z.boolean().optional().default(false),
  includeSuppressed: z.boolean().optional().default(false),
  limit: z.coerce.number().int().min(1).max(100).optional().default(50),
  offset: z.coerce.number().int().min(0).optional().default(0),
});

export type ContactsFilters = z.infer<typeof contactsFiltersSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// Crear contacto
// ─────────────────────────────────────────────────────────────────────────────
export const createContactSchema = z.object({
  email: z.email().transform((v) => v.toLowerCase().trim()),
  firstName: z.string().max(100).optional(),
  lastName: z.string().max(100).optional(),
  company: z.string().max(200).optional(),
  position: z.string().max(200).optional(),
  extra: z.record(z.string(), z.unknown()).optional(),
  tagIds: z.array(z.string().uuid()).optional(),
});

export type CreateContactInput = z.infer<typeof createContactSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// Actualizar contacto
// ─────────────────────────────────────────────────────────────────────────────
export const updateContactSchema = z.object({
  id: z.string().uuid(),
  email: z.email().transform((v) => v.toLowerCase().trim()).optional(),
  firstName: z.string().max(100).nullable().optional(),
  lastName: z.string().max(100).nullable().optional(),
  company: z.string().max(200).nullable().optional(),
  position: z.string().max(200).nullable().optional(),
  extra: z.record(z.string(), z.unknown()).nullable().optional(),
  subscriptionStatus: z.enum(["active", "unsubscribed"]).optional(),
  tagIds: z.array(z.string().uuid()).optional(),
});

export type UpdateContactInput = z.infer<typeof updateContactSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// Borrar contacto
// ─────────────────────────────────────────────────────────────────────────────
export const deleteContactSchema = z.object({
  id: z.string().uuid(),
});

export type DeleteContactInput = z.infer<typeof deleteContactSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// Respuesta de contacto (para el cliente)
// ─────────────────────────────────────────────────────────────────────────────
export type ContactResponse = {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  company: string | null;
  position: string | null;
  extra: Record<string, unknown> | null;
  subscriptionStatus: "active" | "unsubscribed";
  suppressionStatus: "none" | "bounced";
  tags: { id: string; name: string; kind: "tipo" | "rubro" }[];
  createdAt: string;
  updatedAt: string;
};

export type ContactsListResponse = {
  contacts: ContactResponse[];
  total: number;
  limit: number;
  offset: number;
};
