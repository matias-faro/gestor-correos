import { createServiceClient } from "@/lib/supabase/server";

export type ContactSource = {
  id: string;
  name: string;
  spreadsheetId: string;
  sheetTab: string;
  googleAccountId: string | null;
  lastSyncedAt: string | null;
  lastSyncStartedAt: string | null;
  lastSyncStatus: string | null;
  lastSyncError: string | null;
  lastSyncProcessed: number | null;
  lastSyncSkipped: number | null;
  lastSyncLastRow: number | null;
  lastSyncRemovedMemberships: number | null;
  lastSyncDeletedContacts: number | null;
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
  last_sync_started_at: string | null;
  last_sync_status: string | null;
  last_sync_error: string | null;
  last_sync_processed: number | null;
  last_sync_skipped: number | null;
  last_sync_last_row: number | null;
  last_sync_removed_memberships: number | null;
  last_sync_deleted_contacts: number | null;
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
    lastSyncStartedAt: data.last_sync_started_at,
    lastSyncStatus: data.last_sync_status,
    lastSyncError: data.last_sync_error,
    lastSyncProcessed: data.last_sync_processed,
    lastSyncSkipped: data.last_sync_skipped,
    lastSyncLastRow: data.last_sync_last_row,
    lastSyncRemovedMemberships: data.last_sync_removed_memberships,
    lastSyncDeletedContacts: data.last_sync_deleted_contacts,
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
  const normalizedSheetTab = input.sheetTab ?? "Base de datos";

  if (input.googleAccountId) {
    const { data: existing, error: existingError } = await supabase
      .from("contact_sources")
      .select("*")
      .eq("spreadsheet_id", input.spreadsheetId)
      .eq("sheet_tab", normalizedSheetTab)
      .eq("google_account_id", input.googleAccountId)
      .order("created_at", { ascending: false })
      .limit(1);

    if (existingError) {
      throw new Error(`Error al validar duplicados: ${existingError.message}`);
    }

    if (existing && existing.length > 0) {
      throw new Error("Ya existe una fuente para ese spreadsheet y pestaña.");
    }
  }

  const { data, error } = await supabase
    .from("contact_sources")
    .insert({
      name: input.name,
      spreadsheet_id: input.spreadsheetId,
      sheet_tab: normalizedSheetTab,
      google_account_id: input.googleAccountId,
    })
    .select("*")
    .single();

  if (error) {
    throw new Error(`Error al crear fuente: ${error.message}`);
  }

  return mapContactSource(data as DbContactSource);
}
