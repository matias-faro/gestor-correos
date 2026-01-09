import type {
  Campaign,
  CampaignsListResponse,
  CampaignDetailResponse,
  DraftItem,
  DraftItemsListResponse,
  TestSendEvent,
  TestSendEventsListResponse,
  SnapshotResponse,
  TestSendResponse,
  CampaignFilters,
  DraftItemState,
} from "./types";

const API_BASE = "/api";

// ─────────────────────────────────────────────────────────────────────────────
// Listar campañas
// ─────────────────────────────────────────────────────────────────────────────
export async function fetchCampaigns(query?: string): Promise<Campaign[]> {
  const params = query ? `?query=${encodeURIComponent(query)}` : "";
  const res = await fetch(`${API_BASE}/campaigns${params}`);
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error ?? "Error al cargar campañas");
  }
  const data: CampaignsListResponse = await res.json();
  return data.campaigns;
}

// ─────────────────────────────────────────────────────────────────────────────
// Obtener campaña por ID
// ─────────────────────────────────────────────────────────────────────────────
export async function fetchCampaign(
  id: string
): Promise<CampaignDetailResponse> {
  const res = await fetch(`${API_BASE}/campaigns?id=${id}`);
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error ?? "Error al cargar campaña");
  }
  return res.json();
}

// ─────────────────────────────────────────────────────────────────────────────
// Crear campaña
// ─────────────────────────────────────────────────────────────────────────────
export async function createCampaign(input: {
  name: string;
  templateId: string;
  filters?: CampaignFilters;
  fromAlias?: string;
}): Promise<Campaign> {
  const res = await fetch(`${API_BASE}/campaigns`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error ?? "Error al crear campaña");
  }
  return res.json();
}

// ─────────────────────────────────────────────────────────────────────────────
// Actualizar campaña
// ─────────────────────────────────────────────────────────────────────────────
export async function updateCampaign(input: {
  id: string;
  name?: string;
  templateId?: string;
  filters?: CampaignFilters;
  fromAlias?: string | null;
}): Promise<Campaign> {
  const res = await fetch(`${API_BASE}/campaigns`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error ?? "Error al actualizar campaña");
  }
  return res.json();
}

// ─────────────────────────────────────────────────────────────────────────────
// Borrar campaña
// ─────────────────────────────────────────────────────────────────────────────
export async function deleteCampaign(id: string): Promise<void> {
  const res = await fetch(`${API_BASE}/campaigns?id=${id}`, {
    method: "DELETE",
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error ?? "Error al eliminar campaña");
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Generar snapshot
// ─────────────────────────────────────────────────────────────────────────────
export async function generateSnapshot(
  campaignId: string,
  force = false
): Promise<SnapshotResponse> {
  const res = await fetch(`${API_BASE}/campaigns/${campaignId}/snapshot`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ force }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error ?? "Error al generar snapshot");
  }
  return res.json();
}

// ─────────────────────────────────────────────────────────────────────────────
// Listar draft items
// ─────────────────────────────────────────────────────────────────────────────
export async function fetchDraftItems(
  campaignId: string,
  filters?: {
    query?: string;
    state?: DraftItemState;
    limit?: number;
    offset?: number;
  }
): Promise<DraftItemsListResponse> {
  const params = new URLSearchParams();
  if (filters?.query) params.set("query", filters.query);
  if (filters?.state) params.set("state", filters.state);
  if (filters?.limit) params.set("limit", String(filters.limit));
  if (filters?.offset) params.set("offset", String(filters.offset));

  const queryString = params.toString();
  const url = `${API_BASE}/campaigns/${campaignId}/draft-items${queryString ? `?${queryString}` : ""}`;

  const res = await fetch(url);
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error ?? "Error al cargar draft items");
  }
  return res.json();
}

// ─────────────────────────────────────────────────────────────────────────────
// Excluir/incluir draft item
// ─────────────────────────────────────────────────────────────────────────────
export async function updateDraftItem(
  campaignId: string,
  draftItemId: string,
  action: "exclude" | "include"
): Promise<DraftItem> {
  const res = await fetch(`${API_BASE}/campaigns/${campaignId}/draft-items`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id: draftItemId, action }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error ?? "Error al actualizar draft item");
  }
  return res.json();
}

// ─────────────────────────────────────────────────────────────────────────────
// Incluir contacto manualmente
// ─────────────────────────────────────────────────────────────────────────────
export async function includeContactManually(
  campaignId: string,
  contactId: string
): Promise<DraftItem> {
  const res = await fetch(`${API_BASE}/campaigns/${campaignId}/draft-items`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ contactId }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error ?? "Error al incluir contacto");
  }
  return res.json();
}

// ─────────────────────────────────────────────────────────────────────────────
// Enviar prueba simulada
// ─────────────────────────────────────────────────────────────────────────────
export async function sendTestSimulated(
  campaignId: string,
  contactId: string
): Promise<TestSendResponse> {
  const res = await fetch(`${API_BASE}/campaigns/${campaignId}/test-send`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ contactId }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error ?? "Error al enviar prueba");
  }
  return res.json();
}

// ─────────────────────────────────────────────────────────────────────────────
// Listar eventos de prueba
// ─────────────────────────────────────────────────────────────────────────────
export async function fetchTestSendEvents(
  campaignId: string
): Promise<TestSendEvent[]> {
  const res = await fetch(`${API_BASE}/campaigns/${campaignId}/test-send`);
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error ?? "Error al cargar eventos de prueba");
  }
  const data: TestSendEventsListResponse = await res.json();
  return data.testSendEvents;
}

// ─────────────────────────────────────────────────────────────────────────────
// Iniciar campaña
// ─────────────────────────────────────────────────────────────────────────────
export async function startCampaign(
  campaignId: string
): Promise<{ success: boolean; message: string }> {
  const res = await fetch(`${API_BASE}/campaigns/${campaignId}/start`, {
    method: "POST",
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error ?? "Error al iniciar campaña");
  }
  return res.json();
}

// ─────────────────────────────────────────────────────────────────────────────
// Pausar campaña
// ─────────────────────────────────────────────────────────────────────────────
export async function pauseCampaign(
  campaignId: string
): Promise<{ success: boolean; message: string }> {
  const res = await fetch(`${API_BASE}/campaigns/${campaignId}/pause`, {
    method: "POST",
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error ?? "Error al pausar campaña");
  }
  return res.json();
}

// ─────────────────────────────────────────────────────────────────────────────
// Cancelar campaña
// ─────────────────────────────────────────────────────────────────────────────
export async function cancelCampaign(
  campaignId: string
): Promise<{ success: boolean; message: string }> {
  const res = await fetch(`${API_BASE}/campaigns/${campaignId}/cancel`, {
    method: "POST",
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error ?? "Error al cancelar campaña");
  }
  return res.json();
}

// ─────────────────────────────────────────────────────────────────────────────
// Enviar prueba REAL (envía email de verdad)
// ─────────────────────────────────────────────────────────────────────────────
export async function sendTestReal(
  campaignId: string,
  toEmail: string,
  contactId?: string
): Promise<{ success: boolean; message: string }> {
  const res = await fetch(`${API_BASE}/campaigns/${campaignId}/test-send`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ toEmail, contactId, sendReal: true }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error ?? "Error al enviar prueba real");
  }
  return res.json();
}
