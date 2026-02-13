"use client";

import { useState, useCallback, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import DOMPurify from "dompurify";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  IconArrowLeft,
  IconCamera,
  IconSend,
  IconDots,
  IconX,
  IconCheck,
  IconUserPlus,
  IconLoader2,
  IconChevronLeft,
  IconChevronRight,
  IconSearch,
  IconEye,
  IconPlayerPlay,
  IconPlayerPause,
  IconPlayerStop,
  IconMail,
  IconRefresh,
  IconClock,
  IconCalendarEvent,
  IconInfoCircle,
  IconTemplate,
  IconUsers,
  IconAlertTriangle,
  IconCircleCheck,
  IconCircleDashed,
  IconCopy,
  IconExternalLink,
  IconCode,
} from "@tabler/icons-react";
import { toast } from "sonner";
import {
  fetchCampaign,
  generateSnapshot,
  fetchDraftItems,
  updateDraftItem,
  includeContactManually,
  sendTestReal,
  fetchTestSendEvents,
  startCampaign,
  pauseCampaign,
  cancelCampaign,
  retryCampaign,
} from "./api";
import { fetchContacts } from "@/features/contacts/api";
import { getSettings } from "@/features/settings/api";
import type { Settings } from "@/features/settings/types";
import type {
  Campaign,
  CampaignStats,
  DraftItem,
  TestSendEvent,
  CampaignStatus,
  DraftItemState,
} from "./types";
import type { Contact } from "@/features/contacts/types";

const STATUS_LABELS: Record<CampaignStatus, string> = {
  draft: "Borrador",
  ready: "Lista",
  sending: "Enviando",
  paused: "Pausada",
  completed: "Completada",
  cancelled: "Cancelada",
};

const DRAFT_STATE_LABELS: Record<DraftItemState, string> = {
  pending: "Pendiente",
  sending: "Enviando",
  sent: "Enviado",
  failed: "Fallido",
  excluded: "Excluido",
};

const PAGE_SIZE = 25;

type CampaignDetailPageProps = {
  campaignId: string;
};

// ─────────────────────────────────────────────────────────────────────────────
// Stepper Step Component
// ─────────────────────────────────────────────────────────────────────────────
type StepStatus = "complete" | "current" | "warning" | "pending";

