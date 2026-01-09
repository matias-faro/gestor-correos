import { createServiceClient } from "@/lib/supabase/server";
import type {
  TemplateResponse,
  CreateTemplateInput,
  UpdateTemplateInput,
  ListTemplatesFilters,
} from "@/server/contracts/templates";

// ─────────────────────────────────────────────────────────────────────────────
// Tipos internos (DB)
// ─────────────────────────────────────────────────────────────────────────────
type DbTemplate = {
  id: string;
  name: string;
  subject_tpl: string;
  html_tpl: string;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

// ─────────────────────────────────────────────────────────────────────────────
// Mapear DB a respuesta
// ─────────────────────────────────────────────────────────────────────────────
function mapTemplate(template: DbTemplate): TemplateResponse {
  return {
    id: template.id,
    name: template.name,
    subjectTpl: template.subject_tpl,
    htmlTpl: template.html_tpl,
    createdBy: template.created_by,
    createdAt: template.created_at,
    updatedAt: template.updated_at,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Listar plantillas
// ─────────────────────────────────────────────────────────────────────────────
export async function listTemplates(
  filters?: ListTemplatesFilters
): Promise<TemplateResponse[]> {
  const supabase = await createServiceClient();

  let query = supabase
    .from("templates")
    .select("*")
    .order("created_at", { ascending: false });

  if (filters?.query) {
    query = query.ilike("name", `%${filters.query}%`);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`Error al listar plantillas: ${error.message}`);
  }

  return (data as DbTemplate[]).map(mapTemplate);
}

// ─────────────────────────────────────────────────────────────────────────────
// Obtener plantilla por ID
// ─────────────────────────────────────────────────────────────────────────────
export async function getTemplateById(
  id: string
): Promise<TemplateResponse | null> {
  const supabase = await createServiceClient();

  const { data, error } = await supabase
    .from("templates")
    .select("*")
    .eq("id", id)
    .single();

  if (error) {
    if (error.code === "PGRST116") return null;
    throw new Error(`Error al obtener plantilla: ${error.message}`);
  }

  return mapTemplate(data as DbTemplate);
}

// ─────────────────────────────────────────────────────────────────────────────
// Crear plantilla
// ─────────────────────────────────────────────────────────────────────────────
export async function createTemplate(
  input: CreateTemplateInput,
  createdByUserId?: string
): Promise<TemplateResponse> {
  const supabase = await createServiceClient();

  const { data, error } = await supabase
    .from("templates")
    .insert({
      name: input.name,
      subject_tpl: input.subjectTpl,
      html_tpl: input.htmlTpl,
      created_by: createdByUserId ?? null,
    })
    .select("*")
    .single();

  if (error) {
    if (error.code === "23505") {
      throw new Error(`El nombre "${input.name}" ya existe`);
    }
    throw new Error(`Error al crear plantilla: ${error.message}`);
  }

  return mapTemplate(data as DbTemplate);
}

// ─────────────────────────────────────────────────────────────────────────────
// Actualizar plantilla
// ─────────────────────────────────────────────────────────────────────────────
export async function updateTemplate(
  input: UpdateTemplateInput
): Promise<TemplateResponse> {
  const supabase = await createServiceClient();

  const updateData: Record<string, unknown> = {};
  if (input.name !== undefined) updateData.name = input.name;
  if (input.subjectTpl !== undefined) updateData.subject_tpl = input.subjectTpl;
  if (input.htmlTpl !== undefined) updateData.html_tpl = input.htmlTpl;

  const { data, error } = await supabase
    .from("templates")
    .update(updateData)
    .eq("id", input.id)
    .select("*")
    .single();

  if (error) {
    if (error.code === "PGRST116") {
      throw new Error("Plantilla no encontrada");
    }
    if (error.code === "23505") {
      throw new Error(`El nombre "${input.name}" ya existe`);
    }
    throw new Error(`Error al actualizar plantilla: ${error.message}`);
  }

  return mapTemplate(data as DbTemplate);
}

// ─────────────────────────────────────────────────────────────────────────────
// Borrar plantilla
// ─────────────────────────────────────────────────────────────────────────────
export async function deleteTemplate(id: string): Promise<void> {
  const supabase = await createServiceClient();

  const { error } = await supabase.from("templates").delete().eq("id", id);

  if (error) {
    throw new Error(`Error al borrar plantilla: ${error.message}`);
  }
}
