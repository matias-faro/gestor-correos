import { NextRequest, NextResponse } from "next/server";
import { requireApiAuth } from "@/server/auth/api";
import { contactSourceIdSchema } from "@/server/contracts/contact-sources";
import { scheduleContactSync } from "@/server/integrations/qstash/client";

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/contact-sources/:id/sync - Disparar sync
// ─────────────────────────────────────────────────────────────────────────────
export async function POST(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await requireApiAuth();
  if (!auth.success) return auth.response;

  try {
    const { id } = await context.params;
    const parsed = contactSourceIdSchema.safeParse({ id });
    if (!parsed.success) {
      return NextResponse.json(
        { error: "ID inválido", details: parsed.error.format() },
        { status: 400 }
      );
    }

    const syncStartedAt = new Date().toISOString();
    const { messageId } = await scheduleContactSync({
      sourceId: parsed.data.id,
      startRow: 2,
      batchSize: 500,
      syncStartedAt,
      // 2s para no saturar la cuota "read requests/min/user" de Google Sheets.
      delaySeconds: 2,
    });

    return NextResponse.json({ success: true, messageId, syncStartedAt });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error desconocido";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
