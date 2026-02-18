export type SendWindow = {
  start: string;
  end: string;
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

export type SpreadsheetInfo = {
  id: string;
  name: string;
};
