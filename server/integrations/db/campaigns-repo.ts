import { createServiceClient } from "@/lib/supabase/server";
import type {
  CampaignResponse,
  CampaignStatsResponse,
  CampaignStatus,
  CampaignFilters,
  CreateCampaignInput,
  UpdateCampaignInput,
  ListCampaignsFilters,
} from "@/server/contracts/campaigns";

// ─────────────────────────────────────────────────────────────────────────────
// Tipos internos (DB)
// ─────────────────────────────────────────────────────────────────────────────
type DbCampaign = {
  id: string;
  name: string;
  status: CampaignStatus;
  template_id: string | null;
  filters_snapshot: CampaignFilters;
  from_alias: string | null;
  signature_html_override: string | null;
  created_by: string | null;
  google_account_id: string | null;
  email_account_id: string | null;
  active_lock: boolean;
  created_at: string;
  updated_at: string;
};

type DbCampaignWithTemplate = DbCampaign & {
  templates: { name: string } | null;
};

// ─────────────────────────────────────────────────────────────────────────────
// Mapear DB a respuesta
// ─────────────────────────────────────────────────────────────────────────────
function mapCampaign(
  campaign: DbCampaign,
  templateName: string | null = null
): CampaignResponse {
  return {
    id: campaign.id,
    name: campaign.name,
    status: campaign.status,
    templateId: campaign.template_id,
    templateName,
    filtersSnapshot: campaign.filters_snapshot ?? {},
    fromAlias: campaign.from_alias,
    signatureHtmlOverride: campaign.signature_html_override,
    createdBy: campaign.created_by,
    googleAccountId: campaign.google_account_id,
    emailAccountId: campaign.email_account_id,
    activeLock: campaign.active_lock,
    createdAt: campaign.created_at,
    updatedAt: campaign.updated_at,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Listar campañas
// ─────────────────────────────────────────────────────────────────────────────
export async function listCampaigns(
  filters?: ListCampaignsFilters
): Promise<CampaignResponse[]> {
  const supabase = await createServiceClient();

  let query = supabase
    .from("campaigns")
    .select("*, templates(name)")
    .order("created_at", { ascending: false });

  if (filters?.query) {
    query = query.ilike("name", `%${filters.query}%`);
  }

  if (filters?.status) {
    query = query.eq("status", filters.status);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`Error al listar campañas: ${error.message}`);
  }

  return (data as DbCampaignWithTemplate[]).map((c) =>
    mapCampaign(c, c.templates?.name ?? null)
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Listar campañas con estadísticas
// ─────────────────────────────────────────────────────────────────────────────
export type CampaignWithStatsResponse = CampaignResponse & {
  stats: CampaignStatsResponse;
};

export async function listCampaignsWithStats(
  filters?: ListCampaignsFilters
): Promise<CampaignWithStatsResponse[]> {
  const supabase = await createServiceClient();

  let query = supabase
    .from("campaigns")
    .select("*, templates(name)")
    .order("created_at", { ascending: false });

  if (filters?.query) {
    query = query.ilike("name", `%${filters.query}%`);
  }

  if (filters?.status) {
    query = query.eq("status", filters.status);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`Error al listar campañas: ${error.message}`);
  }

  const campaigns = (data as DbCampaignWithTemplate[]).map((c) =>
    mapCampaign(c, c.templates?.name ?? null)
  );

  // Get stats for all campaigns in one query
  const campaignIds = campaigns.map((c) => c.id);
  
  if (campaignIds.length === 0) {
    return [];
  }

  const { data: draftsData, error: draftsError } = await supabase
    .from("draft_items")
    .select("campaign_id, state")
    .in("campaign_id", campaignIds);

  if (draftsError) {
    throw new Error(`Error al obtener estadísticas: ${draftsError.message}`);
  }

  // Aggregate stats per campaign
  const statsMap = new Map<string, CampaignStatsResponse>();
  
  for (const draft of draftsData ?? []) {
    let stats = statsMap.get(draft.campaign_id);
    if (!stats) {
      stats = { totalDrafts: 0, pending: 0, sent: 0, failed: 0, excluded: 0 };
      statsMap.set(draft.campaign_id, stats);
    }
    stats.totalDrafts++;
    switch (draft.state) {
      case "pending":
        stats.pending++;
        break;
      case "sending":
        stats.pending++;
        break;
      case "sent":
        stats.sent++;
        break;
      case "failed":
        stats.failed++;
        break;
      case "excluded":
        stats.excluded++;
        break;
    }
  }

  return campaigns.map((campaign) => ({
    ...campaign,
    stats: statsMap.get(campaign.id) ?? {
      totalDrafts: 0,
      pending: 0,
      sent: 0,
      failed: 0,
      excluded: 0,
    },
  }));
}

// ─────────────────────────────────────────────────────────────────────────────
// Obtener campaña por ID
// ─────────────────────────────────────────────────────────────────────────────
export async function getCampaignById(
  id: string
): Promise<CampaignResponse | null> {
  const supabase = await createServiceClient();

  const { data, error } = await supabase
    .from("campaigns")
    .select("*, templates(name)")
    .eq("id", id)
    .single();

  if (error) {
    if (error.code === "PGRST116") return null;
    throw new Error(`Error al obtener campaña: ${error.message}`);
  }

  const campaign = data as DbCampaignWithTemplate;
  return mapCampaign(campaign, campaign.templates?.name ?? null);
}

// ─────────────────────────────────────────────────────────────────────────────
// Crear campaña
// ─────────────────────────────────────────────────────────────────────────────
export async function createCampaign(
  input: CreateCampaignInput,
  options?: { createdByUserId?: string; googleAccountId?: string | null; emailAccountId?: string | null }
): Promise<CampaignResponse> {
  const supabase = await createServiceClient();

  const { data, error } = await supabase
    .from("campaigns")
    .insert({
      name: input.name,
      template_id: input.templateId,
      filters_snapshot: input.filters ?? {},
      from_alias: input.fromAlias ?? null,
      signature_html_override: input.signatureHtmlOverride ?? null,
      created_by: options?.createdByUserId ?? null,
      google_account_id: options?.googleAccountId ?? null,
      email_account_id: options?.emailAccountId ?? null,
      status: "draft",
      active_lock: false,
    })
    .select("*, templates(name)")
    .single();

  if (error) {
    throw new Error(`Error al crear campaña: ${error.message}`);
  }

  const campaign = data as DbCampaignWithTemplate;
  return mapCampaign(campaign, campaign.templates?.name ?? null);
}

// ─────────────────────────────────────────────────────────────────────────────
// Setear cuenta de Google asociada a una campaña
// ─────────────────────────────────────────────────────────────────────────────
export async function setCampaignGoogleAccountId(input: {
  campaignId: string;
  googleAccountId: string;
}): Promise<void> {
  const supabase = await createServiceClient();

  const { error } = await supabase
    .from("campaigns")
    .update({ google_account_id: input.googleAccountId })
    .eq("id", input.campaignId);

  if (error) {
    throw new Error(`Error al asociar cuenta de Google a campaña: ${error.message}`);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Setear cuenta de email (agnóstica) asociada a una campaña
// ─────────────────────────────────────────────────────────────────────────────
export async function setCampaignEmailAccountId(input: {
  campaignId: string;
  emailAccountId: string;
}): Promise<void> {
  const supabase = await createServiceClient();

  const { error } = await supabase
    .from("campaigns")
    .update({ email_account_id: input.emailAccountId })
    .eq("id", input.campaignId);

  if (error) {
    throw new Error(`Error al asociar cuenta de email a campaña: ${error.message}`);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Actualizar campaña (solo si está en draft)
// ─────────────────────────────────────────────────────────────────────────────
export async function updateCampaign(
  input: UpdateCampaignInput
): Promise<CampaignResponse> {
  const supabase = await createServiceClient();

  // Verificar que la campaña está en draft
  const existing = await getCampaignById(input.id);
  if (!existing) {
    throw new Error("Campaña no encontrada");
  }
  if (existing.status !== "draft") {
    throw new Error("Solo se pueden editar campañas en estado borrador");
  }

  const updateData: Record<string, unknown> = {};
  if (input.name !== undefined) updateData.name = input.name;
  if (input.templateId !== undefined) updateData.template_id = input.templateId;
  if (input.filters !== undefined) updateData.filters_snapshot = input.filters;
  if (input.fromAlias !== undefined) updateData.from_alias = input.fromAlias;
  if (input.signatureHtmlOverride !== undefined) {
    updateData.signature_html_override = input.signatureHtmlOverride;
  }
  if (input.emailAccountId !== undefined) {
    updateData.email_account_id = input.emailAccountId;
  }

  const { data, error } = await supabase
    .from("campaigns")
    .update(updateData)
    .eq("id", input.id)
    .select("*, templates(name)")
    .single();

  if (error) {
    throw new Error(`Error al actualizar campaña: ${error.message}`);
  }

  const campaign = data as DbCampaignWithTemplate;
  return mapCampaign(campaign, campaign.templates?.name ?? null);
}

// ─────────────────────────────────────────────────────────────────────────────
// Actualizar estado de campaña
// ─────────────────────────────────────────────────────────────────────────────
export async function updateCampaignStatus(
  id: string,
  status: CampaignStatus
): Promise<void> {
  const supabase = await createServiceClient();

  const { error } = await supabase
    .from("campaigns")
    .update({ status })
    .eq("id", id);

  if (error) {
    throw new Error(`Error al actualizar estado de campaña: ${error.message}`);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Borrar campaña
// ─────────────────────────────────────────────────────────────────────────────
export async function deleteCampaign(id: string): Promise<void> {
  const supabase = await createServiceClient();

  const { error } = await supabase.from("campaigns").delete().eq("id", id);

  if (error) {
    throw new Error(`Error al borrar campaña: ${error.message}`);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Obtener estadísticas de drafts de una campaña
// ─────────────────────────────────────────────────────────────────────────────
export async function getCampaignStats(
  campaignId: string
): Promise<CampaignStatsResponse> {
  const supabase = await createServiceClient();

  const { data, error } = await supabase
    .from("draft_items")
    .select("state")
    .eq("campaign_id", campaignId);

  if (error) {
    throw new Error(`Error al obtener estadísticas: ${error.message}`);
  }

  const stats: CampaignStatsResponse = {
    totalDrafts: data?.length ?? 0,
    pending: 0,
    sent: 0,
    failed: 0,
    excluded: 0,
  };

  for (const item of data ?? []) {
    switch (item.state) {
      case "pending":
        stats.pending++;
        break;
      case "sending":
        stats.pending++;
        break;
      case "sent":
        stats.sent++;
        break;
      case "failed":
        stats.failed++;
        break;
      case "excluded":
        stats.excluded++;
        break;
    }
  }

  return stats;
}

// ─────────────────────────────────────────────────────────────────────────────
// Verificar si existe otra campaña con lock activo
// ─────────────────────────────────────────────────────────────────────────────
export async function hasActiveCampaignLock(): Promise<boolean> {
  const supabase = await createServiceClient();

  const { count, error } = await supabase
    .from("campaigns")
    .select("id", { count: "exact", head: true })
    .eq("active_lock", true);

  if (error) {
    throw new Error(`Error al verificar lock: ${error.message}`);
  }

  return (count ?? 0) > 0;
}

// ─────────────────────────────────────────────────────────────────────────────
// Tomar lock global para una campaña (solo si no hay otra con lock)
// ─────────────────────────────────────────────────────────────────────────────
export async function acquireCampaignLock(campaignId: string): Promise<boolean> {
  const supabase = await createServiceClient();

  // Intentar tomar el lock (solo si no está ya tomado)
  const { data, error } = await supabase
    .from("campaigns")
    .update({ active_lock: true })
    .eq("id", campaignId)
    .eq("active_lock", false)
    .select("id")
    .single();

  if (error) {
    if (error.code === "PGRST116" || error.code === "23505") return false;
    throw new Error(`Error al tomar lock: ${error.message}`);
  }

  return !!data;
}

// ─────────────────────────────────────────────────────────────────────────────
// Liberar lock de una campaña
// ─────────────────────────────────────────────────────────────────────────────
export async function releaseCampaignLock(campaignId: string): Promise<void> {
  const supabase = await createServiceClient();

  const { error } = await supabase
    .from("campaigns")
    .update({ active_lock: false })
    .eq("id", campaignId);

  if (error) {
    throw new Error(`Error al liberar lock: ${error.message}`);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Obtener campaña con lock activo (si existe)
// ─────────────────────────────────────────────────────────────────────────────
export async function getLockedCampaign(): Promise<CampaignResponse | null> {
  const supabase = await createServiceClient();

  const { data, error } = await supabase
    .from("campaigns")
    .select("*, templates(name)")
    .eq("active_lock", true)
    .single();

  if (error) {
    if (error.code === "PGRST116") return null;
    throw new Error(`Error al obtener campaña bloqueada: ${error.message}`);
  }

  const campaign = data as DbCampaignWithTemplate;
  return mapCampaign(campaign, campaign.templates?.name ?? null);
}
