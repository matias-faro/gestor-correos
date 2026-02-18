import { NextRequest, NextResponse } from "next/server";
import { z } from "zod/v4";
import { requireApiAuth } from "@/server/auth/api";
import { getCampaignById } from "@/server/integrations/db/campaigns-repo";
import { listSendEventsWithDraftMeta } from "@/server/integrations/db/send-events-repo";

const listSendEventsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).optional().default(25),
  offset: z.coerce.number().int().min(0).optional().default(0),
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/campaigns/[id]/send-events - Historial de envíos de campaña
// ─────────────────────────────────────────────────────────────────────────────
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireApiAuth();
  if (!auth.success) return auth.response;

  const { id: campaignId } = await params;

  const { searchParams } = new URL(request.url);
  const parsed = listSendEventsQuerySchema.safeParse({
    limit: searchParams.get("limit") ?? undefined,
    offset: searchParams.get("offset") ?? undefined,
  });

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Parámetros inválidos", details: parsed.error.format() },
      { status: 400 }
    );
  }

  try {
    const campaign = await getCampaignById(campaignId);
    if (!campaign) {
      return NextResponse.json({ error: "Campaña no encontrada" }, { status: 404 });
    }

    const { sendEvents, total } = await listSendEventsWithDraftMeta(
      campaignId,
      parsed.data.limit,
      parsed.data.offset
    );

    return NextResponse.json({
      sendEvents,
      total,
      limit: parsed.data.limit,
      offset: parsed.data.offset,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error desconocido";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
