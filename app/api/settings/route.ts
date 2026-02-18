import { NextRequest, NextResponse } from "next/server";
import { requireApiAuth } from "@/server/auth/api";
import {
  getSettings,
  updateSettings,
  type UpdateSettingsInput,
} from "@/server/integrations/db/settings-repo";

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/settings - Obtener configuración
// ─────────────────────────────────────────────────────────────────────────────
export async function GET() {
  const auth = await requireApiAuth();
  if (!auth.success) return auth.response;

  try {
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
  const auth = await requireApiAuth();
  if (!auth.success) return auth.response;

  try {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
    }

    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Payload inválido" }, { status: 400 });
    }

    const payload = body as Record<string, unknown>;
    const input: UpdateSettingsInput = {};

    // Validar y extraer campos permitidos
    if (typeof payload.dailyQuota === "number" && payload.dailyQuota > 0) {
      input.dailyQuota = payload.dailyQuota;
    }

    if (
      typeof payload.minDelaySeconds === "number" &&
      payload.minDelaySeconds >= 0
    ) {
      input.minDelaySeconds = payload.minDelaySeconds;
    }

    if (
      typeof payload.signatureDefaultHtml === "string" ||
      payload.signatureDefaultHtml === null
    ) {
      input.signatureDefaultHtml = payload.signatureDefaultHtml || null;
    }

    if (Array.isArray(payload.excludeKeywords)) {
      input.excludeKeywords = payload.excludeKeywords
        .filter((k: unknown) => typeof k === "string")
        .map((k) => k.trim().toLowerCase())
        .filter((k) => k.length > 0);
    }

    if (Array.isArray(payload.allowlistEmails)) {
      input.allowlistEmails = payload.allowlistEmails.filter(
        (e: unknown) => typeof e === "string" && e.includes("@")
      );
    }

    if (Array.isArray(payload.allowlistDomains)) {
      input.allowlistDomains = payload.allowlistDomains.filter(
        (d: unknown) => typeof d === "string" && d.length > 0
      );
    }

    if (payload.sendWindows && typeof payload.sendWindows === "object") {
      input.sendWindows = payload.sendWindows as UpdateSettingsInput["sendWindows"];
    }

    if (
      typeof payload.activeContactSourceId === "string" ||
      payload.activeContactSourceId === null
    ) {
      input.activeContactSourceId = payload.activeContactSourceId || null;
    }

    const updated = await updateSettings(input);
    return NextResponse.json(updated);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error desconocido";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
