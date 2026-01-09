// ─────────────────────────────────────────────────────────────────────────────
// Tipos para plantillas (frontend)
// ─────────────────────────────────────────────────────────────────────────────

export type Template = {
  id: string;
  name: string;
  subjectTpl: string;
  htmlTpl: string;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
};

export type TemplatesListResponse = {
  templates: Template[];
};

export type PreviewResponse = {
  subject: string;
  html: string;
};

export type PreviewInput = {
  subjectTpl: string;
  htmlTpl: string;
  contactId?: string;
  unsubscribeUrl?: string;
};
