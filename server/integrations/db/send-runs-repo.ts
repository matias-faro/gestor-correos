import { createServiceClient } from "@/lib/supabase/server";
import type { SendRunResponse, SendRunStatus } from "@/server/contracts/campaigns";

// ─────────────────────────────────────────────────────────────────────────────
// Tipos internos (DB)
// ─────────────────────────────────────────────────────────────────────────────
type DbSendRun = {
  id: string;
  campaign_id: string;
  started_at: string;
  ended_at: string | null;
  status: SendRunStatus;
  next_tick_at: string | null;
};

// ─────────────────────────────────────────────────────────────────────────────
// Mapear DB a respuesta
// ─────────────────────────────────────────────────────────────────────────────
function mapSendRun(data: DbSendRun): SendRunResponse {
  return {
    id: data.id,
    campaignId: data.campaign_id,
    status: data.status,
    startedAt: data.started_at,
    endedAt: data.ended_at,
    nextTickAt: data.next_tick_at,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Crear un nuevo send run
// ─────────────────────────────────────────────────────────────────────────────
export async function createSendRun(
  campaignId: string
): Promise<SendRunResponse> {
  const supabase = await createServiceClient();

  const { data, error } = await supabase
    .from("send_runs")
    .insert({
      campaign_id: campaignId,
      status: "running",
    })
    .select("*")
    .single();

  if (error) {
    throw new Error(`Error al crear send run: ${error.message}`);
  }

  return mapSendRun(data as DbSendRun);
}

// ─────────────────────────────────────────────────────────────────────────────
// Obtener send run activo de una campaña (solo running)
// ─────────────────────────────────────────────────────────────────────────────
export async function getActiveSendRun(
  campaignId: string
): Promise<SendRunResponse | null> {
  const supabase = await createServiceClient();

  const { data, error } = await supabase
    .from("send_runs")
    .select("*")
    .eq("campaign_id", campaignId)
    .eq("status", "running")
    .order("started_at", { ascending: false })
    .limit(1)
    .single();

  if (error) {
    if (error.code === "PGRST116") return null;
    throw new Error(`Error al obtener send run: ${error.message}`);
  }

  return mapSendRun(data as DbSendRun);
}

// ─────────────────────────────────────────────────────────────────────────────
// Obtener send run más reciente de una campaña (running o paused)
// ─────────────────────────────────────────────────────────────────────────────
export async function getLatestSendRun(
  campaignId: string
): Promise<SendRunResponse | null> {
  const supabase = await createServiceClient();

  const { data, error } = await supabase
    .from("send_runs")
    .select("*")
    .eq("campaign_id", campaignId)
    .in("status", ["running", "paused"])
    .order("started_at", { ascending: false })
    .limit(1)
    .single();

  if (error) {
    if (error.code === "PGRST116") return null;
    throw new Error(`Error al obtener send run: ${error.message}`);
  }

  return mapSendRun(data as DbSendRun);
}

// ─────────────────────────────────────────────────────────────────────────────
// Obtener send run por ID
// ─────────────────────────────────────────────────────────────────────────────
export async function getSendRunById(
  id: string
): Promise<SendRunResponse | null> {
  const supabase = await createServiceClient();

  const { data, error } = await supabase
    .from("send_runs")
    .select("*")
    .eq("id", id)
    .single();

  if (error) {
    if (error.code === "PGRST116") return null;
    throw new Error(`Error al obtener send run: ${error.message}`);
  }

  return mapSendRun(data as DbSendRun);
}

// ─────────────────────────────────────────────────────────────────────────────
// Actualizar estado de send run
// ─────────────────────────────────────────────────────────────────────────────
export async function updateSendRunStatus(
  id: string,
  status: SendRunStatus,
  endedAt?: string
): Promise<void> {
  const supabase = await createServiceClient();

  const updateData: Record<string, unknown> = { status };
  if (endedAt) {
    updateData.ended_at = endedAt;
  }

  const { error } = await supabase
    .from("send_runs")
    .update(updateData)
    .eq("id", id);

  if (error) {
    throw new Error(`Error al actualizar send run: ${error.message}`);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Actualizar next_tick_at
// ─────────────────────────────────────────────────────────────────────────────
export async function updateSendRunNextTick(
  id: string,
  nextTickAt: string | null
): Promise<void> {
  const supabase = await createServiceClient();

  const { error } = await supabase
    .from("send_runs")
    .update({ next_tick_at: nextTickAt })
    .eq("id", id);

  if (error) {
    throw new Error(`Error al actualizar next tick: ${error.message}`);
  }
}
