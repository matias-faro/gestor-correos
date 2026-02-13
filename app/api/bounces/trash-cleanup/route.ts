import { NextRequest, NextResponse } from "next/server";
import { requireApiAuth } from "@/server/auth/api";
import { scanTrashCleanupSchema } from "@/server/contracts/bounces";
import { scanTrashAndCleanupContacts } from "@/server/services/BounceService";

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/bounces/trash-cleanup
// Escanear rebotes en la Papelera y eliminar contactos cuyo email coincida
// ─────────────────────────────────────────────────────────────────────────────
export async function POST(request: NextRequest) {
  const auth = await requireApiAuth();
  if (!auth.success) return auth.response;

  let body: unknown = {};
  try {
    const text = await request.text();
    if (text) body = JSON.parse(text);
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const parsed = scanTrashCleanupSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Parámetros inválidos", details: parsed.error.format() },
      { status: 400 }
    );
  }

  try {
    const result = await scanTrashAndCleanupContacts(parsed.data, auth.user.id);
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error desconocido";
    console.error("[bounces/trash-cleanup] Error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

