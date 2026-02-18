import { NextRequest, NextResponse } from "next/server";
import { requireApiAuth } from "@/server/auth/api";
import { getGoogleAccountByUserId } from "@/server/integrations/db/google-accounts-repo";
import { listSpreadsheets } from "@/server/integrations/google/drive";

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/google/spreadsheets - Listar spreadsheets accesibles
// ─────────────────────────────────────────────────────────────────────────────
export async function GET(request: NextRequest) {
  const auth = await requireApiAuth();
  if (!auth.success) return auth.response;

  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get("q") ?? undefined;

    const account = await getGoogleAccountByUserId(auth.user.id);
    if (!account) {
      return NextResponse.json(
        { error: "No hay cuenta de Google vinculada" },
        { status: 400 }
      );
    }

    const spreadsheets = await listSpreadsheets(account.id, {
      query,
      maxItems: 200,
    });

    return NextResponse.json({ spreadsheets });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error desconocido";

    // Error típico cuando el token no incluye los scopes de Drive/Sheets.
    if (message.toLowerCase().includes("insufficient authentication scopes")) {
      return NextResponse.json(
        {
          error:
            "Tu sesión de Google no tiene permisos suficientes para listar Google Sheets. Cerrá sesión y volvé a iniciar sesión aceptando los permisos de Drive/Sheets (o revocá el acceso de la app en tu cuenta de Google y reintentá).",
        },
        { status: 403 }
      );
    }

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
