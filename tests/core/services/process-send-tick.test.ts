import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/server/integrations/db/campaigns-repo", () => ({
  getCampaignById: vi.fn(),
  updateCampaignStatus: vi.fn(),
  releaseCampaignLock: vi.fn(),
  setCampaignGoogleAccountId: vi.fn(),
}));

vi.mock("@/server/integrations/db/draft-items-repo", () => ({
  claimNextPendingDraftItem: vi.fn(),
  countDraftItemsByStates: vi.fn(),
  countDraftItems: vi.fn(),
  markDraftItemAsSent: vi.fn(),
  markDraftItemAsFailed: vi.fn(),
  createDraftItemsBatch: vi.fn(),
  createDraftItem: vi.fn(),
  createTestSendEvent: vi.fn(),
  deleteDraftItemsForCampaign: vi.fn(),
  findDraftItemByEmail: vi.fn(),
  excludeDraftItem: vi.fn(),
  includeDraftItem: vi.fn(),
}));

vi.mock("@/server/integrations/db/settings-repo", () => ({
  getSettings: vi.fn(),
}));

vi.mock("@/server/integrations/db/send-runs-repo", () => ({
  getSendRunById: vi.fn(),
  updateSendRunNextTick: vi.fn(),
  updateSendRunStatus: vi.fn(),
  getActiveSendRun: vi.fn(),
  getLatestSendRun: vi.fn(),
  createSendRun: vi.fn(),
}));

vi.mock("@/server/integrations/db/send-events-repo", () => ({
  countTodaySendEvents: vi.fn(),
  createSendEventSuccess: vi.fn(),
  createSendEventFailure: vi.fn(),
}));

vi.mock("@/server/domain/scheduler", () => ({
  calculateNextTick: vi.fn(),
}));

vi.mock("@/server/integrations/qstash/client", () => ({
  scheduleSendTickAt: vi.fn(),
  scheduleSendTick: vi.fn(),
}));

vi.mock("@/server/integrations/gmail/send", () => ({
  sendEmail: vi.fn(),
}));

import { processSendTick } from "@/server/services/CampaignService";
import {
  getCampaignById,
  updateCampaignStatus,
  releaseCampaignLock,
} from "@/server/integrations/db/campaigns-repo";
import {
  claimNextPendingDraftItem,
  countDraftItemsByStates,
  countDraftItems,
} from "@/server/integrations/db/draft-items-repo";
import { getSettings } from "@/server/integrations/db/settings-repo";
import {
  getSendRunById,
  updateSendRunNextTick,
  updateSendRunStatus,
} from "@/server/integrations/db/send-runs-repo";
import { countTodaySendEvents } from "@/server/integrations/db/send-events-repo";
import { calculateNextTick } from "@/server/domain/scheduler";
import {
  scheduleSendTickAt,
  scheduleSendTick,
} from "@/server/integrations/qstash/client";

describe("processSendTick", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(getCampaignById).mockResolvedValue({
      id: "campaign-1",
      status: "sending",
      googleAccountId: "google-1",
      fromAlias: null,
      signatureHtmlOverride: null,
      createdBy: null,
      activeLock: true,
    });

    vi.mocked(getSendRunById).mockResolvedValue({
      id: "send-run-1",
      status: "running",
    });

    vi.mocked(getSettings).mockResolvedValue({
      id: 1,
      timezone: "UTC",
      dailyQuota: 100,
      minDelaySeconds: 30,
      sendWindows: {
        monday: [{ start: "09:00", end: "18:00" }],
        tuesday: [{ start: "09:00", end: "18:00" }],
        wednesday: [{ start: "09:00", end: "18:00" }],
        thursday: [{ start: "09:00", end: "18:00" }],
        friday: [{ start: "09:00", end: "18:00" }],
        saturday: [],
        sunday: [],
      },
      signatureDefaultHtml: null,
      allowlistEmails: [],
      allowlistDomains: [],
      activeContactSourceId: null,
    });

    vi.mocked(countTodaySendEvents).mockResolvedValue(0);
  });

  it("no reclama draft cuando está fuera de ventana y solo reprograma", async () => {
    const nextWindow = new Date("2026-02-11T12:00:00.000Z");
    vi.mocked(countDraftItemsByStates).mockResolvedValue(10);
    vi.mocked(calculateNextTick).mockReturnValue({
      type: "next_window",
      notBefore: nextWindow,
      reason: "Fuera de ventana de envío. Esperando próxima ventana.",
    });

    const result = await processSendTick("campaign-1", "send-run-1");

    expect(result.action).toBe("scheduled");
    expect(vi.mocked(claimNextPendingDraftItem)).not.toHaveBeenCalled();
    expect(vi.mocked(updateSendRunNextTick)).toHaveBeenCalledWith(
      "send-run-1",
      nextWindow.toISOString()
    );
    expect(vi.mocked(scheduleSendTickAt)).toHaveBeenCalledWith({
      campaignId: "campaign-1",
      sendRunId: "send-run-1",
      notBefore: nextWindow,
    });
  });

  it("si no encuentra pending pero hay sending, reintenta y no deja la corrida clavada", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-02-11T09:00:00.000Z"));

    vi.mocked(countDraftItemsByStates).mockImplementation(async (_campaignId, states) => {
      if (states.length === 1 && states[0] === "sending") {
        return 1;
      }
      return 1;
    });

    vi.mocked(calculateNextTick).mockReturnValue({
      type: "immediate",
      delaySeconds: 30,
    });

    vi.mocked(claimNextPendingDraftItem).mockResolvedValue(null);

    const result = await processSendTick("campaign-1", "send-run-1");

    expect(result.action).toBe("scheduled");
    expect(vi.mocked(scheduleSendTick)).toHaveBeenCalledWith({
      campaignId: "campaign-1",
      sendRunId: "send-run-1",
      delaySeconds: 30,
    });
    expect(vi.mocked(updateSendRunStatus)).not.toHaveBeenCalled();
    expect(vi.mocked(updateCampaignStatus)).not.toHaveBeenCalled();
    expect(vi.mocked(releaseCampaignLock)).not.toHaveBeenCalled();

    vi.useRealTimers();
  });

  it("completa campaña cuando no quedan pending ni sending", async () => {
    vi.mocked(countDraftItemsByStates).mockImplementation(async (_campaignId, states) => {
      if (states.length === 1 && states[0] === "sending") {
        return 0;
      }
      return 0;
    });

    vi.mocked(calculateNextTick).mockReturnValue({
      type: "immediate",
      delaySeconds: 30,
    });
    vi.mocked(claimNextPendingDraftItem).mockResolvedValue(null);
    vi.mocked(countDraftItems).mockResolvedValue(5);

    const result = await processSendTick("campaign-1", "send-run-1");

    expect(result).toEqual({
      action: "completed",
      totalSent: 5,
    });
    expect(vi.mocked(updateSendRunStatus)).toHaveBeenCalledWith(
      "send-run-1",
      "completed",
      expect.any(String)
    );
    expect(vi.mocked(updateCampaignStatus)).toHaveBeenCalledWith(
      "campaign-1",
      "completed"
    );
    expect(vi.mocked(releaseCampaignLock)).toHaveBeenCalledWith("campaign-1");
  });
});
