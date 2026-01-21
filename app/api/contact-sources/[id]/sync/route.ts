import { NextRequest, NextResponse } from "next/server";
import { getAuthorizedUser } from "@/server/auth/session";
import { contactSourceIdSchema } from "@/server/contracts/contact-sources";
import { scheduleContactSync } from "@/server/integrations/qstash/client";

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/contact-sources/:id/sync - Disparar sync
// ─────────────────────────────────────────────────────────────────────────────
export async function POST(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    await getAuthorizedUser();

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
      delaySeconds: 1,
    });

    return NextResponse.json({ success: true, messageId, syncStartedAt });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error desconocido";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
