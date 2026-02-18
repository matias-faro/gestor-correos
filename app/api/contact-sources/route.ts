import { NextRequest, NextResponse } from "next/server";
import { requireApiAuth } from "@/server/auth/api";
import {
  createContactSourceSchema,
} from "@/server/contracts/contact-sources";
import {
  createContactSource,
  listContactSources,
} from "@/server/integrations/db/contact-sources-repo";
import { getGoogleAccountByUserId } from "@/server/integrations/db/google-accounts-repo";

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/contact-sources - Listar fuentes
// ─────────────────────────────────────────────────────────────────────────────
export async function GET() {
  const auth = await requireApiAuth();
  if (!auth.success) return auth.response;

  try {
    const sources = await listContactSources();
    return NextResponse.json({ sources });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error desconocido";
    const status = message.includes("Ya existe una fuente") ? 409 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/contact-sources - Crear fuente
// ─────────────────────────────────────────────────────────────────────────────
export async function POST(request: NextRequest) {
  const auth = await requireApiAuth();
  if (!auth.success) return auth.response;

  try {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
    }

    const parsed = createContactSourceSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Datos inválidos", details: parsed.error.format() },
        { status: 400 }
      );
    }

    const account = await getGoogleAccountByUserId(auth.user.id);
    if (!account) {
      return NextResponse.json(
        { error: "No hay cuenta de Google vinculada" },
        { status: 400 }
      );
    }

    const source = await createContactSource({
      name: parsed.data.name,
      spreadsheetId: parsed.data.spreadsheetId,
      sheetTab: parsed.data.sheetTab ?? "Base de datos",
      googleAccountId: account.id,
    });

    return NextResponse.json(source, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error desconocido";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
