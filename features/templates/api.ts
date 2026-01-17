import type {
  Template,
  TemplatesListResponse,
  PreviewResponse,
  PreviewInput,
} from "./types";

const API_BASE = "/api";

// ─────────────────────────────────────────────────────────────────────────────
// Listar plantillas
// ─────────────────────────────────────────────────────────────────────────────
export async function fetchTemplates(query?: string): Promise<Template[]> {
  const params = query ? `?query=${encodeURIComponent(query)}` : "";
  const res = await fetch(`${API_BASE}/templates${params}`, { cache: "no-store" });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error ?? "Error al cargar plantillas");
  }
  const data: TemplatesListResponse = await res.json();
  return data.templates;
}

// ─────────────────────────────────────────────────────────────────────────────
// Crear plantilla
// ─────────────────────────────────────────────────────────────────────────────
export async function createTemplate(input: {
  name: string;
  subjectTpl: string;
  htmlTpl: string;
}): Promise<Template> {
  const res = await fetch(`${API_BASE}/templates`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error ?? "Error al crear plantilla");
  }
  return res.json();
}

// ─────────────────────────────────────────────────────────────────────────────
// Actualizar plantilla
// ─────────────────────────────────────────────────────────────────────────────
export async function updateTemplate(input: {
  id: string;
  name?: string;
  subjectTpl?: string;
  htmlTpl?: string;
}): Promise<Template> {
  const res = await fetch(`${API_BASE}/templates`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error ?? "Error al actualizar plantilla");
  }
  return res.json();
}

// ─────────────────────────────────────────────────────────────────────────────
// Borrar plantilla
// ─────────────────────────────────────────────────────────────────────────────
export async function deleteTemplate(id: string): Promise<void> {
  const res = await fetch(`${API_BASE}/templates?id=${id}`, {
    method: "DELETE",
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error ?? "Error al eliminar plantilla");
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Preview de plantilla
// ─────────────────────────────────────────────────────────────────────────────
export async function previewTemplate(
  input: PreviewInput
): Promise<PreviewResponse> {
  const res = await fetch(`${API_BASE}/templates/preview`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error ?? "Error al previsualizar plantilla");
  }
  return res.json();
}
