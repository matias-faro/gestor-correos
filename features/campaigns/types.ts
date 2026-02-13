// Tipos compartidos para la feature de campañas (cliente)

export type CampaignStatus =
  | "draft"
  | "ready"
  | "sending"
  | "paused"
  | "completed"
  | "cancelled";

export type DraftItemState = "pending" | "sending" | "sent" | "failed" | "excluded";

export type CampaignFilters = {
  query?: string;
  company?: string;
  position?: string;
  tagIds?: string[];
};

export type Campaign = {
  id: string;
  name: string;
  status: CampaignStatus;
  templateId: string | null;
  templateName: string | null;
  filtersSnapshot: CampaignFilters;
  fromAlias: string | null;
  signatureHtmlOverride: string | null;
  createdBy: string | null;
  googleAccountId: string | null;
  emailAccountId: string | null;
  activeLock: boolean;
  createdAt: string;
  updatedAt: string;
};

export type CampaignStats = {
  totalDrafts: number;
  pending: number;
  sent: number;
  failed: number;
  excluded: number;
};

export type DraftItem = {
  id: string;
  campaignId: string;
  contactId: string | null;
  toEmail: string;
  renderedSubject: string;
  renderedHtml: string;
  state: DraftItemState;
  includedManually: boolean;
  excludedManually: boolean;
  error: string | null;
  createdAt: string;
  updatedAt: string;
};

export type TestSendEvent = {
  id: string;
  campaignId: string;
  contactId: string | null;
  toEmail: string;
  renderedSubject: string;
  renderedHtml: string;
  createdAt: string;
};

// Campaign with stats (for list view)
export type CampaignWithStats = Campaign & {
  stats: CampaignStats;
};

// Responses
export type CampaignsListResponse = {
  campaigns: CampaignWithStats[];
};

export type CampaignDetailResponse = {
  campaign: Campaign;
  stats: CampaignStats;
};

export type DraftItemsListResponse = {
  draftItems: DraftItem[];
  total: number;
  limit: number;
  offset: number;
};

export type TestSendEventsListResponse = {
  testSendEvents: TestSendEvent[];
};

export type SnapshotResponse = {
  success: boolean;
  created: number;
  capped: boolean;
  message: string;
};

export type TestSendResponse = {
  success: boolean;
  event: TestSendEvent;
  message: string;
};
