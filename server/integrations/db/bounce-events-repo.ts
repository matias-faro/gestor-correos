import { createServiceClient } from "@/lib/supabase/server";
import type { BounceEventResponse, ListBouncesFilters } from "@/server/contracts/bounces";

// ─────────────────────────────────────────────────────────────────────────────
// Tipos internos (DB)
// ─────────────────────────────────────────────────────────────────────────────
type DbBounceEvent = {
  id: string;
  detected_at: string;
  google_account_id: string | null;
  bounced_email: string;
  reason: string | null;
  gmail_message_id: string | null;
  gmail_permalink: string | null;
};

// ─────────────────────────────────────────────────────────────────────────────
// Mapear DB a respuesta
// ─────────────────────────────────────────────────────────────────────────────
function mapBounceEvent(data: DbBounceEvent): BounceEventResponse {
  return {
    id: data.id,
    detectedAt: data.detected_at,
    googleAccountId: data.google_account_id,
    bouncedEmail: data.bounced_email,
    reason: data.reason,
    gmailMessageId: data.gmail_message_id,
    gmailPermalink: data.gmail_permalink,
  };
}

async function getBounceEventByMessageId(
  gmailMessageId: string
): Promise<BounceEventResponse | null> {
  const supabase = await createServiceClient();

  const { data, error } = await supabase
    .from("bounce_events")
    .select("*")
    .eq("gmail_message_id", gmailMessageId)
    .single();

  if (error) {
    if (error.code === "PGRST116") return null;
    throw new Error(`Error al obtener bounce event: ${error.message}`);
  }

  return mapBounceEvent(data as DbBounceEvent);
}

// ─────────────────────────────────────────────────────────────────────────────
// Listar bounce events con paginación
// ─────────────────────────────────────────────────────────────────────────────
export async function listBounceEvents(
  filters: ListBouncesFilters
): Promise<{ bounces: BounceEventResponse[]; total: number }> {
  const supabase = await createServiceClient();

  const { data, error, count } = await supabase
    .from("bounce_events")
    .select("*", { count: "exact" })
    .order("detected_at", { ascending: false })
    .range(filters.offset, filters.offset + filters.limit - 1);

  if (error) {
    throw new Error(`Error al listar bounce events: ${error.message}`);
  }

  return {
    bounces: (data as DbBounceEvent[]).map(mapBounceEvent),
    total: count ?? 0,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Verificar si ya existe un bounce event por gmail_message_id (idempotencia)
// ─────────────────────────────────────────────────────────────────────────────
export async function hasBounceEventByMessageId(
  gmailMessageId: string
): Promise<boolean> {
  const supabase = await createServiceClient();

  const { count, error } = await supabase
    .from("bounce_events")
    .select("id", { count: "exact", head: true })
    .eq("gmail_message_id", gmailMessageId);

  if (error) {
    throw new Error(`Error al verificar bounce event: ${error.message}`);
  }

  return (count ?? 0) > 0;
}

// ─────────────────────────────────────────────────────────────────────────────
// Insertar un bounce event
// ─────────────────────────────────────────────────────────────────────────────
export async function insertBounceEvent(input: {
  googleAccountId: string | null;
  bouncedEmail: string;
  reason: string | null;
  gmailMessageId: string | null;
  gmailPermalink: string | null;
}): Promise<BounceEventResponse> {
  const supabase = await createServiceClient();

  const { data, error } = await supabase
    .from("bounce_events")
    .insert({
      google_account_id: input.googleAccountId,
      bounced_email: input.bouncedEmail.toLowerCase().trim(),
      reason: input.reason,
      gmail_message_id: input.gmailMessageId,
      gmail_permalink: input.gmailPermalink,
    })
    .select("*")
    .single();

  if (error) {
    if (error.code === "23505" && input.gmailMessageId) {
      const existing = await getBounceEventByMessageId(input.gmailMessageId);
      if (existing) return existing;
    }
    throw new Error(`Error al insertar bounce event: ${error.message}`);
  }

  return mapBounceEvent(data as DbBounceEvent);
}

// ─────────────────────────────────────────────────────────────────────────────
// Contar total de bounce events
// ─────────────────────────────────────────────────────────────────────────────
export async function countBounceEvents(): Promise<number> {
  const supabase = await createServiceClient();

  const { count, error } = await supabase
    .from("bounce_events")
    .select("id", { count: "exact", head: true });

  if (error) {
    throw new Error(`Error al contar bounce events: ${error.message}`);
  }

  return count ?? 0;
}

// ─────────────────────────────────────────────────────────────────────────────
// Obtener bounce events por ids (para acciones masivas)
// ─────────────────────────────────────────────────────────────────────────────
export async function getBounceEventsByIds(
  ids: string[]
): Promise<BounceEventResponse[]> {
  if (ids.length === 0) return [];

  const supabase = await createServiceClient();

  const { data, error } = await supabase
    .from("bounce_events")
    .select("*")
    .in("id", ids);

  if (error) {
    throw new Error(`Error al obtener bounce events: ${error.message}`);
  }

  return (data as DbBounceEvent[]).map(mapBounceEvent);
}

// ─────────────────────────────────────────────────────────────────────────────
// Eliminar bounce events por ids (para acciones masivas)
// ─────────────────────────────────────────────────────────────────────────────
export async function deleteBounceEventsByIds(ids: string[]): Promise<number> {
  if (ids.length === 0) return 0;

  const supabase = await createServiceClient();

  const { data, error } = await supabase
    .from("bounce_events")
    .delete()
    .in("id", ids)
    .select("id");

  if (error) {
    throw new Error(`Error al eliminar bounce events: ${error.message}`);
  }

  return data?.length ?? 0;
}
