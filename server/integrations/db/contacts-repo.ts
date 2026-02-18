import { createServiceClient } from "@/lib/supabase/server";
import type {
  ContactResponse,
  ContactsFilters,
  CreateContactInput,
  UpdateContactInput,
} from "@/server/contracts/contacts";

// ─────────────────────────────────────────────────────────────────────────────
// Tipos internos
// ─────────────────────────────────────────────────────────────────────────────
type DbContact = {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  company: string | null;
  position: string | null;
  extra: Record<string, unknown> | null;
  subscription_status: "active" | "unsubscribed";
  suppression_status: "none" | "bounced";
  created_at: string;
  updated_at: string;
};

type DbContactInSource = DbContact & {
  source_id: string;
};

type DbTag = {
  id: string;
  name: string;
  kind: "tipo" | "rubro";
};

// ─────────────────────────────────────────────────────────────────────────────
// Mapear DB a respuesta
// ─────────────────────────────────────────────────────────────────────────────
function mapContact(
  contact: DbContact,
  tags: DbTag[] = []
): ContactResponse {
  return {
    id: contact.id,
    email: contact.email,
    firstName: contact.first_name,
    lastName: contact.last_name,
    company: contact.company,
    position: contact.position,
    extra: contact.extra,
    subscriptionStatus: contact.subscription_status,
    suppressionStatus: contact.suppression_status,
    tags: tags.map((t) => ({ id: t.id, name: t.name, kind: t.kind })),
    createdAt: contact.created_at,
    updatedAt: contact.updated_at,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Listar contactos con filtros (tags AND estricto)
// ─────────────────────────────────────────────────────────────────────────────
export async function listContacts(
  filters: ContactsFilters
): Promise<{ contacts: ContactResponse[]; total: number }> {
  const supabase = await createServiceClient();

  // Base query
  let query = supabase.from("contacts").select("*", { count: "exact" });

  if (filters.sourceId) {
    query = supabase
      .from("contacts_in_source")
      .select("*", { count: "exact" })
      .eq("source_id", filters.sourceId);
  }

  // Filtro texto (email, first_name, last_name)
  if (filters.query) {
    const pattern = `%${filters.query}%`;
    query = query.or(
      `email.ilike.${pattern},first_name.ilike.${pattern},last_name.ilike.${pattern}`
    );
  }

  // Filtro company
  if (filters.company) {
    query = query.ilike("company", `%${filters.company}%`);
  }

  // Filtro position
  if (filters.position) {
    query = query.ilike("position", `%${filters.position}%`);
  }

  // Excluir unsubscribed (por defecto)
  if (!filters.includeUnsubscribed) {
    query = query.eq("subscription_status", "active");
  }

  // Excluir suppressed (por defecto)
  if (!filters.includeSuppressed) {
    query = query.eq("suppression_status", "none");
  }

  // Filtro por tags (AND estricto): necesitamos IDs de contactos que tengan TODOS los tags
  if (filters.tagIds && filters.tagIds.length > 0) {
    const contactIdsWithAllTags = await getContactIdsWithAllTags(filters.tagIds);
    if (contactIdsWithAllTags.length === 0) {
      return { contacts: [], total: 0 };
    }
    query = query.in("id", contactIdsWithAllTags);
  }

  // Ordenar y paginar
  query = query
    .order("created_at", { ascending: false })
    .range(filters.offset, filters.offset + filters.limit - 1);

  const { data, error, count } = await query;

  if (error) {
    throw new Error(`Error al listar contactos: ${error.message}`);
  }

  const contacts = data as DbContact[] | DbContactInSource[];
  const contactIds = contacts.map((c) => c.id);

  // Obtener tags de todos los contactos en una sola query
  const tagsByContact = await getTagsForContacts(contactIds);

  const result = contacts.map((contact) =>
    mapContact(contact, tagsByContact.get(contact.id) ?? [])
  );

  return { contacts: result, total: count ?? 0 };
}

// ─────────────────────────────────────────────────────────────────────────────
// Obtener IDs de contactos que tienen TODOS los tags especificados (AND)
// ─────────────────────────────────────────────────────────────────────────────
async function getContactIdsWithAllTags(tagIds: string[]): Promise<string[]> {
  if (tagIds.length === 0) return [];

  const supabase = await createServiceClient();

  // Contamos cuántos de los tags requeridos tiene cada contacto
  // Solo devolvemos los que tienen exactamente todos
  const { data, error } = await supabase
    .from("contact_tags")
    .select("contact_id")
    .in("tag_id", tagIds);

  if (error) {
    throw new Error(`Error al filtrar por tags: ${error.message}`);
  }

  // Contar ocurrencias por contact_id
  const countMap = new Map<string, number>();
  for (const row of data ?? []) {
    const id = row.contact_id as string;
    countMap.set(id, (countMap.get(id) ?? 0) + 1);
  }

  // Solo los que tienen todos
  const result: string[] = [];
  for (const [contactId, cnt] of countMap) {
    if (cnt >= tagIds.length) {
      result.push(contactId);
    }
  }

  return result;
}

// ─────────────────────────────────────────────────────────────────────────────
// Obtener tags para múltiples contactos
// ─────────────────────────────────────────────────────────────────────────────
async function getTagsForContacts(
  contactIds: string[]
): Promise<Map<string, DbTag[]>> {
  if (contactIds.length === 0) return new Map();

  const supabase = await createServiceClient();

  const { data, error } = await supabase
    .from("contact_tags")
    .select("contact_id, tags(id, name, kind)")
    .in("contact_id", contactIds);

  if (error) {
    throw new Error(`Error al obtener tags de contactos: ${error.message}`);
  }

  const result = new Map<string, DbTag[]>();

  for (const row of data ?? []) {
    const contactId = row.contact_id as string;
    // Supabase devuelve un objeto para relaciones many-to-one
    const tag = row.tags as unknown as DbTag | null;
    if (tag) {
      if (!result.has(contactId)) {
        result.set(contactId, []);
      }
      result.get(contactId)!.push(tag);
    }
  }

  return result;
}

// ─────────────────────────────────────────────────────────────────────────────
// Obtener un contacto por ID
// ─────────────────────────────────────────────────────────────────────────────
export async function getContactById(id: string): Promise<ContactResponse | null> {
  const supabase = await createServiceClient();

  const { data, error } = await supabase
    .from("contacts")
    .select("*")
    .eq("id", id)
    .single();

  if (error) {
    if (error.code === "PGRST116") return null;
    throw new Error(`Error al obtener contacto: ${error.message}`);
  }

  const contact = data as DbContact;
  const tagsMap = await getTagsForContacts([id]);

  return mapContact(contact, tagsMap.get(id) ?? []);
}

// ─────────────────────────────────────────────────────────────────────────────
// Obtener info mínima para unsubscribe (ruta pública)
// ─────────────────────────────────────────────────────────────────────────────
export async function getContactForUnsubscribe(id: string): Promise<{
  id: string;
  email: string;
  subscriptionStatus: "active" | "unsubscribed";
} | null> {
  const supabase = await createServiceClient();

  const { data, error } = await supabase
    .from("contacts")
    .select("id, email, subscription_status")
    .eq("id", id)
    .single();

  if (error) {
    if (error.code === "PGRST116") return null;
    throw new Error(`Error al obtener contacto (unsubscribe): ${error.message}`);
  }

  return {
    id: data.id as string,
    email: data.email as string,
    subscriptionStatus: data.subscription_status as "active" | "unsubscribed",
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Marcar un contacto como unsubscribed (idempotente)
// ─────────────────────────────────────────────────────────────────────────────
export async function setContactUnsubscribed(id: string): Promise<void> {
  const supabase = await createServiceClient();

  const { error } = await supabase
    .from("contacts")
    .update({ subscription_status: "unsubscribed" })
    .eq("id", id);

  if (error) {
    throw new Error(`Error al marcar contacto como unsubscribed: ${error.message}`);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Crear contacto
// ─────────────────────────────────────────────────────────────────────────────
export async function createContact(
  input: CreateContactInput
): Promise<ContactResponse> {
  const supabase = await createServiceClient();

  const { data, error } = await supabase
    .from("contacts")
    .insert({
      email: input.email,
      first_name: input.firstName ?? null,
      last_name: input.lastName ?? null,
      company: input.company ?? null,
      position: input.position ?? null,
      extra: input.extra ?? null,
    })
    .select("*")
    .single();

  if (error) {
    if (error.code === "23505") {
      throw new Error(`El email "${input.email}" ya existe`);
    }
    throw new Error(`Error al crear contacto: ${error.message}`);
  }

  const contact = data as DbContact;

  // Asignar tags si se proporcionan
  if (input.tagIds && input.tagIds.length > 0) {
    await syncContactTags(contact.id, input.tagIds);
  }

  const tagsMap = await getTagsForContacts([contact.id]);
  return mapContact(contact, tagsMap.get(contact.id) ?? []);
}

// ─────────────────────────────────────────────────────────────────────────────
// Actualizar contacto
// ─────────────────────────────────────────────────────────────────────────────
export async function updateContact(
  input: UpdateContactInput
): Promise<ContactResponse> {
  const supabase = await createServiceClient();

  // Construir objeto de actualización solo con campos presentes
  const updateData: Record<string, unknown> = {};
  if (input.email !== undefined) updateData.email = input.email;
  if (input.firstName !== undefined) updateData.first_name = input.firstName;
  if (input.lastName !== undefined) updateData.last_name = input.lastName;
  if (input.company !== undefined) updateData.company = input.company;
  if (input.position !== undefined) updateData.position = input.position;
  if (input.extra !== undefined) updateData.extra = input.extra;
  if (input.subscriptionStatus !== undefined) {
    updateData.subscription_status = input.subscriptionStatus;
  }

  const { data, error } = await supabase
    .from("contacts")
    .update(updateData)
    .eq("id", input.id)
    .select("*")
    .single();

  if (error) {
    if (error.code === "PGRST116") {
      throw new Error("Contacto no encontrado");
    }
    if (error.code === "23505") {
      throw new Error(`El email "${input.email}" ya existe`);
    }
    throw new Error(`Error al actualizar contacto: ${error.message}`);
  }

  const contact = data as DbContact;

  // Sincronizar tags si se proporcionan
  if (input.tagIds !== undefined) {
    await syncContactTags(contact.id, input.tagIds);
  }

  const tagsMap = await getTagsForContacts([contact.id]);
  return mapContact(contact, tagsMap.get(contact.id) ?? []);
}

// ─────────────────────────────────────────────────────────────────────────────
// Sincronizar tags de un contacto (reemplaza todos)
// ─────────────────────────────────────────────────────────────────────────────
async function syncContactTags(
  contactId: string,
  tagIds: string[]
): Promise<void> {
  const supabase = await createServiceClient();

  // Borrar todos los tags actuales
  await supabase.from("contact_tags").delete().eq("contact_id", contactId);

  // Insertar los nuevos
  if (tagIds.length > 0) {
    const rows = tagIds.map((tagId) => ({
      contact_id: contactId,
      tag_id: tagId,
    }));

    const { error } = await supabase.from("contact_tags").insert(rows);

    if (error) {
      throw new Error(`Error al asignar tags: ${error.message}`);
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Borrar contacto
// ─────────────────────────────────────────────────────────────────────────────
export async function deleteContact(id: string): Promise<void> {
  const supabase = await createServiceClient();

  const { error } = await supabase.from("contacts").delete().eq("id", id);

  if (error) {
    throw new Error(`Error al borrar contacto: ${error.message}`);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Listar todos los contactos del segmento (para snapshot, sin paginación, con cap)
// ─────────────────────────────────────────────────────────────────────────────
export type SnapshotContact = {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  company: string | null;
};

export type SnapshotFilters = {
  query?: string;
  company?: string;
  position?: string;
  tagIds?: string[];
  sourceId?: string;
  excludeKeywords?: string[];
};

const SNAPSHOT_CAP = 20000;

export async function listContactsForSnapshot(
  filters: SnapshotFilters
): Promise<{ contacts: SnapshotContact[]; capped: boolean }> {
  const supabase = await createServiceClient();

  // Base query - solo contactos activos y no suprimidos
  let query = supabase
    .from("contacts")
    .select("id, email, first_name, last_name, company")
    .eq("subscription_status", "active")
    .eq("suppression_status", "none");

  if (filters.sourceId) {
    query = supabase
      .from("contacts_in_source")
      .select("id, email, first_name, last_name, company")
      .eq("source_id", filters.sourceId)
      .eq("subscription_status", "active")
      .eq("suppression_status", "none");
  }

  // Filtro texto
  if (filters.query) {
    const pattern = `%${filters.query}%`;
    query = query.or(
      `email.ilike.${pattern},first_name.ilike.${pattern},last_name.ilike.${pattern}`
    );
  }

  // Filtro company
  if (filters.company) {
    query = query.ilike("company", `%${filters.company}%`);
  }

  // Filtro position
  if (filters.position) {
    query = query.ilike("position", `%${filters.position}%`);
  }

  // Excluir contactos por keywords en email (ej: no-reply, dominio propio, etc.)
  if (filters.excludeKeywords && filters.excludeKeywords.length > 0) {
    for (const keyword of filters.excludeKeywords) {
      const normalizedKeyword = keyword.trim();
      if (!normalizedKeyword) continue;
      query = query.not("email", "ilike", `%${normalizedKeyword}%`);
    }
  }

  // Filtro por tags (AND estricto)
  if (filters.tagIds && filters.tagIds.length > 0) {
    const contactIdsWithAllTags = await getContactIdsWithAllTags(filters.tagIds);
    if (contactIdsWithAllTags.length === 0) {
      return { contacts: [], capped: false };
    }
    query = query.in("id", contactIdsWithAllTags);
  }

  // Aplicar cap + 1 para detectar si excede
  query = query.order("created_at", { ascending: true }).limit(SNAPSHOT_CAP + 1);

  const { data, error } = await query;

  if (error) {
    throw new Error(`Error al listar contactos para snapshot: ${error.message}`);
  }

  const contacts = data as Array<{
    id: string;
    email: string;
    first_name: string | null;
    last_name: string | null;
    company: string | null;
  }>;

  const capped = contacts.length > SNAPSHOT_CAP;
  const result = (capped ? contacts.slice(0, SNAPSHOT_CAP) : contacts).map(
    (c) => ({
      id: c.id,
      email: c.email,
      firstName: c.first_name,
      lastName: c.last_name,
      company: c.company,
    })
  );

  return { contacts: result, capped };
}

// ─────────────────────────────────────────────────────────────────────────────
// Marcar contactos como bounced por lista de emails (batch, idempotente)
// ─────────────────────────────────────────────────────────────────────────────
export async function setContactsBouncedByEmails(
  emails: string[]
): Promise<number> {
  if (emails.length === 0) return 0;

  const supabase = await createServiceClient();

  // Normalizar emails
  const normalizedEmails = emails.map((e) => e.toLowerCase().trim());

  // Actualizar solo los que no estén ya como bounced
  const { data, error } = await supabase
    .from("contacts")
    .update({ suppression_status: "bounced" })
    .in("email", normalizedEmails)
    .neq("suppression_status", "bounced")
    .select("id");

  if (error) {
    throw new Error(`Error al suprimir contactos por bounce: ${error.message}`);
  }

  return data?.length ?? 0;
}

// ─────────────────────────────────────────────────────────────────────────────
// Eliminar contactos por lista de emails (batch)
// ─────────────────────────────────────────────────────────────────────────────
export async function deleteContactsByEmails(emails: string[]): Promise<number> {
  if (emails.length === 0) return 0;

  const supabase = await createServiceClient();
  const normalizedEmails = emails.map((e) => e.toLowerCase().trim());

  const { data, error } = await supabase
    .from("contacts")
    .delete()
    .in("email", normalizedEmails)
    .select("id");

  if (error) {
    throw new Error(`Error al eliminar contactos por email: ${error.message}`);
  }

  return data?.length ?? 0;
}
