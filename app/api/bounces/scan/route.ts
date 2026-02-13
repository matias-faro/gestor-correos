import { NextRequest, NextResponse } from "next/server";
import { requireApiAuth } from "@/server/auth/api";
import { scanBouncesSchema } from "@/server/contracts/bounces";
import { scanBounces } from "@/server/services/BounceService";

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/bounces/scan - Escanear rebotes en el buzón de correo
// ─────────────────────────────────────────────────────────────────────────────
export async function POST(request: NextRequest) {
  const auth = await requireApiAuth();
  if (!auth.success) return auth.response;

  let body: unknown = {};
  try {
    const text = await request.text();
    if (text) {
      body = JSON.parse(text);
    }
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const parsed = scanBouncesSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Parámetros inválidos", details: parsed.error.format() },
      { status: 400 }
    );
  }

  try {
    console.log("[bounces/scan] Request", { ...parsed.data, userId: auth.user.id });
    const result = await scanBounces(parsed.data, auth.user.id);
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error desconocido";
    console.error("[bounces/scan] Error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
