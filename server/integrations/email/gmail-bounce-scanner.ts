import type { BounceScanner, BounceMessage } from "./types";
import {
  listBounceMessageIds as gmailListBounceMessageIds,
  listBounceMessageIdsInTrash as gmailListBounceMessageIdsInTrash,
  processBounceMessage as gmailProcessBounceMessage,
  getMessageFull as gmailGetMessageFull,
  getMessageMetadata as gmailGetMessageMetadata,
  extractBouncedEmailAndReason,
  trashMessage as gmailTrashMessage,
} from "@/server/integrations/gmail/bounces";

// ─────────────────────────────────────────────────────────────────────────────
// GmailBounceScanner — Implementación de BounceScanner usando Gmail API
// Wrapper de la integración existente en server/integrations/gmail/bounces.ts
// ─────────────────────────────────────────────────────────────────────────────

export class GmailBounceScanner implements BounceScanner {
  constructor(private readonly googleAccountId: string) {}

  async listBounceMessageIds(options: {
    maxResults: number;
    newerThanDays: number;
  }): Promise<string[]> {
    return gmailListBounceMessageIds({
      googleAccountId: this.googleAccountId,
      maxResults: options.maxResults,
      newerThanDays: options.newerThanDays,
    });
  }

  async listBounceMessageIdsInTrash(options: {
    maxResults: number;
    newerThanDays: number;
    pageToken?: string;
  }): Promise<{ messageIds: string[]; nextPageToken: string | null }> {
    return gmailListBounceMessageIdsInTrash({
      googleAccountId: this.googleAccountId,
      maxResults: options.maxResults,
      newerThanDays: options.newerThanDays,
      pageToken: options.pageToken,
    });
  }

  async processBounceMessage(messageId: string): Promise<BounceMessage> {
    const result = await gmailProcessBounceMessage({
      googleAccountId: this.googleAccountId,
      messageId,
    });

    return {
      id: result.id,
      threadId: result.threadId,
      bouncedEmail: result.bouncedEmail,
      reason: result.reason,
      permalink: result.permalink,
    };
  }

  async getMessageForBounceExtraction(messageId: string): Promise<{
    bouncedEmail: string | null;
    reason: string | null;
  }> {
    // Primero intentamos con metadata (más liviano)
    const meta = await gmailGetMessageMetadata({
      googleAccountId: this.googleAccountId,
      messageId,
    });

    let parsed = extractBouncedEmailAndReason(meta);

    if (!parsed.bouncedEmail) {
      // Si no encontramos con metadata, intentamos con full
      const full = await gmailGetMessageFull({
        googleAccountId: this.googleAccountId,
        messageId,
      });
      parsed = extractBouncedEmailAndReason(full);
    }

    return {
      bouncedEmail: parsed.bouncedEmail,
      reason: parsed.reason,
    };
  }

  async trashMessage(messageId: string): Promise<void> {
    await gmailTrashMessage({
      googleAccountId: this.googleAccountId,
      messageId,
    });
  }
}
