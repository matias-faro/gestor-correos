// Tipos compartidos para la feature de contactos (cliente)

export type Tag = {
  id: string;
  name: string;
  kind: "tipo" | "rubro";
  createdAt: string;
};

export type Contact = {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  company: string | null;
  position: string | null;
  extra: Record<string, unknown> | null;
  subscriptionStatus: "active" | "unsubscribed";
  suppressionStatus: "none" | "bounced";
  tags: { id: string; name: string; kind: "tipo" | "rubro" }[];
  createdAt: string;
  updatedAt: string;
};

export type ContactsFilters = {
  query?: string;
  company?: string;
  position?: string;
  tagIds?: string[];
  sourceId?: string;
  includeUnsubscribed?: boolean;
  includeSuppressed?: boolean;
  limit?: number;
  offset?: number;
};

export type ContactsListResponse = {
  contacts: Contact[];
  total: number;
  limit: number;
  offset: number;
};

export type ContactSourceOption = {
  id: string;
  name: string;
};

export type TagsListResponse = {
  tags: Tag[];
};
