import { createServiceClient } from "@/lib/supabase/server";
import { getSettings } from "@/server/integrations/db/settings-repo";

// ─────────────────────────────────────────────────────────────────────────────
// Tipos
// ─────────────────────────────────────────────────────────────────────────────
export type DashboardStats = {
  contactsCount: number;
  templatesCount: number;
  campaignsCount: number;
  sentTodayCount: number;
};

export type ActiveCampaignInfo = {
  id: string;
  name: string;
  status: "sending" | "paused";
  templateName: string | null;
  totalDrafts: number;
  sentCount: number;
  pendingCount: number;
} | null;

// ─────────────────────────────────────────────────────────────────────────────
// Obtener estadísticas del dashboard
// ─────────────────────────────────────────────────────────────────────────────
export async function getDashboardStats(): Promise<DashboardStats> {
  const supabase = await createServiceClient();
  const settings = await getSettings();

  // Contar contactos activos (no unsubscribed, no bounced)
  const { count: contactsCount } = await supabase
    .from("contacts")
    .select("id", { count: "exact", head: true })
    .eq("subscription_status", "active")
    .eq("suppression_status", "none");

  // Contar plantillas
  const { count: templatesCount } = await supabase
    .from("templates")
    .select("id", { count: "exact", head: true });

  // Contar campañas (todas)
  const { count: campaignsCount } = await supabase
    .from("campaigns")
    .select("id", { count: "exact", head: true });

  // Contar emails enviados hoy
  const timezone = settings.timezone;
  const now = new Date();
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const todayStr = formatter.format(now);
  const startOfDay = new Date(`${todayStr}T00:00:00`);

  const { count: sentTodayCount } = await supabase
    .from("send_events")
    .select("id", { count: "exact", head: true })
    .eq("status", "sent")
    .gte("sent_at", startOfDay.toISOString());

  return {
    contactsCount: contactsCount ?? 0,
    templatesCount: templatesCount ?? 0,
    campaignsCount: campaignsCount ?? 0,
    sentTodayCount: sentTodayCount ?? 0,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Obtener campaña activa (sending o paused con lock)
// ─────────────────────────────────────────────────────────────────────────────
export async function getActiveCampaign(): Promise<ActiveCampaignInfo> {
  const supabase = await createServiceClient();

  // Buscar campaña con active_lock = true O status = sending/paused
  const { data: campaign, error } = await supabase
    .from("campaigns")
    .select("id, name, status, active_lock, templates(name)")
    .or("status.eq.sending,status.eq.paused")
    .order("updated_at", { ascending: false })
    .limit(1)
    .single();

  if (error || !campaign) {
    return null;
  }

  // Contar drafts totales, enviados y pendientes
  const { count: totalDrafts } = await supabase
    .from("draft_items")
    .select("id", { count: "exact", head: true })
    .eq("campaign_id", campaign.id);

  const { count: sentCount } = await supabase
    .from("draft_items")
    .select("id", { count: "exact", head: true })
    .eq("campaign_id", campaign.id)
    .eq("state", "sent");

  const { count: pendingCount } = await supabase
    .from("draft_items")
    .select("id", { count: "exact", head: true })
    .eq("campaign_id", campaign.id)
    .eq("state", "pending");

  // templates puede ser un objeto o un array dependiendo de la relación
  let templateName: string | null = null;
  if (campaign.templates) {
    if (Array.isArray(campaign.templates) && campaign.templates.length > 0) {
      templateName = (campaign.templates[0] as { name: string }).name;
    } else if (typeof campaign.templates === "object" && !Array.isArray(campaign.templates)) {
      templateName = (campaign.templates as { name: string }).name;
    }
  }

  return {
    id: campaign.id,
    name: campaign.name,
    status: campaign.status as "sending" | "paused",
    templateName,
    totalDrafts: totalDrafts ?? 0,
    sentCount: sentCount ?? 0,
    pendingCount: pendingCount ?? 0,
  };
}
