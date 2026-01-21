import { NextRequest, NextResponse } from "next/server";
import { getAuthorizedUser } from "@/server/auth/session";
import {
  getSettings,
  updateSettings,
  type UpdateSettingsInput,
} from "@/server/integrations/db/settings-repo";

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/settings - Obtener configuración
// ─────────────────────────────────────────────────────────────────────────────
export async function GET() {
  try {
    await getAuthorizedUser();
    const settings = await getSettings();
    return NextResponse.json(settings);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error desconocido";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /api/settings - Actualizar configuración
// ─────────────────────────────────────────────────────────────────────────────
export async function PATCH(request: NextRequest) {
  try {
    await getAuthorizedUser();

    const body = await request.json();
    const input: UpdateSettingsInput = {};

    // Validar y extraer campos permitidos
    if (typeof body.dailyQuota === "number" && body.dailyQuota > 0) {
      input.dailyQuota = body.dailyQuota;
    }

    if (typeof body.minDelaySeconds === "number" && body.minDelaySeconds >= 0) {
      input.minDelaySeconds = body.minDelaySeconds;
    }

    if (typeof body.signatureDefaultHtml === "string" || body.signatureDefaultHtml === null) {
      input.signatureDefaultHtml = body.signatureDefaultHtml || null;
    }

    if (Array.isArray(body.allowlistEmails)) {
      input.allowlistEmails = body.allowlistEmails.filter(
        (e: unknown) => typeof e === "string" && e.includes("@")
      );
    }

    if (Array.isArray(body.allowlistDomains)) {
      input.allowlistDomains = body.allowlistDomains.filter(
        (d: unknown) => typeof d === "string" && d.length > 0
      );
    }

    if (body.sendWindows && typeof body.sendWindows === "object") {
      input.sendWindows = body.sendWindows;
    }

    if (
      typeof body.activeContactSourceId === "string" ||
      body.activeContactSourceId === null
    ) {
      input.activeContactSourceId = body.activeContactSourceId || null;
    }

    const updated = await updateSettings(input);
    return NextResponse.json(updated);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error desconocido";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
