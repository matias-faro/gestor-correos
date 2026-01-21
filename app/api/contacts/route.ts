import { NextRequest, NextResponse } from "next/server";
import { requireApiAuth } from "@/server/auth/api";
import {
  contactsFiltersSchema,
  createContactSchema,
  updateContactSchema,
  deleteContactSchema,
} from "@/server/contracts/contacts";
import {
  listContacts,
  createContact,
  updateContact,
  deleteContact,
} from "@/server/integrations/db/contacts-repo";

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/contacts - Listar contactos con filtros
// ─────────────────────────────────────────────────────────────────────────────
export async function GET(request: NextRequest) {
  const auth = await requireApiAuth();
  if (!auth.success) return auth.response;

  const { searchParams } = new URL(request.url);

  // Parsear tagIds desde query string (puede venir como "tagIds=id1,id2" o múltiples "tagIds=id1&tagIds=id2")
  const tagIdsRaw = searchParams.getAll("tagIds");
  const tagIds =
    tagIdsRaw.length === 1 && tagIdsRaw[0].includes(",")
      ? tagIdsRaw[0].split(",").filter(Boolean)
      : tagIdsRaw.filter(Boolean);

  const filtersInput = {
    query: searchParams.get("query") ?? undefined,
    company: searchParams.get("company") ?? undefined,
    position: searchParams.get("position") ?? undefined,
    tagIds: tagIds.length > 0 ? tagIds : undefined,
    sourceId: searchParams.get("sourceId") ?? undefined,
    includeUnsubscribed: searchParams.get("includeUnsubscribed") === "true",
    includeSuppressed: searchParams.get("includeSuppressed") === "true",
    limit: searchParams.get("limit") ?? undefined,
    offset: searchParams.get("offset") ?? undefined,
  };

  const parsed = contactsFiltersSchema.safeParse(filtersInput);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Parámetros inválidos", details: parsed.error.format() },
      { status: 400 }
    );
  }

  try {
    const { contacts, total } = await listContacts(parsed.data);
    return NextResponse.json({
      contacts,
      total,
      limit: parsed.data.limit,
      offset: parsed.data.offset,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error desconocido";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/contacts - Crear contacto
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

  const parsed = createContactSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Datos inválidos", details: parsed.error.format() },
      { status: 400 }
    );
  }

  try {
    const contact = await createContact(parsed.data);
    return NextResponse.json(contact, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error desconocido";
    const status = message.includes("ya existe") ? 409 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /api/contacts - Actualizar contacto
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

  const parsed = updateContactSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Datos inválidos", details: parsed.error.format() },
      { status: 400 }
    );
  }

  try {
    const contact = await updateContact(parsed.data);
    return NextResponse.json(contact);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error desconocido";
    const status = message.includes("no encontrado")
      ? 404
      : message.includes("ya existe")
        ? 409
        : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// DELETE /api/contacts - Borrar contacto
// ─────────────────────────────────────────────────────────────────────────────
export async function DELETE(request: NextRequest) {
  const auth = await requireApiAuth();
  if (!auth.success) return auth.response;

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  const parsed = deleteContactSchema.safeParse({ id });
  if (!parsed.success) {
    return NextResponse.json(
      { error: "ID inválido", details: parsed.error.format() },
      { status: 400 }
    );
  }

  try {
    await deleteContact(parsed.data.id);
    return NextResponse.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error desconocido";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
