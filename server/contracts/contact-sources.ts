import { z } from "zod/v4";

export const syncContactsPayloadSchema = z.object({
  sourceId: z.string().uuid(),
  startRow: z.number().int().min(2),
  batchSize: z.number().int().min(100).max(2000),
  syncStartedAt: z.string().datetime(),
});

export type SyncContactsPayload = z.infer<typeof syncContactsPayloadSchema>;

export const createContactSourceSchema = z.object({
  name: z.string().min(1).max(200),
  spreadsheetId: z.string().min(1),
  sheetTab: z.string().min(1).optional(),
});

export type CreateContactSourceInput = z.infer<typeof createContactSourceSchema>;

export const contactSourceIdSchema = z.object({
  id: z.string().uuid(),
});
