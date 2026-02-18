import type {
  BouncesListResponse,
  CleanupBouncesResponse,
  ScanBouncesResponse,
  ScanTrashCleanupResponse,
} from "./types";

// ─────────────────────────────────────────────────────────────────────────────
// Listar bounce events
// ─────────────────────────────────────────────────────────────────────────────
export async function fetchBounces(options?: {
  limit?: number;
  offset?: number;
}): Promise<BouncesListResponse> {
  const params = new URLSearchParams();
  if (options?.limit != null) params.set("limit", String(options.limit));
  if (options?.offset != null) params.set("offset", String(options.offset));

  const url = `/api/bounces${params.toString() ? `?${params}` : ""}`;
  const res = await fetch(url);

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error ?? "Error al cargar rebotes");
  }

  return res.json();
}

// ─────────────────────────────────────────────────────────────────────────────
// Escanear rebotes en el buzón de correo
// ─────────────────────────────────────────────────────────────────────────────
export async function scanBounces(options?: {
  maxResults?: number;
  newerThanDays?: number;
  trashProcessed?: boolean;
}): Promise<ScanBouncesResponse> {
  const res = await fetch("/api/bounces/scan", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(options ?? {}),
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error ?? "Error al escanear rebotes");
  }

  return res.json();
}

// ─────────────────────────────────────────────────────────────────────────────
// Limpieza manual (bulk): eliminar contactos + trash en correo
// ─────────────────────────────────────────────────────────────────────────────
export async function cleanupBounces(input: {
  ids: string[];
  deleteContacts?: boolean;
  trashGmailMessages?: boolean;
}): Promise<CleanupBouncesResponse> {
  const res = await fetch("/api/bounces/cleanup", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error ?? "Error al limpiar rebotes");
  }

  return res.json();
}

// ─────────────────────────────────────────────────────────────────────────────
// Escanear papelera y eliminar contactos por email rebotado (paginado)
// ─────────────────────────────────────────────────────────────────────────────
export async function scanTrashAndCleanupContacts(options?: {
  maxResults?: number;
  newerThanDays?: number;
  pageToken?: string;
  deleteContacts?: boolean;
}): Promise<ScanTrashCleanupResponse> {
  const res = await fetch("/api/bounces/trash-cleanup", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(options ?? {}),
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error ?? "Error al escanear la papelera");
  }

  return res.json();
}
