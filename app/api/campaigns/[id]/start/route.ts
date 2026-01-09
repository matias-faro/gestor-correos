import { NextRequest, NextResponse } from "next/server";
import { requireApiAuth } from "@/server/auth/api";
import { startCampaign, resumeCampaign, retryStuckCampaign } from "@/server/services/CampaignService";
import { getCampaignById } from "@/server/integrations/db/campaigns-repo";

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/campaigns/[id]/start - Iniciar, reanudar o reintentar envío
// ─────────────────────────────────────────────────────────────────────────────
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireApiAuth();
  if (!auth.success) return auth.response;

  const { id: campaignId } = await params;

  // Leer body para ver si es un retry forzado
  let forceRetry = false;
  try {
    const body = await request.json();
    forceRetry = body.forceRetry === true;
  } catch {
    // Body vacío o inválido, ignorar
  }

  try {
    // Obtener campaña para determinar qué acción tomar
    const campaign = await getCampaignById(campaignId);
    if (!campaign) {
      return NextResponse.json({ error: "Campaña no encontrada" }, { status: 404 });
    }

    if (campaign.status === "paused") {
      // Reanudar campaña pausada
      await resumeCampaign(campaignId);
      return NextResponse.json({
        success: true,
        message: "Campaña reanudada. El envío continuará en breve.",
      });
    }

    if (campaign.status === "sending" && forceRetry) {
      // Reintentar campaña atascada
      await retryStuckCampaign(campaignId);
      return NextResponse.json({
        success: true,
        message: "Envío reprogramado. El tick se ejecutará en breve.",
      });
    }

    if (campaign.status === "sending") {
      return NextResponse.json({
        error: "La campaña ya está en envío. Si está atascada, usá forceRetry: true",
      }, { status: 400 });
    }

    // Iniciar campaña desde ready
    const sendRun = await startCampaign(campaignId);
    return NextResponse.json({
      success: true,
      sendRun,
      message: "Campaña iniciada. El envío comenzará en breve.",
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error desconocido";
    const status = message.includes("no encontrada")
      ? 404
      : message.includes("Solo se pueden") ||
          message.includes("Ya hay otra") ||
          message.includes("No hay")
        ? 400
        : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
