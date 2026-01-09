import { NextRequest, NextResponse } from "next/server";
import { requireApiAuth } from "@/server/auth/api";
import {
  listTemplatesSchema,
  createTemplateSchema,
  updateTemplateSchema,
  deleteTemplateSchema,
} from "@/server/contracts/templates";
import {
  listTemplates,
  createTemplate,
  updateTemplate,
  deleteTemplate,
} from "@/server/integrations/db/templates-repo";

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/templates - Listar plantillas
// ─────────────────────────────────────────────────────────────────────────────
export async function GET(request: NextRequest) {
  const auth = await requireApiAuth();
  if (!auth.success) return auth.response;

  const { searchParams } = new URL(request.url);
  const filtersInput = {
    query: searchParams.get("query") ?? undefined,
  };

  const parsed = listTemplatesSchema.safeParse(filtersInput);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Parámetros inválidos", details: parsed.error.format() },
      { status: 400 }
    );
  }

  try {
    const templates = await listTemplates(parsed.data);
    return NextResponse.json({ templates });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error desconocido";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/templates - Crear plantilla
// ─────────────────────────────────────────────────────────────────────────────
export async function POST(request: NextRequest) {
  const auth = await requireApiAuth();
  if (!auth.success) return auth.response;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const parsed = createTemplateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Datos inválidos", details: parsed.error.format() },
      { status: 400 }
    );
  }

  try {
    const template = await createTemplate(parsed.data, auth.user.id);
    return NextResponse.json(template, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error desconocido";
    const status = message.includes("ya existe") ? 409 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /api/templates - Actualizar plantilla
// ─────────────────────────────────────────────────────────────────────────────
export async function PATCH(request: NextRequest) {
  const auth = await requireApiAuth();
  if (!auth.success) return auth.response;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const parsed = updateTemplateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Datos inválidos", details: parsed.error.format() },
      { status: 400 }
    );
  }

  try {
    const template = await updateTemplate(parsed.data);
    return NextResponse.json(template);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error desconocido";
    const status = message.includes("no encontrada")
      ? 404
      : message.includes("ya existe")
        ? 409
        : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// DELETE /api/templates - Borrar plantilla
// ─────────────────────────────────────────────────────────────────────────────
export async function DELETE(request: NextRequest) {
  const auth = await requireApiAuth();
  if (!auth.success) return auth.response;

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  const parsed = deleteTemplateSchema.safeParse({ id });
  if (!parsed.success) {
    return NextResponse.json(
      { error: "ID inválido", details: parsed.error.format() },
      { status: 400 }
    );
  }

  try {
    await deleteTemplate(parsed.data.id);
    return NextResponse.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error desconocido";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
