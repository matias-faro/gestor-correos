import type {
  Contact,
  ContactSourceOption,
  ContactsFilters,
  ContactsListResponse,
  Tag,
  TagsListResponse,
} from "./types";

const API_BASE = "/api";

// ─────────────────────────────────────────────────────────────────────────────
// Contactos
// ─────────────────────────────────────────────────────────────────────────────

export async function fetchContacts(
  filters: ContactsFilters = {}
): Promise<ContactsListResponse> {
  const params = new URLSearchParams();

  if (filters.query) params.set("query", filters.query);
  if (filters.company) params.set("company", filters.company);
  if (filters.position) params.set("position", filters.position);
  if (filters.includeUnsubscribed) params.set("includeUnsubscribed", "true");
  if (filters.includeSuppressed) params.set("includeSuppressed", "true");
  if (filters.sourceId) params.set("sourceId", filters.sourceId);
  if (filters.limit != null) params.set("limit", String(filters.limit));
  if (filters.offset != null) params.set("offset", String(filters.offset));
  if (filters.tagIds && filters.tagIds.length > 0) {
    params.set("tagIds", filters.tagIds.join(","));
  }

  const res = await fetch(`${API_BASE}/contacts?${params.toString()}`);
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error ?? "Error al cargar contactos");
  }
  return res.json();
}

export async function createContact(input: {
  email: string;
  firstName?: string;
  lastName?: string;
  company?: string;
  position?: string;
  extra?: Record<string, unknown>;
  tagIds?: string[];
}): Promise<Contact> {
  const res = await fetch(`${API_BASE}/contacts`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error ?? "Error al crear contacto");
  }
  return res.json();
}

export async function updateContact(input: {
  id: string;
  email?: string;
  firstName?: string | null;
  lastName?: string | null;
  company?: string | null;
  position?: string | null;
  extra?: Record<string, unknown> | null;
  subscriptionStatus?: "active" | "unsubscribed";
  tagIds?: string[];
}): Promise<Contact> {
  const res = await fetch(`${API_BASE}/contacts`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error ?? "Error al actualizar contacto");
  }
  return res.json();
}

export async function deleteContact(id: string): Promise<void> {
  const res = await fetch(`${API_BASE}/contacts?id=${id}`, {
    method: "DELETE",
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error ?? "Error al eliminar contacto");
  }
}

export async function fetchContactSources(): Promise<ContactSourceOption[]> {
  const res = await fetch(`${API_BASE}/contact-sources`);
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error ?? "Error al cargar fuentes");
  }
  const data = (await res.json()) as { sources: ContactSourceOption[] };
  return data.sources.map((source) => ({ id: source.id, name: source.name }));
}

// ─────────────────────────────────────────────────────────────────────────────
// Tags
// ─────────────────────────────────────────────────────────────────────────────

export async function fetchTags(kind?: "tipo" | "rubro"): Promise<Tag[]> {
  const params = kind ? `?kind=${kind}` : "";
  const res = await fetch(`${API_BASE}/tags${params}`);
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error ?? "Error al cargar tags");
  }
  const data: TagsListResponse = await res.json();
  return data.tags;
}

export async function createTag(
  name: string,
  kind: "tipo" | "rubro"
): Promise<Tag> {
  const res = await fetch(`${API_BASE}/tags`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, kind }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error ?? "Error al crear tag");
  }
  return res.json();
}

export async function deleteTag(id: string): Promise<void> {
  const res = await fetch(`${API_BASE}/tags?id=${id}`, {
    method: "DELETE",
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error ?? "Error al eliminar tag");
  }
}
