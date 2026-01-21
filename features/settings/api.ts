import type {
  ContactSource,
  Settings,
  SpreadsheetInfo,
  UpdateSettingsInput,
} from "./types";

export async function getSettings(): Promise<Settings> {
  const res = await fetch("/api/settings");
  if (!res.ok) {
    const data = await res.json();
    throw new Error(data.error || "Error al obtener configuración");
  }
  return res.json();
}

export async function updateSettings(input: UpdateSettingsInput): Promise<Settings> {
  const res = await fetch("/api/settings", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    const data = await res.json();
    throw new Error(data.error || "Error al actualizar configuración");
  }
  return res.json();
}

export async function fetchContactSources(): Promise<ContactSource[]> {
  const res = await fetch("/api/contact-sources");
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error ?? "Error al cargar fuentes");
  }
  const data = (await res.json()) as { sources: ContactSource[] };
  return data.sources;
}

export async function createContactSource(input: {
  name: string;
  spreadsheetId: string;
}): Promise<ContactSource> {
  const res = await fetch("/api/contact-sources", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error ?? "Error al crear fuente");
  }
  return res.json();
}

export async function syncContactSource(id: string): Promise<{
  success: boolean;
  syncStartedAt: string;
}> {
  const res = await fetch(`/api/contact-sources/${id}/sync`, {
    method: "POST",
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error ?? "Error al sincronizar");
  }
  return res.json();
}

export async function fetchSpreadsheets(
  query?: string
): Promise<SpreadsheetInfo[]> {
  const params = new URLSearchParams();
  if (query) params.set("q", query);
  const res = await fetch(`/api/google/spreadsheets?${params.toString()}`);
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error ?? "Error al listar spreadsheets");
  }
  const data = (await res.json()) as { spreadsheets: SpreadsheetInfo[] };
  return data.spreadsheets;
}
