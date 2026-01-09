"use client";

import { useState, useEffect, useCallback } from "react";
import DOMPurify from "dompurify";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { IconRefresh, IconMail, IconCode } from "@tabler/icons-react";
import { toast } from "sonner";
import { previewTemplate } from "./api";
import type { Template, PreviewResponse } from "./types";
import type { Contact } from "@/features/contacts/types";
import { fetchContacts } from "@/features/contacts/api";

type TemplatePreviewProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  template: Template | null;
};

export function TemplatePreview({
  open,
  onOpenChange,
  template,
}: TemplatePreviewProps) {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [selectedContactId, setSelectedContactId] = useState<string>("");
  const [preview, setPreview] = useState<PreviewResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [showHtml, setShowHtml] = useState(false);

  // Cargar contactos para el selector
  useEffect(() => {
    if (open) {
      fetchContacts({ limit: 50 })
        .then((data) => setContacts(data.contacts))
        .catch(() => toast.error("Error al cargar contactos"));
    }
  }, [open]);

  // Cargar preview inicial
  const loadPreview = useCallback(async () => {
    if (!template) return;

    setLoading(true);
    try {
      const result = await previewTemplate({
        subjectTpl: template.subjectTpl,
        htmlTpl: template.htmlTpl,
        contactId: selectedContactId || undefined,
      });
      setPreview(result);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al previsualizar");
    } finally {
      setLoading(false);
    }
  }, [template, selectedContactId]);

  useEffect(() => {
    if (open && template) {
      loadPreview();
    }
  }, [open, template, loadPreview]);

  // Resetear estado al cerrar
  useEffect(() => {
    if (!open) {
      setPreview(null);
      setSelectedContactId("");
      setShowHtml(false);
    }
  }, [open]);

  const sanitizedHtml = preview?.html ? DOMPurify.sanitize(preview.html) : "";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="border-slate-800 bg-slate-950 sm:max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="text-white flex items-center gap-2">
            <IconMail className="h-5 w-5 text-blue-400" />
            Preview: {template?.name}
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-hidden flex flex-col gap-4">
          {/* Controles */}
          <div className="flex items-center gap-4 flex-wrap">
            <div className="flex-1 min-w-[200px]">
              <Label className="text-slate-400 text-xs mb-1 block">
                Probar con contacto
              </Label>
              <select
                value={selectedContactId}
                onChange={(e) => setSelectedContactId(e.target.value)}
                className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-200 focus:border-blue-500 focus:outline-none"
              >
                <option value="">Sin contacto (valores vacíos)</option>
                {contacts.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.email} {c.firstName ? `(${c.firstName})` : ""}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={loadPreview}
                disabled={loading}
                className="border-slate-700 bg-slate-900 text-slate-300 hover:bg-slate-800"
              >
                <IconRefresh className={`h-4 w-4 mr-1 ${loading ? "animate-spin" : ""}`} />
                Actualizar
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowHtml(!showHtml)}
                className="border-slate-700 bg-slate-900 text-slate-300 hover:bg-slate-800"
              >
                <IconCode className="h-4 w-4 mr-1" />
                {showHtml ? "Ver render" : "Ver HTML"}
              </Button>
            </div>
          </div>

          {/* Asunto */}
          {preview && (
            <div className="rounded-lg border border-slate-700 bg-slate-900/50 p-3">
              <div className="text-xs text-slate-500 mb-1">Asunto:</div>
              <div className="text-slate-200 font-medium">{preview.subject}</div>
            </div>
          )}

          {/* Preview del cuerpo */}
          <div className="flex-1 overflow-auto rounded-lg border border-slate-700">
            {loading ? (
              <div className="flex items-center justify-center h-64">
                <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-600 border-t-blue-500" />
              </div>
            ) : showHtml ? (
              <pre className="p-4 text-xs text-slate-300 font-mono whitespace-pre-wrap overflow-auto">
                {preview?.html ?? ""}
              </pre>
            ) : (
              <div
                className="p-4 bg-white min-h-[300px]"
                dangerouslySetInnerHTML={{ __html: sanitizedHtml }}
              />
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
