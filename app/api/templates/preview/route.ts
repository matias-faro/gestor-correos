import { NextRequest, NextResponse } from "next/server";
import { requireApiAuth } from "@/server/auth/api";
import { previewTemplateSchema } from "@/server/contracts/templates";
import { getContactById } from "@/server/integrations/db/contacts-repo";
import {
  renderHandlebarsTemplate,
  TemplatingError,
} from "@/server/domain/templating";

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/templates/preview - Previsualizar plantilla
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

  const parsed = previewTemplateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Datos inválidos", details: parsed.error.format() },
      { status: 400 }
    );
  }

  const { subjectTpl, htmlTpl, contactId, unsubscribeUrl } = parsed.data;

  // Obtener datos del contacto si se especificó
  let contactData: {
    FirstName?: string | null;
    LastName?: string | null;
    Company?: string | null;
  } = {};

  if (contactId) {
    const contact = await getContactById(contactId);
    if (!contact) {
      return NextResponse.json(
        { error: "Contacto no encontrado" },
        { status: 404 }
      );
    }
    contactData = {
      FirstName: contact.firstName,
      LastName: contact.lastName,
      Company: contact.company,
    };
  }

  // Renderizar con Handlebars
  try {
    const result = renderHandlebarsTemplate(
      { subjectTpl, htmlTpl },
      {
        ...contactData,
        UnsubscribeUrl: unsubscribeUrl ?? "https://example.com/unsubscribe/TOKEN",
      }
    );

    return NextResponse.json({
      subject: result.subject,
      html: result.html,
    });
  } catch (err) {
    if (err instanceof TemplatingError) {
      return NextResponse.json(
        { error: err.message, field: err.field },
        { status: 400 }
      );
    }
    const message = err instanceof Error ? err.message : "Error desconocido";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
