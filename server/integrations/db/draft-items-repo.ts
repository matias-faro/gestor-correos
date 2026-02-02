import { createServiceClient } from "@/lib/supabase/server";
import type {
  DraftItemResponse,
  DraftItemState,
  ListDraftItemsFilters,
  TestSendEventResponse,
} from "@/server/contracts/campaigns";

// ─────────────────────────────────────────────────────────────────────────────
// Tipos internos (DB)
// ─────────────────────────────────────────────────────────────────────────────
type DbDraftItem = {
  id: string;
  campaign_id: string;
  contact_id: string | null;
  to_email: string;
  rendered_subject: string;
  rendered_html: string;
  state: DraftItemState;
  included_manually: boolean;
  excluded_manually: boolean;
  error: string | null;
  created_at: string;
  updated_at: string;
};

type DbTestSendEvent = {
  id: string;
  campaign_id: string;
  contact_id: string | null;
  to_email: string;
  rendered_subject: string;
  rendered_html: string;
  created_at: string;
};

// ─────────────────────────────────────────────────────────────────────────────
// Mapear DB a respuesta
// ─────────────────────────────────────────────────────────────────────────────
function mapDraftItem(item: DbDraftItem): DraftItemResponse {
  return {
    id: item.id,
    campaignId: item.campaign_id,
    contactId: item.contact_id,
    toEmail: item.to_email,
    renderedSubject: item.rendered_subject,
    renderedHtml: item.rendered_html,
    state: item.state,
    includedManually: item.included_manually,
    excludedManually: item.excluded_manually,
    error: item.error,
    createdAt: item.created_at,
    updatedAt: item.updated_at,
  };
}

