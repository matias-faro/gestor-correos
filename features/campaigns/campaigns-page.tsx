"use client";

import { useState, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { IconPlus } from "@tabler/icons-react";
import { toast } from "sonner";
import { CampaignsTable } from "./campaigns-table";
import { CampaignWizard } from "./campaign-wizard";
import { fetchCampaigns, createCampaign, deleteCampaign } from "./api";
import { fetchTemplates } from "@/features/templates/api";
import type { Campaign, CampaignFilters, CampaignStatus, CampaignWithStats } from "./types";
import type { Template } from "@/features/templates/types";

export function CampaignsPage() {
  const router = useRouter();
  const [campaigns, setCampaigns] = useState<CampaignWithStats[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<CampaignStatus | "all">("all");

  // Dialog states
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  // Delete confirmation
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingCampaign, setDeletingCampaign] = useState<Campaign | null>(
    null
  );
  const [deleting, setDeleting] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [campaignsData, templatesData] = await Promise.all([
        fetchCampaigns(),
        fetchTemplates(),
      ]);
      setCampaigns(campaignsData);
      setTemplates(templatesData);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al cargar datos");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Auto-refresh if there are sending campaigns
  useEffect(() => {
    const hasSending = campaigns.some(c => c.status === "sending");
    if (hasSending) {
      const interval = setInterval(loadData, 15000);
      return () => clearInterval(interval);
    }
  }, [campaigns, loadData]);

  const handleCreate = () => {
    if (templates.length === 0) {
      toast.error("Primero debés crear al menos una plantilla");
      return;
    }
    setDialogOpen(true);
  };

  const handleSave = async (data: {
    name: string;
    templateId: string;
    filters: CampaignFilters;
    fromAlias?: string;
    signatureHtmlOverride?: string;
  }) => {
    setSaving(true);
    try {
      const campaign = await createCampaign(data);
      toast.success("Campaña creada");
      setDialogOpen(false);
      router.push(`/campaigns/${campaign.id}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al crear");
    } finally {
      setSaving(false);
    }
  };

  const handleView = (campaign: Campaign) => {
    router.push(`/campaigns/${campaign.id}`);
  };

  const handleDeleteClick = (campaign: Campaign) => {
    setDeletingCampaign(campaign);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!deletingCampaign) return;
    setDeleting(true);
    try {
      await deleteCampaign(deletingCampaign.id);
      toast.success("Campaña eliminada");
      setDeleteDialogOpen(false);
      setDeletingCampaign(null);
      loadData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al eliminar");
    } finally {
      setDeleting(false);
    }
  };

  // Count sending campaigns for header badge
  const sendingCount = campaigns.filter(c => c.status === "sending").length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold text-white">Campañas</h1>
            {sendingCount > 0 && (
              <span className="flex items-center gap-1.5 rounded-full bg-green-600/20 px-3 py-1 text-sm font-medium text-green-400">
                <span className="h-2 w-2 animate-pulse rounded-full bg-green-400" />
                {sendingCount} enviando
              </span>
            )}
          </div>
          <p className="mt-1 text-slate-400">
            Gestiona y monitorea tus campañas de email
          </p>
        </div>
        <Button onClick={handleCreate} className="bg-blue-600 hover:bg-blue-700">
          <IconPlus className="mr-2 h-4 w-4" stroke={2} />
          Nueva campaña
        </Button>
      </div>

      {/* Table */}
      <CampaignsTable
        campaigns={campaigns}
        loading={loading}
        onView={handleView}
        onDelete={handleDeleteClick}
        statusFilter={statusFilter}
        onStatusFilterChange={setStatusFilter}
      />

      {/* Create Wizard */}
      <CampaignWizard
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        templates={templates}
        onSave={handleSave}
        saving={saving}
      />

      {/* Delete Confirmation */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="border-slate-800 bg-slate-950 sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-white">Eliminar campaña</DialogTitle>
            <DialogDescription className="text-slate-400">
              ¿Estás seguro de que querés eliminar la campaña{" "}
              <span className="font-medium text-slate-200">
                {deletingCampaign?.name}
              </span>
              ? Esta acción no se puede deshacer.
            </DialogDescription>
          </DialogHeader>
          {deletingCampaign?.status === "sending" && (
            <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3">
              <p className="text-sm text-amber-300">
                ⚠️ Esta campaña está enviando. Al eliminarla se detendrá el envío.
              </p>
            </div>
          )}
          <DialogFooter className="gap-2">
            <Button
              variant="ghost"
              onClick={() => setDeleteDialogOpen(false)}
              className="text-slate-400 hover:text-white"
            >
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteConfirm}
              disabled={deleting}
              className="bg-red-600 hover:bg-red-700"
            >
              {deleting ? "Eliminando..." : "Eliminar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
