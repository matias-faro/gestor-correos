export type BounceEventResponse = {
  id: string;
  detectedAt: string;
  googleAccountId: string | null;
  bouncedEmail: string;
  reason: string | null;
  gmailMessageId: string | null;
  gmailPermalink: string | null;
};

export type BouncesListResponse = {
  bounces: BounceEventResponse[];
  total: number;
  limit: number;
  offset: number;
};

export type ScanBouncesResponse = {
  scanned: number;
  created: number;
  suppressed: number;
  trashed: number;
  errors: Array<{ messageId: string; error: string }>;
};

export type CleanupBouncesResponse = {
  selected: number;
  deletedContacts: number;
  trashed: number;
  skippedUnknownEmails: number;
  skippedMissingMessageId: number;
  errors: Array<{ bounceEventId: string; error: string }>;
};

export type ScanTrashCleanupResponse = {
  scanned: number;
  extracted: number;
  uniqueEmails: number;
  deletedContacts: number;
  nextPageToken: string | null;
  errors: Array<{ messageId: string; error: string }>;
};
