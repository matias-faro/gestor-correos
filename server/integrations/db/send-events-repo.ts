import { createServiceClient } from "@/lib/supabase/server";
import type { SendEventResponse, SendEventStatus } from "@/server/contracts/campaigns";

// ─────────────────────────────────────────────────────────────────────────────
// Tipos internos (DB)
// ─────────────────────────────────────────────────────────────────────────────
type DbSendEvent = {
  id: string;
  campaign_id: string;
  draft_item_id: string;
  sent_at: string;
  gmail_message_id: string | null;
  gmail_thread_id: string | null;
  gmail_permalink: string | null;
  status: SendEventStatus;
  error: string | null;
};

type DbSendEventWithDraft = DbSendEvent & {
  draft_items: {
    to_email: string;
    rendered_subject: string;
  } | null;
};

// ─────────────────────────────────────────────────────────────────────────────
// Mapear DB a respuesta
// ─────────────────────────────────────────────────────────────────────────────
function mapSendEvent(data: DbSendEvent): SendEventResponse {
  return {
    id: data.id,
    campaignId: data.campaign_id,
    draftItemId: data.draft_item_id,
    sentAt: data.sent_at,
    gmailMessageId: data.gmail_message_id,
    gmailThreadId: data.gmail_thread_id,
    gmailPermalink: data.gmail_permalink,
    status: data.status,
    error: data.error,
  };
}

export type SendEventWithDraftMeta = SendEventResponse & {
  toEmail: string | null;
  renderedSubject: string | null;
};

function mapSendEventWithDraftMeta(data: DbSendEventWithDraft): SendEventWithDraftMeta {
  const event = mapSendEvent(data);
  return {
    ...event,
    toEmail: data.draft_items?.to_email ?? null,
    renderedSubject: data.draft_items?.rendered_subject ?? null,
  };
}

async function getSendEventByDraftItemId(
  draftItemId: string
): Promise<SendEventResponse | null> {
  const supabase = await createServiceClient();

  const { data, error } = await supabase
    .from("send_events")
    .select("*")
    .eq("draft_item_id", draftItemId)
    .single();

  if (error) {
    if (error.code === "PGRST116") return null;
    throw new Error(`Error al obtener send event: ${error.message}`);
  }

  return mapSendEvent(data as DbSendEvent);
}

// ─────────────────────────────────────────────────────────────────────────────
// Crear evento de envío exitoso
// ─────────────────────────────────────────────────────────────────────────────
export async function createSendEventSuccess(input: {
  campaignId: string;
  draftItemId: string;
  gmailMessageId: string;
  gmailThreadId: string | null;
  gmailPermalink: string | null;
}): Promise<SendEventResponse> {
  const supabase = await createServiceClient();

  const { data, error } = await supabase
    .from("send_events")
    .upsert({
      campaign_id: input.campaignId,
      draft_item_id: input.draftItemId,
      gmail_message_id: input.gmailMessageId,
      gmail_thread_id: input.gmailThreadId,
      gmail_permalink: input.gmailPermalink,
      status: "sent",
    }, { onConflict: "draft_item_id" })
    .select("*")
    .single();

  if (error) {
    throw new Error(`Error al crear send event: ${error.message}`);
  }

  return mapSendEvent(data as DbSendEvent);
}

// ─────────────────────────────────────────────────────────────────────────────
// Crear evento de envío fallido
// ─────────────────────────────────────────────────────────────────────────────
export async function createSendEventFailure(input: {
  campaignId: string;
  draftItemId: string;
  error: string;
}): Promise<SendEventResponse> {
  const existing = await getSendEventByDraftItemId(input.draftItemId);
  if (existing?.status === "sent") {
    return existing;
  }

  const supabase = await createServiceClient();

  const { data, error } = await supabase
    .from("send_events")
    .upsert({
      campaign_id: input.campaignId,
      draft_item_id: input.draftItemId,
      status: "failed",
      error: input.error,
    }, { onConflict: "draft_item_id" })
    .select("*")
    .single();

  if (error) {
    throw new Error(`Error al crear send event: ${error.message}`);
  }

  return mapSendEvent(data as DbSendEvent);
}

// ─────────────────────────────────────────────────────────────────────────────
// Contar envíos del día para una campaña (para cuota)
// ─────────────────────────────────────────────────────────────────────────────
export async function countTodaySendEvents(timezone: string): Promise<number> {
  const supabase = await createServiceClient();

  // Calcular inicio del día en la timezone especificada
  const now = new Date();
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const todayStr = formatter.format(now); // "2024-01-15"

  // Convertir a timestamp UTC del inicio del día en esa timezone
  const startOfDayLocal = new Date(`${todayStr}T00:00:00`);
  const startOfDayUTC = new Date(
    startOfDayLocal.toLocaleString("en-US", { timeZone: timezone })
  );

  const { count, error } = await supabase
    .from("send_events")
    .select("id", { count: "exact", head: true })
    .eq("status", "sent")
    .gte("sent_at", startOfDayUTC.toISOString());

  if (error) {
    throw new Error(`Error al contar envíos del día: ${error.message}`);
  }

  return count ?? 0;
}

// ─────────────────────────────────────────────────────────────────────────────
// Listar send events de una campaña
// ─────────────────────────────────────────────────────────────────────────────
export async function listSendEvents(
  campaignId: string,
  limit = 100
): Promise<SendEventResponse[]> {
  const supabase = await createServiceClient();

  const { data, error } = await supabase
    .from("send_events")
    .select("*")
    .eq("campaign_id", campaignId)
    .order("sent_at", { ascending: false })
    .limit(limit);

  if (error) {
    throw new Error(`Error al listar send events: ${error.message}`);
  }

  return (data as DbSendEvent[]).map(mapSendEvent);
}

// ─────────────────────────────────────────────────────────────────────────────
// Listar send events con metadata del draft asociado (destinatario/asunto)
// ─────────────────────────────────────────────────────────────────────────────
export async function listSendEventsWithDraftMeta(
  campaignId: string,
  limit = 100,
  offset = 0
): Promise<{ sendEvents: SendEventWithDraftMeta[]; total: number }> {
  const supabase = await createServiceClient();

  const { data, error, count } = await supabase
    .from("send_events")
    .select("*, draft_items(to_email, rendered_subject)", { count: "exact" })
    .eq("campaign_id", campaignId)
    .order("sent_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    throw new Error(`Error al listar send events: ${error.message}`);
  }

  return {
    sendEvents: (data as DbSendEventWithDraft[]).map(mapSendEventWithDraftMeta),
    total: count ?? 0,
  };
}
