import Handlebars from "handlebars";

// ─────────────────────────────────────────────────────────────────────────────
// Tipos para las variables de plantilla
// ─────────────────────────────────────────────────────────────────────────────
export type TemplateVariables = {
  FirstName?: string | null;
  LastName?: string | null;
  Company?: string | null;
  UnsubscribeUrl?: string | null;
};

// ─────────────────────────────────────────────────────────────────────────────
// Resultado del renderizado
// ─────────────────────────────────────────────────────────────────────────────
export type RenderResult = {
  subject: string;
  html: string;
};

// ─────────────────────────────────────────────────────────────────────────────
// Error de templating (para transformar en 400)
// ─────────────────────────────────────────────────────────────────────────────
export class TemplatingError extends Error {
  constructor(
    message: string,
    public readonly field: "subject" | "html"
  ) {
    super(message);
    this.name = "TemplatingError";
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Renderizar plantilla con Handlebars
// ─────────────────────────────────────────────────────────────────────────────
export function renderHandlebarsTemplate(
  templates: { subjectTpl: string; htmlTpl: string },
  variables: TemplateVariables
): RenderResult {
  // Preparar contexto (convertir null a undefined para Handlebars)
  const context = {
    FirstName: variables.FirstName ?? undefined,
    LastName: variables.LastName ?? undefined,
    Company: variables.Company ?? undefined,
    UnsubscribeUrl: variables.UnsubscribeUrl ?? undefined,
  };

  let subject: string;
  let html: string;

  // Compilar y renderizar subject
  try {
    const subjectTemplate = Handlebars.compile(templates.subjectTpl);
    subject = subjectTemplate(context);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error desconocido";
    throw new TemplatingError(
      `Error al compilar el asunto: ${message}`,
      "subject"
    );
  }

  // Compilar y renderizar HTML
  try {
    const htmlTemplate = Handlebars.compile(templates.htmlTpl);
    html = htmlTemplate(context);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error desconocido";
    throw new TemplatingError(
      `Error al compilar el HTML: ${message}`,
      "html"
    );
  }

  return { subject, html };
}

// ─────────────────────────────────────────────────────────────────────────────
// Variables disponibles (para mostrar en UI)
// ─────────────────────────────────────────────────────────────────────────────
export const AVAILABLE_VARIABLES = [
  { name: "FirstName", description: "Nombre del contacto", example: "{{FirstName}}" },
  { name: "LastName", description: "Apellido del contacto", example: "{{LastName}}" },
  { name: "Company", description: "Empresa del contacto", example: "{{Company}}" },
  { name: "UnsubscribeUrl", description: "URL de baja", example: "{{UnsubscribeUrl}}" },
] as const;

// ─────────────────────────────────────────────────────────────────────────────
// Ejemplo de condicional para la UI
// ─────────────────────────────────────────────────────────────────────────────
export const CONDITIONAL_EXAMPLE = `{{#if FirstName}}Hola {{FirstName}}{{else}}Hola{{/if}}`;
