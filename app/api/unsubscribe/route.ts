import { NextRequest, NextResponse } from "next/server";

type UnsubscribeBody = { token: string };

/**
 * POST /api/unsubscribe
 *
 * Endpoint de compatibilidad: recibe un token y redirige a la página pública
 * que procesa la baja en 1 click. Útil para formularios legacy o integraciones.
 */
export async function POST(request: NextRequest) {
  const contentType = request.headers.get("content-type") ?? "";

  let body: UnsubscribeBody | null = null;
  try {
    if (contentType.includes("application/json")) {
      body = (await request.json()) as UnsubscribeBody;
    } else {
      const form = await request.formData();
      const token = form.get("token");
      body = { token: typeof token === "string" ? token : "" };
    }
  } catch {
    return NextResponse.json({ error: "Payload inválido" }, { status: 400 });
  }

  const token = body?.token?.trim();
  if (!token) {
    // Redirigir a página de error cuando no hay token
    const invalidUrl = new URL("/u/invalid", request.url);
    return NextResponse.redirect(invalidUrl);
  }

  // Redirigir a la página pública que procesa la baja en 1 click
  const unsubscribeUrl = new URL(`/u/${encodeURIComponent(token)}`, request.url);
  return NextResponse.redirect(unsubscribeUrl);
}
