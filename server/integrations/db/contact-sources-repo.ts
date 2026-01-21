import { createServiceClient } from "@/lib/supabase/server";

export type ContactSource = {
  id: string;
  name: string;
  spreadsheetId: string;
  sheetTab: string;
  googleAccountId: string | null;
  lastSyncedAt: string | null;
  lastSyncStatus: string | null;
  lastSyncError: string | null;
  createdAt: string;
  updatedAt: string;
};

type DbContactSource = {
  id: string;
  name: string;
  spreadsheet_id: string;
  sheet_tab: string;
  google_account_id: string | null;
  last_synced_at: string | null;
  last_sync_status: string | null;
  last_sync_error: string | null;
  created_at: string;
  updated_at: string;
};

function mapContactSource(data: DbContactSource): ContactSource {
  return {
    id: data.id,
    name: data.name,
    spreadsheetId: data.spreadsheet_id,
    sheetTab: data.sheet_tab,
    googleAccountId: data.google_account_id,
    lastSyncedAt: data.last_synced_at,
    lastSyncStatus: data.last_sync_status,
    lastSyncError: data.last_sync_error,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
  };
}

export async function listContactSources(): Promise<ContactSource[]> {
  const supabase = await createServiceClient();

  const { data, error } = await supabase
    .from("contact_sources")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(`Error al listar fuentes: ${error.message}`);
  }

  return (data ?? []).map((row) => mapContactSource(row as DbContactSource));
}

export async function getContactSourceById(
  id: string
): Promise<ContactSource | null> {
  const supabase = await createServiceClient();

  const { data, error } = await supabase
    .from("contact_sources")
    .select("*")
    .eq("id", id)
    .single();

  if (error) {
    if (error.code === "PGRST116") return null;
    throw new Error(`Error al obtener fuente: ${error.message}`);
  }

  return mapContactSource(data as DbContactSource);
}

export async function createContactSource(input: {
  name: string;
  spreadsheetId: string;
  sheetTab?: string;
  googleAccountId: string | null;
}): Promise<ContactSource> {
  const supabase = await createServiceClient();

  const { data, error } = await supabase
    .from("contact_sources")
    .insert({
      name: input.name,
      spreadsheet_id: input.spreadsheetId,
      sheet_tab: input.sheetTab ?? "Base de datos",
      google_account_id: input.googleAccountId,
    })
    .select("*")
    .single();

  if (error) {
    throw new Error(`Error al crear fuente: ${error.message}`);
  }

  return mapContactSource(data as DbContactSource);
}
