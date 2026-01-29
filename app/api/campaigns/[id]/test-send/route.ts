import { NextRequest, NextResponse } from "next/server";
import { requireApiAuth } from "@/server/auth/api";
import { testSendSchema } from "@/server/contracts/campaigns";
import { sendTestSimulated, sendTestReal } from "@/server/services/CampaignService";
import { listTestSendEvents } from "@/server/integrations/db/draft-items-repo";

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/campaigns/[id]/test-send - Listar eventos de prueba
// ─────────────────────────────────────────────────────────────────────────────
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireApiAuth();
  if (!auth.success) return auth.response;

  const { id: campaignId } = await params;

  try {
    const testSendEvents = await listTestSendEvents(campaignId);
    return NextResponse.json({ testSendEvents });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error desconocido";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/campaigns/[id]/test-send - Enviar prueba (simulada o real)
// ─────────────────────────────────────────────────────────────────────────────
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireApiAuth();
  if (!auth.success) return auth.response;

  const { id: campaignId } = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const parsed = testSendSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Datos inválidos", details: parsed.error.format() },
      { status: 400 }
    );
  }

  try {
    // Envío real vs simulado
    if (parsed.data.sendReal && parsed.data.toEmail) {
      const result = await sendTestReal(
        campaignId,
        parsed.data.toEmail,
        parsed.data.contactId,
        auth.user.id
      );
      return NextResponse.json({
        success: true,
        result,
        message: `Email de prueba enviado a ${result.toEmail}`,
      });
    } else if (parsed.data.contactId) {
      // Envío simulado (solo guarda registro)
      const event = await sendTestSimulated(campaignId, parsed.data.contactId);
      return NextResponse.json({
        success: true,
        event,
        message: `Prueba simulada guardada para ${event.toEmail}`,
      });
    } else {
      return NextResponse.json(
        { error: "Se requiere contactId para prueba simulada o toEmail para prueba real" },
        { status: 400 }
      );
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error desconocido";
    const status = message.includes("no encontrad") ? 404 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
