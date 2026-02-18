import { createServiceClient } from "@/lib/supabase/server";

// ─────────────────────────────────────────────────────────────────────────────
// Tipos
// ─────────────────────────────────────────────────────────────────────────────
export type SendWindow = {
  start: string; // "09:00"
  end: string; // "20:00"
};

export type SendWindows = {
  monday: SendWindow[];
  tuesday: SendWindow[];
  wednesday: SendWindow[];
  thursday: SendWindow[];
  friday: SendWindow[];
  saturday: SendWindow[];
  sunday: SendWindow[];
};

export type Settings = {
  id: number;
  timezone: string;
  dailyQuota: number;
  minDelaySeconds: number;
  sendWindows: SendWindows;
  signatureDefaultHtml: string | null;
  excludeKeywords: string[];
  allowlistEmails: string[];
  allowlistDomains: string[];
  activeContactSourceId: string | null;
};

type DbSettings = {
  id: number;
  timezone: string;
  daily_quota: number;
  min_delay_seconds: number;
  send_windows: SendWindows;
  signature_default_html: string | null;
  exclude_keywords: string[] | null;
  allowlist_emails: string[] | null;
  allowlist_domains: string[] | null;
  active_contact_source_id: string | null;
};

// ─────────────────────────────────────────────────────────────────────────────
// Mapear DB a respuesta
// ─────────────────────────────────────────────────────────────────────────────
function mapSettings(data: DbSettings): Settings {
  return {
    id: data.id,
    timezone: data.timezone,
    dailyQuota: data.daily_quota,
    minDelaySeconds: data.min_delay_seconds,
    sendWindows: data.send_windows,
    signatureDefaultHtml: data.signature_default_html,
    excludeKeywords: data.exclude_keywords ?? [],
    allowlistEmails: data.allowlist_emails ?? [],
    allowlistDomains: data.allowlist_domains ?? [],
    activeContactSourceId: data.active_contact_source_id,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Obtener configuración global (singleton, id=1)
// ─────────────────────────────────────────────────────────────────────────────
export async function getSettings(): Promise<Settings> {
  const supabase = await createServiceClient();

  const { data, error } = await supabase
    .from("settings")
    .select("*")
    .eq("id", 1)
    .single();

  if (error) {
    throw new Error(`Error al obtener configuración: ${error.message}`);
  }

  return mapSettings(data as DbSettings);
}

// ─────────────────────────────────────────────────────────────────────────────
// Actualizar configuración
// ─────────────────────────────────────────────────────────────────────────────
export type UpdateSettingsInput = Partial<{
  timezone: string;
  dailyQuota: number;
  minDelaySeconds: number;
  sendWindows: SendWindows;
  signatureDefaultHtml: string | null;
  excludeKeywords: string[];
  allowlistEmails: string[];
  allowlistDomains: string[];
  activeContactSourceId: string | null;
}>;

export async function updateSettings(input: UpdateSettingsInput): Promise<Settings> {
  const supabase = await createServiceClient();

  const updateData: Record<string, unknown> = {};
  
  if (input.timezone !== undefined) {
    updateData.timezone = input.timezone;
  }
  if (input.dailyQuota !== undefined) {
    updateData.daily_quota = input.dailyQuota;
  }
  if (input.minDelaySeconds !== undefined) {
    updateData.min_delay_seconds = input.minDelaySeconds;
  }
  if (input.sendWindows !== undefined) {
    updateData.send_windows = input.sendWindows;
  }
  if (input.signatureDefaultHtml !== undefined) {
    updateData.signature_default_html = input.signatureDefaultHtml;
  }
  if (input.excludeKeywords !== undefined) {
    updateData.exclude_keywords = input.excludeKeywords;
  }
  if (input.allowlistEmails !== undefined) {
    updateData.allowlist_emails = input.allowlistEmails;
  }
  if (input.allowlistDomains !== undefined) {
    updateData.allowlist_domains = input.allowlistDomains;
  }
  if (input.activeContactSourceId !== undefined) {
    updateData.active_contact_source_id = input.activeContactSourceId;
  }

  updateData.updated_at = new Date().toISOString();

  const { data, error } = await supabase
    .from("settings")
    .update(updateData)
    .eq("id", 1)
    .select()
    .single();

  if (error) {
    throw new Error(`Error al actualizar configuración: ${error.message}`);
  }

  return mapSettings(data as DbSettings);
}