function StepIndicator({
  label,
  status,
  description,
  icon: Icon,
}: {
  label: string;
  status: StepStatus;
  description?: string;
  icon: typeof IconTemplate;
}) {
  const styles: Record<StepStatus, { bg: string; icon: string; text: string }> = {
    complete: {
      bg: "bg-green-600",
      icon: "text-white",
      text: "text-green-400",
    },
    current: {
      bg: "bg-blue-600",
      icon: "text-white",
      text: "text-blue-400",
    },
    warning: {
      bg: "bg-amber-600",
      icon: "text-white",
      text: "text-amber-400",
    },
    pending: {
      bg: "bg-slate-700",
      icon: "text-slate-400",
      text: "text-slate-400",
    },
  };

  const s = styles[status];

  return (
    <div className="flex items-center gap-3">
      <div
        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${s.bg}`}
      >
        {status === "complete" ? (
          <IconCircleCheck className={`h-5 w-5 ${s.icon}`} />
        ) : status === "warning" ? (
          <IconAlertTriangle className={`h-5 w-5 ${s.icon}`} />
        ) : (
          <Icon className={`h-5 w-5 ${s.icon}`} />
        )}
      </div>
      <div className="min-w-0">
        <p className={`font-medium ${s.text}`}>{label}</p>
        {description && (
          <p className="text-xs text-slate-500 truncate">{description}</p>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Draft State Tabs
// ─────────────────────────────────────────────────────────────────────────────
const DRAFT_TABS: { id: DraftItemState | "all"; label: string }[] = [
  { id: "all", label: "Todos" },
  { id: "pending", label: "Pendientes" },
  { id: "sent", label: "Enviados" },
  { id: "failed", label: "Fallidos" },
  { id: "excluded", label: "Excluidos" },
];

// ─────────────────────────────────────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────────────────────────────────────
export function CampaignDetailPage({ campaignId }: CampaignDetailPageProps) {
  const router = useRouter();

  // Campaign data
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [stats, setStats] = useState<CampaignStats | null>(null);
  const [loading, setLoading] = useState(true);

  // Draft items
  const [draftItems, setDraftItems] = useState<DraftItem[]>([]);
  const [draftsTotal, setDraftsTotal] = useState(0);
  const [draftsOffset, setDraftsOffset] = useState(0);
  const [draftsQuery, setDraftsQuery] = useState("");
  const [draftsLoading, setDraftsLoading] = useState(false);
  const [draftsStateFilter, setDraftsStateFilter] = useState<DraftItemState | "all">("all");

  // Test events
  const [testEvents, setTestEvents] = useState<TestSendEvent[]>([]);

  // Modals
  const [snapshotDialogOpen, setSnapshotDialogOpen] = useState(false);
  const [snapshotForce, setSnapshotForce] = useState(false);
  const [snapshotLoading, setSnapshotLoading] = useState(false);

  const [includeDialogOpen, setIncludeDialogOpen] = useState(false);
  const [contactSearch, setContactSearch] = useState("");
  const [searchResults, setSearchResults] = useState<Contact[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [includingContact, setIncludingContact] = useState(false);

  const [testSendDialogOpen, setTestSendDialogOpen] = useState(false);
  const [testEmail, setTestEmail] = useState("");
  const [sendingTest, setSendingTest] = useState(false);

  const [startDialogOpen, setStartDialogOpen] = useState(false);
  const [startingCampaign, setStartingCampaign] = useState(false);
  const [pausingCampaign, setPausingCampaign] = useState(false);
  const [retryingCampaign, setRetryingCampaign] = useState(false);
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [cancellingCampaign, setCancellingCampaign] = useState(false);

  const [previewItem, setPreviewItem] = useState<DraftItem | TestSendEvent | null>(null);

  // Settings for time estimation
  const [settings, setSettings] = useState<Settings | null>(null);

  // Load settings on mount
  useEffect(() => {
    getSettings().then(setSettings).catch(console.error);
  }, []);

  // Calculate estimated time
  const estimatedTime = useMemo(() => {
    if (!settings || !stats || stats.pending === 0) return null;

    const { dailyQuota, minDelaySeconds } = settings;
    const totalEmails = stats.pending;
    const emailsPerDay = dailyQuota;
    const daysNeeded = Math.ceil(totalEmails / emailsPerDay);
    const secondsPerEmail = minDelaySeconds;
    const emailsToday = Math.min(totalEmails, emailsPerDay);
    const todaySeconds = emailsToday * secondsPerEmail;
    const todayMinutes = Math.ceil(todaySeconds / 60);
    const todayHours = Math.floor(todayMinutes / 60);
    const remainingMinutes = todayMinutes % 60;

    return {
      totalEmails,
      daysNeeded,
      todayEmails: emailsToday,
      todayTime: todayHours > 0 
        ? `${todayHours}h ${remainingMinutes}min`
        : `${todayMinutes} min`,
      emailsPerHour: Math.floor(3600 / secondsPerEmail),
      dailyQuota,
    };
  }, [settings, stats]);

  // Load campaign
  const loadCampaign = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchCampaign(campaignId);
      setCampaign(data.campaign);
      setStats(data.stats);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al cargar campaña");
      router.push("/campaigns");
    } finally {
      setLoading(false);
    }
  }, [campaignId, router]);

  // Load drafts
  const loadDrafts = useCallback(async () => {
    setDraftsLoading(true);
    try {
      const data = await fetchDraftItems(campaignId, {
        query: draftsQuery || undefined,
        state: draftsStateFilter === "all" ? undefined : draftsStateFilter,
        limit: PAGE_SIZE,
        offset: draftsOffset,
      });
      setDraftItems(data.draftItems);
      setDraftsTotal(data.total);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al cargar drafts");
    } finally {
      setDraftsLoading(false);
    }
  }, [campaignId, draftsQuery, draftsOffset, draftsStateFilter]);

  // Load test events
  const loadTestEvents = useCallback(async () => {
    try {
      const events = await fetchTestSendEvents(campaignId);
      setTestEvents(events);
    } catch {
      // Silently fail for test events
    }
  }, [campaignId]);

  useEffect(() => {
    loadCampaign();
    loadTestEvents();
  }, [loadCampaign, loadTestEvents]);

  useEffect(() => {
    if (campaign && (campaign.status === "ready" || stats?.totalDrafts)) {
      loadDrafts();
    }
  }, [campaign, stats, loadDrafts]);

  // Reset offset when filter changes
  useEffect(() => {
    setDraftsOffset(0);
  }, [draftsStateFilter, draftsQuery]);

  // Auto-refresh for sending campaigns
  useEffect(() => {
    if (campaign?.status === "sending") {
      const interval = setInterval(() => {
        loadCampaign();
        loadDrafts();
      }, 10000); // Refresh every 10 seconds
      return () => clearInterval(interval);
    }
  }, [campaign?.status, loadCampaign, loadDrafts]);

  // Search contacts for include
  useEffect(() => {
    if (!includeDialogOpen || !contactSearch.trim()) {
      setSearchResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      setSearchLoading(true);
      try {
        const data = await fetchContacts({ query: contactSearch, limit: 10 });
        setSearchResults(data.contacts);
      } catch {
        setSearchResults([]);
      } finally {
        setSearchLoading(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [contactSearch, includeDialogOpen]);

  // ─────────────────────────────────────────────────────────────────────────────
  // Readiness checks
  // ─────────────────────────────────────────────────────────────────────────────
  const readinessChecks = useMemo(() => {
    if (!campaign || !stats) return [];

    const checks: {
      label: string;
      status: "ok" | "warning" | "error";
      message: string;
      action?: { label: string; onClick: () => void };
    }[] = [];

    // Template check
    if (campaign.templateId) {
      checks.push({
        label: "Plantilla",
        status: "ok",
        message: campaign.templateName ?? "Plantilla asignada",
      });
    } else {
      checks.push({
        label: "Plantilla",
        status: "error",
        message: "No hay plantilla asignada",
      });
    }

    // Snapshot check
    if (stats.totalDrafts > 0) {
      checks.push({
        label: "Snapshot",
        status: "ok",
        message: `${stats.totalDrafts} borradores generados`,
      });
    } else if (campaign.status === "draft") {
      checks.push({
        label: "Snapshot",
        status: "warning",
        message: "Generá el snapshot para ver destinatarios",
        action: {
          label: "Generar",
          onClick: () => setSnapshotDialogOpen(true),
        },
      });
    }

    // Pending emails check
    if (stats.pending > 0) {
      checks.push({
        label: "Destinatarios",
        status: "ok",
        message: `${stats.pending} emails pendientes`,
      });
    } else if (stats.totalDrafts > 0 && stats.pending === 0) {
      checks.push({
        label: "Destinatarios",
        status: "error",
        message: "No hay emails pendientes para enviar",
        action: {
          label: "Incluir contacto",
          onClick: () => setIncludeDialogOpen(true),
        },
      });
    }

    // Test send check
    if (testEvents.length > 0) {
      checks.push({
        label: "Prueba",
        status: "ok",
        message: `${testEvents.length} prueba(s) enviada(s)`,
      });
    } else {
      checks.push({
        label: "Prueba",
        status: "warning",
        message: "Recomendamos enviar una prueba antes",
        action: {
          label: "Enviar prueba",
          onClick: () => setTestSendDialogOpen(true),
        },
      });
    }

    return checks;
  }, [campaign, stats, testEvents.length]);

  const canStartCampaign = useMemo(() => {
    if (!campaign || !stats) return false;
    if (campaign.status !== "ready") return false;
    if (stats.pending === 0) return false;
    return readinessChecks.every((c) => c.status !== "error");
  }, [campaign, stats, readinessChecks]);

  // ─────────────────────────────────────────────────────────────────────────────
  // Handlers
  // ─────────────────────────────────────────────────────────────────────────────
  const handleGenerateSnapshot = async () => {
    setSnapshotLoading(true);
    try {
      const result = await generateSnapshot(campaignId, snapshotForce);
      toast.success(result.message);
      setSnapshotDialogOpen(false);
      setSnapshotForce(false);
      loadCampaign();
      loadDrafts();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al generar snapshot");
    } finally {
      setSnapshotLoading(false);
    }
  };

  const handleExclude = async (item: DraftItem) => {
    try {
      await updateDraftItem(campaignId, item.id, "exclude");
      toast.success(`Excluido: ${item.toEmail}`);
      loadDrafts();
      loadCampaign();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al excluir");
    }
  };

  const handleInclude = async (item: DraftItem) => {
    try {
      await updateDraftItem(campaignId, item.id, "include");
      toast.success(`Incluido: ${item.toEmail}`);
      loadDrafts();
      loadCampaign();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al incluir");
    }
  };

  const handleIncludeContact = async (contact: Contact) => {
    setIncludingContact(true);
    try {
      await includeContactManually(campaignId, contact.id);
      toast.success(`Contacto incluido: ${contact.email}`);
      setIncludeDialogOpen(false);
      setContactSearch("");
      loadDrafts();
      loadCampaign();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al incluir contacto");
    } finally {
      setIncludingContact(false);
    }
  };

  const handleSendTestReal = async () => {
    if (!testEmail.trim()) {
      toast.error("Ingresá un email válido");
      return;
    }
    setSendingTest(true);
    try {
      const result = await sendTestReal(campaignId, testEmail.trim());
      toast.success(result.message);
      setTestSendDialogOpen(false);
      setTestEmail("");
      loadTestEvents();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al enviar prueba");
    } finally {
      setSendingTest(false);
    }
  };

  const handleStartCampaign = async () => {
    setStartingCampaign(true);
    try {
      const result = await startCampaign(campaignId);
      toast.success(result.message);
      setStartDialogOpen(false);
      loadCampaign();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al iniciar campaña");
    } finally {
      setStartingCampaign(false);
    }
  };

  const handlePauseCampaign = async () => {
    setPausingCampaign(true);
    try {
      const result = await pauseCampaign(campaignId);
      toast.success(result.message);
      loadCampaign();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al pausar campaña");
    } finally {
      setPausingCampaign(false);
    }
  };

  const handleRetryCampaign = async () => {
    setRetryingCampaign(true);
    try {
      const result = await retryCampaign(campaignId);
      toast.success(result.message);
      loadCampaign();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al reintentar campaña");
    } finally {
      setRetryingCampaign(false);
    }
  };

  const handleCancelCampaign = async () => {
    setCancellingCampaign(true);
    try {
      const result = await cancelCampaign(campaignId);
      toast.success(result.message);
      setCancelDialogOpen(false);
      loadCampaign();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al cancelar campaña");
    } finally {
      setCancellingCampaign(false);
    }
  };

  // Helper: apply signature to HTML (for preview)
  const applySignatureToHtml = useCallback(
    (html: string): string => {
      // Resolve effective signature (campaign override > global)
      const signatureHtml =
        (campaign?.signatureHtmlOverride?.trim() ||
          settings?.signatureDefaultHtml?.trim()) ??
        null;

      if (!signatureHtml) return html;

      // Insert signature before </body> if exists, otherwise append
      const signatureBlock = `\n<div style="margin-top:20px;">${signatureHtml}</div>`;
      const bodyCloseRegex = /<\/body>/i;
      const match = bodyCloseRegex.exec(html);

      if (match) {
        return html.slice(0, match.index) + signatureBlock + html.slice(match.index);
      }
      return html + signatureBlock;
    },
    [campaign?.signatureHtmlOverride, settings?.signatureDefaultHtml]
  );

  // Compute preview HTML with signature applied (for DraftItems) and sanitized
  const previewHtmlWithSignature = useMemo(() => {
    if (!previewItem?.renderedHtml) return "";

    let html = previewItem.renderedHtml;

    // DraftItems have 'state' property, TestSendEvents don't
    // For DraftItems: apply signature (not stored in draft, applied at send time)
    // For TestSendEvents: signature already applied when created (after our update)
    const isDraftItem = "state" in previewItem;
    if (isDraftItem) {
      html = applySignatureToHtml(html);
    }

    // Sanitize for safe rendering
    return DOMPurify.sanitize(html);
  }, [previewItem, applySignatureToHtml]);

  // Compute raw HTML with signature (for copying/opening in new tab)
  const previewHtmlRaw = useMemo(() => {
    if (!previewItem?.renderedHtml) return "";

    const isDraftItem = "state" in previewItem;
    if (isDraftItem) {
      return applySignatureToHtml(previewItem.renderedHtml);
    }
    return previewItem.renderedHtml;
  }, [previewItem, applySignatureToHtml]);

  const handleCopyHtml = () => {
    if (previewHtmlRaw) {
      navigator.clipboard.writeText(previewHtmlRaw);
      toast.success("HTML copiado al portapapeles");
    }
  };

  const handleCopySubject = () => {
    if (previewItem?.renderedSubject) {
      navigator.clipboard.writeText(previewItem.renderedSubject);
      toast.success("Asunto copiado al portapapeles");
    }
  };

  const handleOpenInNewTab = () => {
    if (previewHtmlRaw) {
      const blob = new Blob([previewHtmlRaw], { type: "text/html" });
      const url = URL.createObjectURL(blob);
      window.open(url, "_blank");
    }
  };

  // Pagination
  const currentPage = Math.floor(draftsOffset / PAGE_SIZE) + 1;
  const totalPages = Math.ceil(draftsTotal / PAGE_SIZE);

  // Check if actions are allowed based on status
  const canModifyDrafts = campaign?.status === "draft" || campaign?.status === "ready";
  const isFinalState = campaign?.status === "completed" || campaign?.status === "cancelled";

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-slate-600 border-t-blue-500" />
      </div>
    );
  }

  if (!campaign) {
    return null;
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Step Status Calculation
  // ─────────────────────────────────────────────────────────────────────────────
  const getStepStatus = (step: "template" | "audience" | "snapshot" | "test" | "send"): StepStatus => {
    switch (step) {
      case "template":
        return campaign.templateId ? "complete" : "warning";
      case "audience":
        if (stats?.totalDrafts && stats.totalDrafts > 0) return "complete";
        return campaign.templateId ? "pending" : "pending";
      case "snapshot":
        if (stats?.totalDrafts && stats.totalDrafts > 0) {
          return stats.pending > 0 ? "complete" : "warning";
        }
        return "pending";
      case "test":
        if (testEvents.length > 0) return "complete";
        if (campaign.status === "ready" || campaign.status === "sending") return "warning";
        return "pending";
      case "send":
        if (campaign.status === "completed") return "complete";
        if (campaign.status === "sending") return "current";
        if (campaign.status === "paused") return "warning";
        if (campaign.status === "cancelled") return "warning";
        return "pending";
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push("/campaigns")}
            className="mt-1 text-slate-400 hover:text-white"
          >
            <IconArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-white">{campaign.name}</h1>
              <Badge
                variant={
                  campaign.status === "completed"
                    ? "default"
                    : campaign.status === "sending"
                      ? "default"
                      : campaign.status === "cancelled"
                        ? "destructive"
                        : "secondary"
                }
                className={
                  campaign.status === "sending"
                    ? "animate-pulse bg-green-600"
                    : campaign.status === "completed"
                      ? "bg-green-600"
                      : ""
                }
              >
                {STATUS_LABELS[campaign.status]}
              </Badge>
            </div>
            <p className="mt-1 text-sm text-slate-400">
              Plantilla: {campaign.templateName ?? "Sin plantilla"}
              {campaign.fromAlias && ` • Remitente: ${campaign.fromAlias}`}
              {campaign.emailAccountId && " • Cuenta de envío configurada"}
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2">
          {!isFinalState && (
            <Button
              type="button"
              variant="outline"
              onClick={() => setTestSendDialogOpen(true)}
              className="border-slate-700 bg-slate-900 text-slate-300 hover:bg-slate-800"
            >
              <IconMail className="mr-2 h-4 w-4" />
              Enviar prueba
            </Button>
          )}
          
          {campaign.status === "draft" && (
            <Button
              onClick={() => setSnapshotDialogOpen(true)}
              className="bg-blue-600 hover:bg-blue-700"
            >
              <IconCamera className="mr-2 h-4 w-4" />
              {stats?.totalDrafts ? "Regenerar snapshot" : "Generar snapshot"}
            </Button>
          )}

          {campaign.status === "ready" && (
            <>
              <Button
                variant="outline"
                onClick={() => setSnapshotDialogOpen(true)}
                className="border-slate-700 bg-slate-900 text-slate-300 hover:bg-slate-800"
              >
                <IconCamera className="mr-2 h-4 w-4" />
                Regenerar
              </Button>
              <Button
                onClick={() => setStartDialogOpen(true)}
                disabled={!canStartCampaign}
                className="bg-green-600 hover:bg-green-700 disabled:opacity-50"
              >
                <IconPlayerPlay className="mr-2 h-4 w-4" />
                Iniciar envío
              </Button>
            </>
          )}

          {campaign.status === "sending" && (
            <>
              <Button
                variant="outline"
                onClick={handleRetryCampaign}
                disabled={retryingCampaign}
                className="border-blue-600 bg-blue-600/10 text-blue-400 hover:bg-blue-600/20"
                title="Reprogramar el envío si está atascado"
              >
                {retryingCampaign ? (
                  <IconLoader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <IconRefresh className="mr-2 h-4 w-4" />
                )}
                Reintentar
              </Button>
              <Button
                variant="outline"
                onClick={handlePauseCampaign}
                disabled={pausingCampaign}
                className="border-amber-600 bg-amber-600/10 text-amber-400 hover:bg-amber-600/20"
              >
                {pausingCampaign ? (
                  <IconLoader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <IconPlayerPause className="mr-2 h-4 w-4" />
                )}
                Pausar
              </Button>
              <Button
                variant="outline"
                onClick={() => setCancelDialogOpen(true)}
                className="border-red-600 bg-red-600/10 text-red-400 hover:bg-red-600/20"
              >
                <IconPlayerStop className="mr-2 h-4 w-4" />
                Cancelar
              </Button>
            </>
          )}

          {campaign.status === "paused" && (
            <>
              <Button
                onClick={() => setStartDialogOpen(true)}
                className="bg-green-600 hover:bg-green-700"
              >
                <IconPlayerPlay className="mr-2 h-4 w-4" />
                Reanudar
              </Button>
              <Button
                variant="outline"
                onClick={() => setCancelDialogOpen(true)}
                className="border-red-600 bg-red-600/10 text-red-400 hover:bg-red-600/20"
              >
                <IconPlayerStop className="mr-2 h-4 w-4" />
                Cancelar
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Stepper - Always visible */}
      <Card className="border-slate-800 bg-slate-900/50">
        <CardContent className="py-4">
          <div className="flex items-center justify-between gap-4">
            <StepIndicator
              label="Plantilla"
              status={getStepStatus("template")}
              description={campaign.templateName ?? undefined}
              icon={IconTemplate}
            />
            <div className="h-0.5 flex-1 bg-slate-700" />
            <StepIndicator
              label="Audiencia"
              status={getStepStatus("audience")}
              description={
                stats?.totalDrafts
                  ? `${stats.totalDrafts} contactos`
                  : undefined
              }
              icon={IconUsers}
            />
            <div className="h-0.5 flex-1 bg-slate-700" />
            <StepIndicator
              label="Snapshot"
              status={getStepStatus("snapshot")}
              description={
                stats?.pending
                  ? `${stats.pending} pendientes`
                  : stats?.totalDrafts
                    ? "Sin pendientes"
                    : undefined
              }
              icon={IconCamera}
            />
            <div className="h-0.5 flex-1 bg-slate-700" />
            <StepIndicator
              label="Prueba"
              status={getStepStatus("test")}
              description={
                testEvents.length > 0
                  ? `${testEvents.length} enviada(s)`
                  : undefined
              }
              icon={IconMail}
            />
            <div className="h-0.5 flex-1 bg-slate-700" />
            <StepIndicator
              label="Envío"
              status={getStepStatus("send")}
              description={
                campaign.status === "completed"
                  ? `${stats?.sent ?? 0} enviados`
                  : campaign.status === "sending"
                    ? "En progreso..."
                    : undefined
              }
              icon={IconSend}
            />
          </div>
        </CardContent>
      </Card>

      {/* Sending Status Panel - Only when sending */}
      {campaign.status === "sending" && stats && (
        <Card className="border-green-600/30 bg-green-600/5">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <div className="relative">
                <IconSend className="h-5 w-5 text-green-400" />
                <span className="absolute -right-1 -top-1 h-2 w-2 animate-ping rounded-full bg-green-400" />
              </div>
              <CardTitle className="text-lg text-green-400">
                Envío en progreso
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-4">
              <div className="text-center">
                <p className="text-3xl font-bold text-white">{stats.sent}</p>
                <p className="text-xs text-slate-400">Enviados</p>
              </div>
              <div className="text-center">
                <p className="text-3xl font-bold text-amber-400">{stats.pending}</p>
                <p className="text-xs text-slate-400">Pendientes</p>
              </div>
              <div className="text-center">
                <p className="text-3xl font-bold text-red-400">{stats.failed}</p>
                <p className="text-xs text-slate-400">Fallidos</p>
              </div>
              <div className="text-center">
                <p className="text-3xl font-bold text-blue-400">
                  {stats.totalDrafts > 0
                    ? Math.round((stats.sent / stats.totalDrafts) * 100)
                    : 0}%
                </p>
                <p className="text-xs text-slate-400">Progreso</p>
              </div>
            </div>
            {estimatedTime && stats.pending > 0 && (
              <div className="mt-4 flex items-center justify-center gap-6 rounded-lg border border-slate-700 bg-slate-900/50 p-3 text-sm">
                <div className="flex items-center gap-2 text-slate-400">
                  <IconClock className="h-4 w-4" />
                  ~{estimatedTime.emailsPerHour} emails/hora
                </div>
                <div className="flex items-center gap-2 text-slate-400">
                  <IconCalendarEvent className="h-4 w-4" />
                  Tiempo restante: ~{estimatedTime.todayTime}
                </div>
              </div>
            )}
            <p className="mt-3 text-center text-xs text-slate-500">
              Se actualiza automáticamente cada 10 segundos
            </p>
          </CardContent>
        </Card>
      )}

      {/* Readiness Panel - Only for ready campaigns */}
      {campaign.status === "ready" && (
        <Card className="border-slate-800 bg-slate-900/50">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-white">
              <IconCircleDashed className="h-5 w-5" />
              Verificación antes de enviar
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {readinessChecks.map((check, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between rounded-lg border border-slate-800 bg-slate-950/50 px-4 py-3"
                >
                  <div className="flex items-center gap-3">
                    {check.status === "ok" ? (
                      <IconCircleCheck className="h-5 w-5 text-green-400" />
                    ) : check.status === "warning" ? (
                      <IconAlertTriangle className="h-5 w-5 text-amber-400" />
                    ) : (
                      <IconX className="h-5 w-5 text-red-400" />
                    )}
                    <div>
                      <p className="font-medium text-slate-200">{check.label}</p>
                      <p className="text-sm text-slate-500">{check.message}</p>
                    </div>
                  </div>
                  {check.action && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={check.action.onClick}
                      className="border-slate-700 bg-slate-900 text-slate-300 hover:bg-slate-800"
                    >
                      {check.action.label}
                    </Button>
                  )}
                </div>
              ))}
            </div>
            {!canStartCampaign && (
              <div className="mt-4 rounded-lg border border-red-500/30 bg-red-500/10 p-3">
                <p className="text-sm text-red-300">
                  <IconAlertTriangle className="mr-2 inline h-4 w-4" />
                  Resolvé los problemas marcados antes de iniciar el envío.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Stats - Compact view for non-sending states */}
      {stats && stats.totalDrafts > 0 && campaign.status !== "sending" && (
        <div className="grid gap-4 sm:grid-cols-4">
          <Card className="border-slate-800 bg-slate-900/50">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-slate-400">
                Total
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-white">{stats.totalDrafts}</p>
            </CardContent>
          </Card>
          <Card className="border-slate-800 bg-slate-900/50">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-slate-400">
                Pendientes
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-amber-400">{stats.pending}</p>
            </CardContent>
          </Card>
          <Card className="border-slate-800 bg-slate-900/50">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-slate-400">
                Enviados
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-green-400">{stats.sent}</p>
            </CardContent>
          </Card>
          <Card className="border-slate-800 bg-slate-900/50">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-slate-400">
                Excluidos
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-slate-500">{stats.excluded}</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Drafts Table */}
      {stats && stats.totalDrafts > 0 && (
        <Card className="border-slate-800 bg-slate-900/50">
          <CardHeader>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <CardTitle className="text-white">
                Destinatarios
              </CardTitle>
              <div className="flex flex-wrap gap-2">
                {/* State Filter Tabs */}
                <div className="flex rounded-lg border border-slate-700 bg-slate-900 p-1">
                  {DRAFT_TABS.map((tab) => (
                    <button
                      key={tab.id}
                      onClick={() => setDraftsStateFilter(tab.id)}
                      className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                        draftsStateFilter === tab.id
                          ? "bg-slate-700 text-white"
                          : "text-slate-400 hover:text-white"
                      }`}
                    >
                      {tab.label}
                      {tab.id !== "all" && stats && (
                        <span className="ml-1.5 text-xs opacity-60">
                          ({tab.id === "pending"
                            ? stats.pending
                            : tab.id === "sent"
                              ? stats.sent
                              : tab.id === "failed"
                                ? stats.failed
                                : stats.excluded}
                          )
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className="mt-4 flex gap-2">
              <div className="relative flex-1">
                <IconSearch className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                <Input
                  placeholder="Buscar por email..."
                  value={draftsQuery}
                  onChange={(e) => setDraftsQuery(e.target.value)}
                  className="border-slate-700 bg-slate-900 pl-9 text-slate-200"
                />
              </div>
              {canModifyDrafts && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIncludeDialogOpen(true)}
                  className="border-slate-700 bg-slate-900 text-slate-300 hover:bg-slate-800"
                >
                  <IconUserPlus className="mr-2 h-4 w-4" />
                  Incluir contacto
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {draftsLoading ? (
              <div className="flex items-center justify-center py-8">
                <IconLoader2 className="h-6 w-6 animate-spin text-slate-400" />
              </div>
            ) : draftItems.length === 0 ? (
              <div className="py-8 text-center">
                <p className="text-slate-500">
                  {draftsQuery || draftsStateFilter !== "all"
                    ? "No hay resultados para esta búsqueda"
                    : "No hay destinatarios"}
                </p>
              </div>
            ) : (
              <>
                <div className="rounded-lg border border-slate-800">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-slate-800 hover:bg-transparent">
                        <TableHead className="text-slate-400">Email</TableHead>
                        <TableHead className="text-slate-400">Asunto</TableHead>
                        <TableHead className="text-slate-400">Estado</TableHead>
                        <TableHead className="w-12" />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {draftItems.map((item) => (
                        <TableRow
                          key={item.id}
                          className="border-slate-800 hover:bg-slate-900/50"
                        >
                          <TableCell className="font-medium text-slate-200">
                            {item.toEmail}
                            {item.includedManually && (
                              <Badge
                                variant="outline"
                                className="ml-2 text-xs text-blue-400"
                              >
                                Manual
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell className="max-w-xs truncate text-slate-300">
                            {item.renderedSubject}
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant={
                                item.state === "pending" || item.state === "sending"
                                  ? "secondary"
                                  : item.state === "sent"
                                    ? "default"
                                    : item.state === "excluded"
                                      ? "outline"
                                      : "destructive"
                              }
                              className={`text-xs ${
                                item.state === "sent" ? "bg-green-600" : ""
                              }`}
                            >
                              {DRAFT_STATE_LABELS[item.state]}
                            </Badge>
                            {item.error && (
                              <span
                                className="ml-2 text-xs text-red-400"
                                title={item.error}
                              >
                                ⚠️
                              </span>
                            )}
                          </TableCell>
                          <TableCell>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-8 w-8 p-0 text-slate-400 hover:text-white"
                                >
                                  <IconDots className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent
                                align="end"
                                className="border-slate-800 bg-slate-950"
                              >
                                <DropdownMenuItem
                                  onClick={() => setPreviewItem(item)}
                                  className="cursor-pointer text-slate-300 focus:bg-slate-800 focus:text-white"
                                >
                                  <IconEye className="mr-2 h-4 w-4" />
                                  Ver preview
                                </DropdownMenuItem>
                                {canModifyDrafts && item.state === "excluded" && (
                                  <DropdownMenuItem
                                    onClick={() => handleInclude(item)}
                                    className="cursor-pointer text-green-400 focus:bg-green-500/10 focus:text-green-400"
                                  >
                                    <IconCheck className="mr-2 h-4 w-4" />
                                    Incluir
                                  </DropdownMenuItem>
                                )}
                                {canModifyDrafts && item.state === "pending" && (
                                  <DropdownMenuItem
                                    onClick={() => handleExclude(item)}
                                    className="cursor-pointer text-red-400 focus:bg-red-500/10 focus:text-red-400"
                                  >
                                    <IconX className="mr-2 h-4 w-4" />
                                    Excluir
                                  </DropdownMenuItem>
                                )}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="mt-4 flex items-center justify-between">
                    <p className="text-sm text-slate-400">
                      Mostrando {draftsOffset + 1}-
                      {Math.min(draftsOffset + PAGE_SIZE, draftsTotal)} de{" "}
                      {draftsTotal}
                    </p>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={currentPage === 1}
                        onClick={() =>
                          setDraftsOffset(Math.max(0, draftsOffset - PAGE_SIZE))
                        }
                        className="border-slate-700 bg-slate-900 text-slate-300 hover:bg-slate-800"
                      >
                        <IconChevronLeft className="h-4 w-4" />
                      </Button>
                      <span className="text-sm text-slate-400">
                        Página {currentPage} de {totalPages}
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={currentPage >= totalPages}
                        onClick={() => setDraftsOffset(draftsOffset + PAGE_SIZE)}
                        className="border-slate-700 bg-slate-900 text-slate-300 hover:bg-slate-800"
                      >
                        <IconChevronRight className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      )}

      {/* Test Events */}
      {testEvents.length > 0 && (
        <Card className="border-slate-800 bg-slate-900/50">
          <CardHeader>
            <CardTitle className="text-white">
              Pruebas enviadas ({testEvents.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="rounded-lg border border-slate-800">
              <Table>
                <TableHeader>
                  <TableRow className="border-slate-800 hover:bg-transparent">
                    <TableHead className="text-slate-400">Email</TableHead>
                    <TableHead className="text-slate-400">Asunto</TableHead>
                    <TableHead className="text-slate-400">Fecha</TableHead>
                    <TableHead className="w-12" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {testEvents.map((event) => (
                    <TableRow
                      key={event.id}
                      className="border-slate-800 hover:bg-slate-900/50"
                    >
                      <TableCell className="text-slate-200">
                        {event.toEmail}
                      </TableCell>
                      <TableCell className="max-w-xs truncate text-slate-300">
                        {event.renderedSubject}
                      </TableCell>
                      <TableCell className="text-slate-400">
                        {new Date(event.createdAt).toLocaleString("es-AR")}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setPreviewItem(event)}
                          className="h-8 w-8 p-0 text-slate-400 hover:text-white"
                        >
                          <IconEye className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Snapshot Dialog */}
      <Dialog open={snapshotDialogOpen} onOpenChange={setSnapshotDialogOpen}>
        <DialogContent className="border-slate-800 bg-slate-950 sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-white">
              {stats?.totalDrafts ? "Regenerar snapshot" : "Generar snapshot"}
            </DialogTitle>
            <DialogDescription className="text-slate-400">
              {stats?.totalDrafts
                ? `Ya existen ${stats.totalDrafts} borradores. Regenerar eliminará todos los borradores actuales y creará nuevos.`
                : "Se crearán borradores renderizados para todos los contactos que coincidan con los filtros de la campaña."}
            </DialogDescription>
          </DialogHeader>
          {stats?.totalDrafts ? (
            <div className="flex items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3">
              <input
                type="checkbox"
                id="forceSnapshot"
                checked={snapshotForce}
                onChange={(e) => setSnapshotForce(e.target.checked)}
                className="rounded border-slate-600"
              />
              <label
                htmlFor="forceSnapshot"
                className="text-sm text-amber-200"
              >
                Confirmo que quiero eliminar los {stats.totalDrafts} borradores
                existentes y regenerar
              </label>
            </div>
          ) : null}
          <DialogFooter className="gap-2">
            <Button
              variant="ghost"
              onClick={() => setSnapshotDialogOpen(false)}
              className="text-slate-400 hover:text-white"
            >
              Cancelar
            </Button>
            <Button
              onClick={handleGenerateSnapshot}
              disabled={snapshotLoading || (!!stats?.totalDrafts && !snapshotForce)}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {snapshotLoading ? (
                <>
                  <IconLoader2 className="mr-2 h-4 w-4 animate-spin" />
                  Generando...
                </>
              ) : (
                "Generar"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Include Contact Dialog */}
      <Dialog open={includeDialogOpen} onOpenChange={setIncludeDialogOpen}>
        <DialogContent className="border-slate-800 bg-slate-950 sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-white">Incluir contacto</DialogTitle>
            <DialogDescription className="text-slate-400">
              Buscá un contacto existente para agregarlo a esta campaña
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="relative">
              <IconSearch className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
              <Input
                placeholder="Buscar por email o nombre..."
                value={contactSearch}
                onChange={(e) => setContactSearch(e.target.value)}
                className="border-slate-700 bg-slate-900 pl-9 text-slate-200"
                autoFocus
              />
            </div>
            <div className="max-h-64 overflow-y-auto rounded-lg border border-slate-800">
              {searchLoading ? (
                <div className="flex items-center justify-center py-8">
                  <IconLoader2 className="h-5 w-5 animate-spin text-slate-400" />
                </div>
              ) : searchResults.length === 0 ? (
                <p className="py-8 text-center text-sm text-slate-500">
                  {contactSearch
                    ? "No se encontraron contactos"
                    : "Escribí para buscar"}
                </p>
              ) : (
                <div className="divide-y divide-slate-800">
                  {searchResults.map((contact) => (
                    <button
                      key={contact.id}
                      onClick={() => handleIncludeContact(contact)}
                      disabled={includingContact}
                      className="flex w-full items-center justify-between px-3 py-2 text-left hover:bg-slate-900 disabled:opacity-50"
                    >
                      <div>
                        <p className="text-sm text-slate-200">{contact.email}</p>
                        {(contact.firstName || contact.lastName) && (
                          <p className="text-xs text-slate-500">
                            {[contact.firstName, contact.lastName]
                              .filter(Boolean)
                              .join(" ")}
                          </p>
                        )}
                      </div>
                      <IconUserPlus className="h-4 w-4 text-slate-400" />
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Test Send Dialog */}
      <Dialog open={testSendDialogOpen} onOpenChange={setTestSendDialogOpen}>
        <DialogContent className="border-slate-800 bg-slate-950 sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-white">
              Enviar email de prueba
            </DialogTitle>
            <DialogDescription className="text-slate-400">
              Enviá un email de prueba real a cualquier dirección para verificar
              cómo se ve la plantilla. El asunto incluirá [TEST].
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label htmlFor="testEmail" className="mb-2 block text-sm font-medium text-slate-300">
                Email de destino
              </label>
              <Input
                id="testEmail"
                type="email"
                placeholder="tu@email.com"
                value={testEmail}
                onChange={(e) => setTestEmail(e.target.value)}
                className="border-slate-700 bg-slate-900 text-slate-200"
                autoFocus
              />
            </div>
            <div className="rounded-lg border border-blue-500/30 bg-blue-500/10 p-3">
              <p className="text-sm text-blue-300">
                💡 Se enviará un email real usando tu cuenta de email configurada.
                Los datos de contacto usarán valores de prueba.
              </p>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button
              variant="ghost"
              onClick={() => setTestSendDialogOpen(false)}
              className="text-slate-400 hover:text-white"
            >
              Cancelar
            </Button>
            <Button
              onClick={handleSendTestReal}
              disabled={sendingTest || !testEmail.trim()}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {sendingTest ? (
                <>
                  <IconLoader2 className="mr-2 h-4 w-4 animate-spin" />
                  Enviando...
                </>
              ) : (
                <>
                  <IconSend className="mr-2 h-4 w-4" />
                  Enviar prueba
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Start Campaign Dialog */}
      <Dialog open={startDialogOpen} onOpenChange={setStartDialogOpen}>
        <DialogContent className="border-slate-800 bg-slate-950 sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-white text-lg">
              {campaign.status === "paused" ? "Reanudar campaña" : "Iniciar campaña"}
            </DialogTitle>
            <DialogDescription className="text-slate-400">
              {campaign.status === "paused"
                ? "La campaña continuará enviando emails desde donde se pausó."
                : `Se comenzarán a enviar ${stats?.pending ?? 0} emails programados.`}
            </DialogDescription>
          </DialogHeader>

          {/* Time estimation info */}
          {estimatedTime && (
            <div className="space-y-4">
              {/* Summary cards */}
              <div className="grid grid-cols-3 gap-3">
                <div className="rounded-lg border border-slate-700 bg-slate-900/50 p-3 text-center">
                  <p className="text-2xl font-bold text-white">{estimatedTime.totalEmails}</p>
                  <p className="text-xs text-slate-500">emails</p>
                </div>
                <div className="rounded-lg border border-slate-700 bg-slate-900/50 p-3 text-center">
                  <p className="text-2xl font-bold text-amber-400">{estimatedTime.todayTime}</p>
                  <p className="text-xs text-slate-500">tiempo estimado</p>
                </div>
                <div className="rounded-lg border border-slate-700 bg-slate-900/50 p-3 text-center">
                  <p className="text-2xl font-bold text-blue-400">{estimatedTime.daysNeeded}</p>
                  <p className="text-xs text-slate-500">{estimatedTime.daysNeeded === 1 ? 'día' : 'días'}</p>
                </div>
              </div>

              {/* Detailed info */}
              <div className="rounded-lg border border-slate-700 bg-slate-900/50 p-4">
                <div className="flex items-start gap-3">
                  <IconInfoCircle className="h-5 w-5 text-blue-400 shrink-0 mt-0.5" />
                  <div className="space-y-1.5 text-sm">
                    <p className="text-slate-300">Detalles del envío:</p>
                    <ul className="space-y-1 text-slate-400">
                      <li className="flex items-center gap-2">
                        <IconClock className="h-3.5 w-3.5" />
                        ~{estimatedTime.emailsPerHour} emails/hora
                      </li>
                      <li className="flex items-center gap-2">
                        <IconMail className="h-3.5 w-3.5" />
                        Cuota diaria: {estimatedTime.dailyQuota} emails
                      </li>
                      {estimatedTime.daysNeeded > 1 && (
                        <li className="flex items-center gap-2 text-amber-300">
                          <IconCalendarEvent className="h-3.5 w-3.5" />
                          La campaña tardará {estimatedTime.daysNeeded} días en completarse
                        </li>
                      )}
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="rounded-lg border border-green-500/30 bg-green-500/10 p-3">
            <p className="text-sm text-green-300">
              ✓ El envío se realizará en background. Podés cerrar el navegador.
            </p>
          </div>
          <DialogFooter className="gap-2">
            <Button
              variant="ghost"
              onClick={() => setStartDialogOpen(false)}
              className="text-slate-400 hover:text-white"
            >
              Cancelar
            </Button>
            <Button
              onClick={handleStartCampaign}
              disabled={startingCampaign}
              className="bg-green-600 hover:bg-green-700"
            >
              {startingCampaign ? (
                <>
                  <IconLoader2 className="mr-2 h-4 w-4 animate-spin" />
                  Iniciando...
                </>
              ) : (
                <>
                  <IconPlayerPlay className="mr-2 h-4 w-4" />
                  {campaign.status === "paused" ? "Reanudar" : "Iniciar"}
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Cancel Campaign Dialog */}
      <Dialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
        <DialogContent className="border-slate-800 bg-slate-950 sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-white">Cancelar campaña</DialogTitle>
            <DialogDescription className="text-slate-400">
              Esta acción detendrá el envío de la campaña permanentemente. 
              Los emails pendientes no se enviarán.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3">
              <p className="text-sm text-red-300">
                ⚠️ Esta acción no se puede deshacer. Los emails ya enviados no se verán afectados.
              </p>
            </div>
            {stats && stats.pending > 0 && (
              <div className="rounded-lg border border-slate-700 bg-slate-900/50 p-3">
                <p className="text-sm text-slate-300">
                  <strong>{stats.pending}</strong> emails pendientes no se enviarán.
                </p>
                <p className="text-sm text-slate-300">
                  <strong>{stats.sent}</strong> emails ya fueron enviados.
                </p>
              </div>
            )}
          </div>
          <DialogFooter className="gap-2">
            <Button
              variant="ghost"
              onClick={() => setCancelDialogOpen(false)}
              className="text-slate-400 hover:text-white"
            >
              Volver
            </Button>
            <Button
              onClick={handleCancelCampaign}
              disabled={cancellingCampaign}
              className="bg-red-600 hover:bg-red-700"
            >
              {cancellingCampaign ? (
                <>
                  <IconLoader2 className="mr-2 h-4 w-4 animate-spin" />
                  Cancelando...
                </>
              ) : (
                <>
                  <IconPlayerStop className="mr-2 h-4 w-4" />
                  Cancelar campaña
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Preview Dialog - Enhanced */}
      <Dialog open={!!previewItem} onOpenChange={() => setPreviewItem(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto border-slate-800 bg-slate-950 sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle className="text-white">Preview del email</DialogTitle>
            <DialogDescription className="text-slate-400">
              Para: {previewItem?.toEmail}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {/* Subject with copy button */}
            <div>
              <div className="mb-1 flex items-center justify-between">
                <p className="text-xs font-medium text-slate-400">Asunto</p>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleCopySubject}
                  className="h-7 px-2 text-slate-400 hover:text-white"
                >
                  <IconCopy className="mr-1 h-3 w-3" />
                  Copiar
                </Button>
              </div>
              <p className="rounded border border-slate-800 bg-slate-900 px-3 py-2 text-slate-200">
                {previewItem?.renderedSubject}
              </p>
            </div>
            
            {/* Content with action buttons */}
            <div>
              <div className="mb-1 flex items-center justify-between">
                <p className="text-xs font-medium text-slate-400">Contenido</p>
                <div className="flex gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleCopyHtml}
                    className="h-7 px-2 text-slate-400 hover:text-white"
                  >
                    <IconCode className="mr-1 h-3 w-3" />
                    HTML
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleOpenInNewTab}
                    className="h-7 px-2 text-slate-400 hover:text-white"
                  >
                    <IconExternalLink className="mr-1 h-3 w-3" />
                    Nueva pestaña
                  </Button>
                </div>
              </div>
              <div
                className="max-h-[50vh] overflow-y-auto rounded border border-slate-800 bg-white p-4"
                dangerouslySetInnerHTML={{
                  __html: previewHtmlWithSignature,
                }}
              />
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
