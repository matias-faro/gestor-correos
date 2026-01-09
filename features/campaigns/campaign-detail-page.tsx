"use client";

import { useState, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
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
} from "@tabler/icons-react";
import { toast } from "sonner";
import {
  fetchCampaign,
  generateSnapshot,
  fetchDraftItems,
  updateDraftItem,
  includeContactManually,
  sendTestSimulated,
  sendTestReal,
  fetchTestSendEvents,
  startCampaign,
  pauseCampaign,
  cancelCampaign,
} from "./api";
import { fetchContacts } from "@/features/contacts/api";
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
  sent: "Enviado",
  failed: "Fallido",
  excluded: "Excluido",
};

const PAGE_SIZE = 25;

type CampaignDetailPageProps = {
  campaignId: string;
};

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
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [cancellingCampaign, setCancellingCampaign] = useState(false);

  const [previewItem, setPreviewItem] = useState<DraftItem | TestSendEvent | null>(null);

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
  }, [campaignId, draftsQuery, draftsOffset]);

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


  // Handlers
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

  // Pagination
  const currentPage = Math.floor(draftsOffset / PAGE_SIZE) + 1;
  const totalPages = Math.ceil(draftsTotal / PAGE_SIZE);

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
                  campaign.status === "ready"
                    ? "secondary"
                    : campaign.status === "sending"
                      ? "default"
                      : "outline"
                }
              >
                {STATUS_LABELS[campaign.status]}
              </Badge>
            </div>
            <p className="mt-1 text-sm text-slate-400">
              Plantilla: {campaign.templateName ?? "Sin plantilla"}
              {campaign.fromAlias && ` • Remitente: ${campaign.fromAlias}`}
            </p>
          </div>
        </div>

        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => setTestSendDialogOpen(true)}
            className="border-slate-700 bg-slate-900 text-slate-300 hover:bg-slate-800"
          >
            <IconMail className="mr-2 h-4 w-4" />
            Enviar prueba real
          </Button>
          
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
                Regenerar snapshot
              </Button>
              <Button
                onClick={() => setStartDialogOpen(true)}
                className="bg-green-600 hover:bg-green-700"
              >
                <IconPlayerPlay className="mr-2 h-4 w-4" />
                Iniciar campaña
              </Button>
            </>
          )}

          {campaign.status === "sending" && (
            <>
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

      {/* Stats */}
      {stats && stats.totalDrafts > 0 && (
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
            <div className="flex items-center justify-between">
              <CardTitle className="text-white">
                Borradores ({draftsTotal})
              </CardTitle>
              <div className="flex gap-2">
                <div className="relative">
                  <IconSearch className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                  <Input
                    placeholder="Buscar por email..."
                    value={draftsQuery}
                    onChange={(e) => {
                      setDraftsQuery(e.target.value);
                      setDraftsOffset(0);
                    }}
                    className="w-64 border-slate-700 bg-slate-900 pl-9 text-slate-200"
                  />
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIncludeDialogOpen(true)}
                  className="border-slate-700 bg-slate-900 text-slate-300 hover:bg-slate-800"
                >
                  <IconUserPlus className="mr-2 h-4 w-4" />
                  Incluir contacto
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {draftsLoading ? (
              <div className="flex items-center justify-center py-8">
                <IconLoader2 className="h-6 w-6 animate-spin text-slate-400" />
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
                                item.state === "pending"
                                  ? "secondary"
                                  : item.state === "sent"
                                    ? "default"
                                    : item.state === "excluded"
                                      ? "outline"
                                      : "destructive"
                              }
                              className="text-xs"
                            >
                              {DRAFT_STATE_LABELS[item.state]}
                            </Badge>
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
                                {item.state === "excluded" ? (
                                  <DropdownMenuItem
                                    onClick={() => handleInclude(item)}
                                    className="cursor-pointer text-green-400 focus:bg-green-500/10 focus:text-green-400"
                                  >
                                    <IconCheck className="mr-2 h-4 w-4" />
                                    Incluir
                                  </DropdownMenuItem>
                                ) : item.state === "pending" ? (
                                  <DropdownMenuItem
                                    onClick={() => handleExclude(item)}
                                    className="cursor-pointer text-red-400 focus:bg-red-500/10 focus:text-red-400"
                                  >
                                    <IconX className="mr-2 h-4 w-4" />
                                    Excluir
                                  </DropdownMenuItem>
                                ) : null}
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
                existentes
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
                💡 Se enviará un email real usando tu cuenta de Gmail conectada.
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
        <DialogContent className="border-slate-800 bg-slate-950 sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-white">
              {campaign.status === "paused" ? "Reanudar campaña" : "Iniciar campaña"}
            </DialogTitle>
            <DialogDescription className="text-slate-400">
              {campaign.status === "paused"
                ? "La campaña continuará enviando emails desde donde se pausó."
                : `Se comenzarán a enviar ${stats?.pending ?? 0} emails programados según las ventanas horarias configuradas.`}
            </DialogDescription>
          </DialogHeader>
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
          <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3">
            <p className="text-sm text-red-300">
              ⚠️ Esta acción no se puede deshacer. Los emails ya enviados no se verán afectados.
            </p>
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

      {/* Preview Dialog */}
      <Dialog open={!!previewItem} onOpenChange={() => setPreviewItem(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto border-slate-800 bg-slate-950 sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-white">Preview del email</DialogTitle>
            <DialogDescription className="text-slate-400">
              Para: {previewItem?.toEmail}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <p className="mb-1 text-xs font-medium text-slate-400">Asunto</p>
              <p className="rounded border border-slate-800 bg-slate-900 px-3 py-2 text-slate-200">
                {previewItem?.renderedSubject}
              </p>
            </div>
            <div>
              <p className="mb-1 text-xs font-medium text-slate-400">
                Contenido
              </p>
              <div
                className="max-h-96 overflow-y-auto rounded border border-slate-800 bg-white p-4"
                dangerouslySetInnerHTML={{
                  __html: previewItem?.renderedHtml ?? "",
                }}
              />
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
