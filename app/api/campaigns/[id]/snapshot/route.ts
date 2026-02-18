import { NextRequest, NextResponse } from "next/server";
import { requireApiAuth } from "@/server/auth/api";
import { generateSnapshotSchema } from "@/server/contracts/campaigns";
import { generateSnapshot } from "@/server/services/CampaignService";

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/campaigns/[id]/snapshot - Generar snapshot
// ─────────────────────────────────────────────────────────────────────────────
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireApiAuth();
  if (!auth.success) return auth.response;

  const { id } = await params;

  let body: unknown = {};
  try {
    const text = await request.text();
    if (text) {
      body = JSON.parse(text);
    }
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const parsed = generateSnapshotSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Datos inválidos", details: parsed.error.format() },
      { status: 400 }
    );
  }

  try {
    const result = await generateSnapshot(id, { force: parsed.data.force });
    return NextResponse.json({
      success: true,
      created: result.created,
      capped: result.capped,
      message: result.capped
        ? `Se prepararon ${result.created} destinatarios (límite alcanzado)`
        : `Se prepararon ${result.created} destinatarios`,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error desconocido";
    const status = message.includes("no encontrada")
      ? 404
      : message.includes("Ya existen") || message.includes("Solo se puede")
        ? 400
        : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
