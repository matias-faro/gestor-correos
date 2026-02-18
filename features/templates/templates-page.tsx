"use client";

import { useState, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/app/page-header";
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
import { TemplatesTable } from "./templates-table";
import { TemplateDialog } from "./template-dialog";
import { TemplatePreview } from "./template-preview";
import {
  fetchTemplates,
  createTemplate,
  updateTemplate,
  deleteTemplate,
} from "./api";
import type { Template } from "./types";

export function TemplatesPage() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal states
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<Template | null>(null);
  const [saving, setSaving] = useState(false);

  // Preview modal
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewingTemplate, setPreviewingTemplate] = useState<Template | null>(null);

  // Delete confirmation
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingTemplate, setDeletingTemplate] = useState<Template | null>(null);
  const [deleting, setDeleting] = useState(false);

  const loadTemplates = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchTemplates();
      setTemplates(data);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al cargar plantillas");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTemplates();
  }, [loadTemplates]);

  // Handlers
  const handleCreate = () => {
    setEditingTemplate(null);
    setDialogOpen(true);
  };

  const handleEdit = (template: Template) => {
    setEditingTemplate(template);
    setDialogOpen(true);
  };

  const handlePreview = (template: Template) => {
    setPreviewingTemplate(template);
    setPreviewOpen(true);
  };

  const handleSave = async (data: {
    id?: string;
    name: string;
    subjectTpl: string;
    htmlTpl: string;
  }) => {
    setSaving(true);
    try {
      if (data.id) {
        await updateTemplate(data as Parameters<typeof updateTemplate>[0]);
        toast.success("Plantilla actualizada");
      } else {
        await createTemplate(data);
        toast.success("Plantilla creada");
      }
      setDialogOpen(false);
      setEditingTemplate(null);
      await loadTemplates();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al guardar");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteClick = (template: Template) => {
    setDeletingTemplate(template);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!deletingTemplate) return;
    setDeleting(true);
    try {
      await deleteTemplate(deletingTemplate.id);
      toast.success("Plantilla eliminada");
      setDeleteDialogOpen(false);
      setDeletingTemplate(null);
      loadTemplates();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al eliminar");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Plantillas"
        description="Diseñá plantillas reutilizables con variables para personalizar cada envío."
        actions={[
          {
            id: "new-template",
            label: "Nueva plantilla",
            icon: <IconPlus className="h-4 w-4" stroke={2} />,
            onClick: handleCreate,
          },
        ]}
      />

      {/* Table */}
      <TemplatesTable
        templates={templates}
        loading={loading}
        onEdit={handleEdit}
        onDelete={handleDeleteClick}
        onPreview={handlePreview}
      />

      {/* Create/Edit Dialog */}
      <TemplateDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        template={editingTemplate}
        onSave={handleSave}
        saving={saving}
      />

      {/* Preview Dialog */}
      <TemplatePreview
        open={previewOpen}
        onOpenChange={setPreviewOpen}
        template={previewingTemplate}
      />

      {/* Delete Confirmation */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="border-slate-800 bg-slate-950 sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-white">Eliminar plantilla</DialogTitle>
            <DialogDescription className="text-slate-400">
              ¿Estás seguro de que querés eliminar{" "}
              <span className="font-medium text-slate-200">
                {deletingTemplate?.name}
              </span>
              ? Esta acción no se puede deshacer.
            </DialogDescription>
          </DialogHeader>
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