function mapTestSendEvent(event: DbTestSendEvent): TestSendEventResponse {
  return {
    id: event.id,
    campaignId: event.campaign_id,
    contactId: event.contact_id,
    toEmail: event.to_email,
    renderedSubject: event.rendered_subject,
    renderedHtml: event.rendered_html,
    createdAt: event.created_at,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Listar draft items de una campaña
// ─────────────────────────────────────────────────────────────────────────────
export async function listDraftItems(
  campaignId: string,
  filters: ListDraftItemsFilters
): Promise<{ draftItems: DraftItemResponse[]; total: number }> {
  const supabase = await createServiceClient();

  let query = supabase
    .from("draft_items")
    .select("*", { count: "exact" })
    .eq("campaign_id", campaignId);

  if (filters.query) {
    query = query.ilike("to_email", `%${filters.query}%`);
  }

  if (filters.state) {
    if (filters.state === "pending") {
      query = query.in("state", ["pending", "sending"]);
    } else {
      query = query.eq("state", filters.state);
    }
  }

  query = query
    .order("created_at", { ascending: true })
    .range(filters.offset, filters.offset + filters.limit - 1);

  const { data, error, count } = await query;

  if (error) {
    throw new Error(`Error al listar draft items: ${error.message}`);
  }

  return {
    draftItems: (data as DbDraftItem[]).map(mapDraftItem),
    total: count ?? 0,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Obtener draft item por ID
// ─────────────────────────────────────────────────────────────────────────────
export async function getDraftItemById(
  id: string
): Promise<DraftItemResponse | null> {
  const supabase = await createServiceClient();

  const { data, error } = await supabase
    .from("draft_items")
    .select("*")
    .eq("id", id)
    .single();

  if (error) {
    if (error.code === "PGRST116") return null;
    throw new Error(`Error al obtener draft item: ${error.message}`);
  }

  return mapDraftItem(data as DbDraftItem);
}

// ─────────────────────────────────────────────────────────────────────────────
// Contar draft items de una campaña
// ─────────────────────────────────────────────────────────────────────────────
export async function countDraftItems(campaignId: string): Promise<number> {
  const supabase = await createServiceClient();

  const { count, error } = await supabase
    .from("draft_items")
    .select("id", { count: "exact", head: true })
    .eq("campaign_id", campaignId);

  if (error) {
    throw new Error(`Error al contar draft items: ${error.message}`);
  }

  return count ?? 0;
}

// ─────────────────────────────────────────────────────────────────────────────
// Contar draft items por estados
// ─────────────────────────────────────────────────────────────────────────────
export async function countDraftItemsByStates(
  campaignId: string,
  states: DraftItemState[]
): Promise<number> {
  const supabase = await createServiceClient();

  const { count, error } = await supabase
    .from("draft_items")
    .select("id", { count: "exact", head: true })
    .eq("campaign_id", campaignId)
    .in("state", states);

  if (error) {
    throw new Error(`Error al contar draft items: ${error.message}`);
  }

  return count ?? 0;
}

// ─────────────────────────────────────────────────────────────────────────────
// Excluir draft item
// ─────────────────────────────────────────────────────────────────────────────
export async function excludeDraftItem(id: string): Promise<DraftItemResponse> {
  const supabase = await createServiceClient();

  const { data, error } = await supabase
    .from("draft_items")
    .update({
      state: "excluded",
      excluded_manually: true,
    })
    .eq("id", id)
    .select("*")
    .single();

  if (error) {
    if (error.code === "PGRST116") {
      throw new Error("Draft item no encontrado");
    }
    throw new Error(`Error al excluir draft item: ${error.message}`);
  }

  return mapDraftItem(data as DbDraftItem);
}

// ─────────────────────────────────────────────────────────────────────────────
// Incluir draft item (rehabilitar uno excluido)
// ─────────────────────────────────────────────────────────────────────────────
export async function includeDraftItem(id: string): Promise<DraftItemResponse> {
  const supabase = await createServiceClient();

  const { data, error } = await supabase
    .from("draft_items")
    .update({
      state: "pending",
      excluded_manually: false,
    })
    .eq("id", id)
    .select("*")
    .single();

  if (error) {
    if (error.code === "PGRST116") {
      throw new Error("Draft item no encontrado");
    }
    throw new Error(`Error al incluir draft item: ${error.message}`);
  }

  return mapDraftItem(data as DbDraftItem);
}

// ─────────────────────────────────────────────────────────────────────────────
// Buscar draft item por email en una campaña
// ─────────────────────────────────────────────────────────────────────────────
export async function findDraftItemByEmail(
  campaignId: string,
  email: string
): Promise<DraftItemResponse | null> {
  const supabase = await createServiceClient();

  const { data, error } = await supabase
    .from("draft_items")
    .select("*")
    .eq("campaign_id", campaignId)
    .eq("to_email", email.toLowerCase())
    .single();

  if (error) {
    if (error.code === "PGRST116") return null;
    throw new Error(`Error al buscar draft item: ${error.message}`);
  }

  return mapDraftItem(data as DbDraftItem);
}

// ─────────────────────────────────────────────────────────────────────────────
// Crear draft item (usado para snapshot e inclusión manual)
// ─────────────────────────────────────────────────────────────────────────────
export async function createDraftItem(input: {
  campaignId: string;
  contactId: string | null;
  toEmail: string;
  renderedSubject: string;
  renderedHtml: string;
  includedManually?: boolean;
}): Promise<DraftItemResponse> {
  const supabase = await createServiceClient();

  const { data, error } = await supabase
    .from("draft_items")
    .insert({
      campaign_id: input.campaignId,
      contact_id: input.contactId,
      to_email: input.toEmail.toLowerCase(),
      rendered_subject: input.renderedSubject,
      rendered_html: input.renderedHtml,
      state: "pending",
      included_manually: input.includedManually ?? false,
      excluded_manually: false,
    })
    .select("*")
    .single();

  if (error) {
    throw new Error(`Error al crear draft item: ${error.message}`);
  }

  return mapDraftItem(data as DbDraftItem);
}

// ─────────────────────────────────────────────────────────────────────────────
// Crear múltiples draft items en batch (para snapshot)
// ─────────────────────────────────────────────────────────────────────────────
export async function createDraftItemsBatch(
  items: Array<{
    campaignId: string;
    contactId: string | null;
    toEmail: string;
    renderedSubject: string;
    renderedHtml: string;
  }>
): Promise<number> {
  if (items.length === 0) return 0;

  const supabase = await createServiceClient();

  const rows = items.map((item) => ({
    campaign_id: item.campaignId,
    contact_id: item.contactId,
    to_email: item.toEmail.toLowerCase(),
    rendered_subject: item.renderedSubject,
    rendered_html: item.renderedHtml,
    state: "pending" as const,
    included_manually: false,
    excluded_manually: false,
  }));

  // Insertar en lotes de 500 para evitar límites
  const BATCH_SIZE = 500;
  let inserted = 0;

  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);
    const { error } = await supabase.from("draft_items").insert(batch);

    if (error) {
      throw new Error(`Error al crear draft items: ${error.message}`);
    }

    inserted += batch.length;
  }

  return inserted;
}

// ─────────────────────────────────────────────────────────────────────────────
// Eliminar todos los draft items de una campaña (para regenerar snapshot)
// ─────────────────────────────────────────────────────────────────────────────
export async function deleteDraftItemsForCampaign(
  campaignId: string
): Promise<void> {
  const supabase = await createServiceClient();

  const { error } = await supabase
    .from("draft_items")
    .delete()
    .eq("campaign_id", campaignId);

  if (error) {
    throw new Error(`Error al eliminar draft items: ${error.message}`);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Crear evento de test send
// ─────────────────────────────────────────────────────────────────────────────
export async function createTestSendEvent(input: {
  campaignId: string;
  contactId: string | null;
  toEmail: string;
  renderedSubject: string;
  renderedHtml: string;
}): Promise<TestSendEventResponse> {
  const supabase = await createServiceClient();

  const { data, error } = await supabase
    .from("test_send_events")
    .insert({
      campaign_id: input.campaignId,
      contact_id: input.contactId,
      to_email: input.toEmail.toLowerCase(),
      rendered_subject: input.renderedSubject,
      rendered_html: input.renderedHtml,
    })
    .select("*")
    .single();

  if (error) {
    throw new Error(`Error al crear test send event: ${error.message}`);
  }

  return mapTestSendEvent(data as DbTestSendEvent);
}

// ─────────────────────────────────────────────────────────────────────────────
// Listar eventos de test send de una campaña
// ─────────────────────────────────────────────────────────────────────────────
export async function listTestSendEvents(
  campaignId: string
): Promise<TestSendEventResponse[]> {
  const supabase = await createServiceClient();

  const { data, error } = await supabase
    .from("test_send_events")
    .select("*")
    .eq("campaign_id", campaignId)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(`Error al listar test send events: ${error.message}`);
  }

  return (data as DbTestSendEvent[]).map(mapTestSendEvent);
}

// ─────────────────────────────────────────────────────────────────────────────
// Obtener el próximo draft item pendiente de una campaña
// ─────────────────────────────────────────────────────────────────────────────
export async function getNextPendingDraftItem(
  campaignId: string
): Promise<DraftItemResponse | null> {
  const supabase = await createServiceClient();

  const { data, error } = await supabase
    .from("draft_items")
    .select("*")
    .eq("campaign_id", campaignId)
    .eq("state", "pending")
    .order("created_at", { ascending: true })
    .limit(1)
    .single();

  if (error) {
    if (error.code === "PGRST116") return null;
    throw new Error(`Error al obtener draft item pendiente: ${error.message}`);
  }

  return mapDraftItem(data as DbDraftItem);
}

// ─────────────────────────────────────────────────────────────────────────────
// Reclamar el próximo draft pendiente (atómico, evita duplicados)
// ─────────────────────────────────────────────────────────────────────────────
export async function claimNextPendingDraftItem(
  campaignId: string
): Promise<DraftItemResponse | null> {
  const supabase = await createServiceClient();

  const { data, error } = await supabase.rpc("claim_next_pending_draft_item", {
    p_campaign_id: campaignId,
  });

  if (error) {
    throw new Error(`Error al reclamar draft item: ${error.message}`);
  }

  const rows = Array.isArray(data) ? data : data ? [data] : [];
  if (rows.length === 0) return null;

  return mapDraftItem(rows[0] as DbDraftItem);
}

// ─────────────────────────────────────────────────────────────────────────────
// Marcar draft item como enviado
// ─────────────────────────────────────────────────────────────────────────────
export async function markDraftItemAsSent(id: string): Promise<void> {
  const supabase = await createServiceClient();

  const { error } = await supabase
    .from("draft_items")
    .update({ state: "sent" })
    .eq("id", id)
    .in("state", ["pending", "sending"]); // Solo si está pendiente/enviando (idempotencia)

  if (error) {
    throw new Error(`Error al marcar draft item como enviado: ${error.message}`);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Marcar draft item como fallido
// ─────────────────────────────────────────────────────────────────────────────
export async function markDraftItemAsFailed(
  id: string,
  errorMessage: string
): Promise<void> {
  const supabase = await createServiceClient();

  const { error } = await supabase
    .from("draft_items")
    .update({ state: "failed", error: errorMessage })
    .eq("id", id)
    .in("state", ["pending", "sending"]);

  if (error) {
    throw new Error(`Error al marcar draft item como fallido: ${error.message}`);
  }
}
