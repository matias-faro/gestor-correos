"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import DOMPurify from "dompurify";
import {
  IconLoader2,
  IconChevronLeft,
  IconChevronRight,
  IconCheck,
  IconUsers,
  IconTemplate,
  IconRocket,
  IconMail,
  IconClock,
  IconCalendarEvent,
  IconInfoCircle,
  IconEye,
  IconAlertTriangle,
} from "@tabler/icons-react";
import { TagMultiselect } from "@/features/contacts/tag-multiselect";
import { fetchContacts } from "@/features/contacts/api";
import { previewTemplate } from "@/features/templates/api";
import { getSettings } from "@/features/settings/api";
import type { CampaignFilters } from "./types";
import type { Contact } from "@/features/contacts/types";
import type { Settings } from "@/features/settings/types";

type Template = {
  id: string;
  name: string;
  subjectTpl: string;
  htmlTpl: string;
};

type CampaignWizardProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  templates: Template[];
  onSave: (data: {
    name: string;
    templateId: string;
    filters: CampaignFilters;
    fromAlias?: string;
    signatureHtmlOverride?: string;
  }) => Promise<void>;
  saving: boolean;
};

type WizardStep = "template" | "audience" | "confirm";

const STEPS: { id: WizardStep; label: string; icon: typeof IconTemplate }[] = [
  { id: "template", label: "Plantilla", icon: IconTemplate },
  { id: "audience", label: "Audiencia", icon: IconUsers },
  { id: "confirm", label: "Confirmar", icon: IconRocket },
];

export function CampaignWizard({
  open,
  onOpenChange,
  templates,
  onSave,
  saving,
}: CampaignWizardProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <CampaignWizardContent
        key={open ? "open" : "closed"}
        templates={templates}
        onSave={onSave}
        saving={saving}
        onClose={() => onOpenChange(false)}
      />
    </Dialog>
  );
}

function CampaignWizardContent(props: {
  templates: Template[];
  onSave: CampaignWizardProps["onSave"];
  saving: boolean;
  onClose: () => void;
}) {
  const { templates, onSave, saving, onClose } = props;

  // Form state
  const [name, setName] = useState("");
  const [templateId, setTemplateId] = useState(templates[0]?.id ?? "");
  const [fromAlias, setFromAlias] = useState("");
  const [signatureHtmlOverride, setSignatureHtmlOverride] = useState("");
  const [filters, setFilters] = useState<CampaignFilters>({
    query: "",
    company: "",
    position: "",
    tagIds: [],
  });

  // UI state
  const [currentStep, setCurrentStep] = useState<WizardStep>("template");
  const [previewHtml, setPreviewHtml] = useState<string>("");
  const [previewSubject, setPreviewSubject] = useState<string>("");
  const [previewLoading, setPreviewLoading] = useState(false);

  // Audience state
  const [matchingContacts, setMatchingContacts] = useState<Contact[]>([]);
  const [matchingTotal, setMatchingTotal] = useState(0);
  const [audienceLoading, setAudienceLoading] = useState(false);

  // Settings for time estimation
  const [settings, setSettings] = useState<Settings | null>(null);

  const selectedTemplate = useMemo(
    () => templates.find((t) => t.id === templateId),
    [templates, templateId]
  );

  // Load settings on mount
  useEffect(() => {
    getSettings().then(setSettings).catch(console.error);
  }, []);

  // Load template preview when template changes
  const loadPreview = useCallback(async () => {
    if (!selectedTemplate) return;

    setPreviewLoading(true);
    try {
      const result = await previewTemplate({
        subjectTpl: selectedTemplate.subjectTpl,
        htmlTpl: selectedTemplate.htmlTpl,
      });
      setPreviewHtml(result.html);
      setPreviewSubject(result.subject);
    } catch {
      // Silently fail preview
    } finally {
      setPreviewLoading(false);
    }
  }, [selectedTemplate]);

  useEffect(() => {
    if (selectedTemplate) {
      loadPreview();
    }
  }, [selectedTemplate, loadPreview]);

  // Load matching contacts when filters change (debounced)
  useEffect(() => {
    const timer = setTimeout(async () => {
      setAudienceLoading(true);
      try {
        // Build filters for the API
        const apiFilters: {
          query?: string;
          company?: string;
          position?: string;
          tagIds?: string[];
          limit: number;
        } = { limit: 10 };

        if (filters.query?.trim()) apiFilters.query = filters.query.trim();
        if (filters.company?.trim()) apiFilters.company = filters.company.trim();
        if (filters.position?.trim()) apiFilters.position = filters.position.trim();
        if (filters.tagIds && filters.tagIds.length > 0) {
          apiFilters.tagIds = filters.tagIds;
        }

        const result = await fetchContacts(apiFilters);
        setMatchingContacts(result.contacts);
        setMatchingTotal(result.total);
      } catch {
        setMatchingContacts([]);
        setMatchingTotal(0);
      } finally {
        setAudienceLoading(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [filters]);

  // Calculate estimated time
  const estimatedTime = useMemo(() => {
    if (!settings || matchingTotal === 0) return null;

    const { dailyQuota, minDelaySeconds } = settings;

    // Total emails to send
    const totalEmails = matchingTotal;

    // Emails we can send per day
    const emailsPerDay = dailyQuota;

    // Days needed (at least 1)
    const daysNeeded = Math.ceil(totalEmails / emailsPerDay);

    // Time per email (minimum delay)
    const secondsPerEmail = minDelaySeconds;

    // Total time for emails that fit in one day
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
  }, [settings, matchingTotal]);

  const handleSubmit = async () => {
    if (!name.trim() || !templateId) return;

    const cleanFilters: CampaignFilters = {};
    if (filters.query?.trim()) cleanFilters.query = filters.query.trim();
    if (filters.company?.trim()) cleanFilters.company = filters.company.trim();
    if (filters.position?.trim()) cleanFilters.position = filters.position.trim();
    if (filters.tagIds && filters.tagIds.length > 0) {
      cleanFilters.tagIds = filters.tagIds;
    }

    await onSave({
      name: name.trim(),
      templateId,
      filters: cleanFilters,
      fromAlias: fromAlias.trim() || undefined,
      signatureHtmlOverride: signatureHtmlOverride.trim() || undefined,
    });
  };

  const canProceed = {
    template: !!templateId,
    audience: true, // Audience filters are optional
    confirm: !!name.trim() && !!templateId,
  };

  const goNext = () => {
    if (currentStep === "template") setCurrentStep("audience");
    else if (currentStep === "audience") setCurrentStep("confirm");
  };

  const goPrev = () => {
    if (currentStep === "audience") setCurrentStep("template");
    else if (currentStep === "confirm") setCurrentStep("audience");
  };

  const currentStepIndex = STEPS.findIndex((s) => s.id === currentStep);

  const sanitizedHtml = previewHtml ? DOMPurify.sanitize(previewHtml) : "";

  const hasAnyFilter =
    filters.query?.trim() ||
    filters.company?.trim() ||
    filters.position?.trim() ||
    (filters.tagIds && filters.tagIds.length > 0);

  return (
    <DialogContent className="border-slate-800 bg-slate-950 sm:max-w-4xl max-h-[90vh] overflow-hidden flex flex-col p-0">
      {/* Header with Steps */}
      <DialogHeader className="p-6 pb-0">
        <DialogTitle className="text-white text-xl">Nueva campaña</DialogTitle>
        <DialogDescription className="text-slate-400">
          Configura tu campaña paso a paso
        </DialogDescription>
      </DialogHeader>

      {/* Step Indicator */}
      <div className="px-6 pt-4">
        <div className="flex items-center justify-between">
          {STEPS.map((step, index) => {
            const isActive = step.id === currentStep;
            const isCompleted = index < currentStepIndex;
            const Icon = step.icon;

            return (
              <div key={step.id} className="flex items-center flex-1">
                <button
                  type="button"
                  onClick={() => {
                    if (index < currentStepIndex) {
                      setCurrentStep(step.id);
                    }
                  }}
                  disabled={index > currentStepIndex}
                  className={`flex items-center gap-2 rounded-lg px-4 py-2 transition-colors ${
                    isActive
                      ? "bg-blue-600/20 text-blue-400"
                      : isCompleted
                        ? "text-green-400 hover:bg-green-600/10 cursor-pointer"
                        : "text-slate-500 cursor-not-allowed"
                  }`}
                >
                  <div
                    className={`flex h-8 w-8 items-center justify-center rounded-full ${
                      isActive
                        ? "bg-blue-600"
                        : isCompleted
                          ? "bg-green-600"
                          : "bg-slate-700"
                    }`}
                  >
                    {isCompleted ? (
                      <IconCheck className="h-4 w-4 text-white" />
                    ) : (
                      <Icon className="h-4 w-4 text-white" />
                    )}
                  </div>
                  <span className="font-medium hidden sm:block">{step.label}</span>
                </button>
                {index < STEPS.length - 1 && (
                  <div
                    className={`flex-1 h-0.5 mx-2 ${
                      index < currentStepIndex ? "bg-green-600" : "bg-slate-700"
                    }`}
                  />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Step Content */}
      <div className="flex-1 overflow-hidden p-6">
        {currentStep === "template" && (
          <div className="h-full flex flex-col gap-4">
            <div className="grid gap-4 lg:grid-cols-2">
              {/* Template Selection */}
              <div className="space-y-3">
                <Label className="text-slate-300 font-medium">
                  Selecciona una plantilla
                </Label>
                <div className="space-y-2 max-h-[300px] overflow-y-auto pr-2">
                  {templates.map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setTemplateId(t.id)}
                      className={`w-full rounded-lg border p-4 text-left transition-all ${
                        templateId === t.id
                          ? "border-blue-500 bg-blue-500/10"
                          : "border-slate-700 bg-slate-900/50 hover:border-slate-600"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span
                          className={`font-medium ${
                            templateId === t.id ? "text-blue-400" : "text-slate-200"
                          }`}
                        >
                          {t.name}
                        </span>
                        {templateId === t.id && (
                          <IconCheck className="h-5 w-5 text-blue-400" />
                        )}
                      </div>
                      <p className="mt-1 text-sm text-slate-500 truncate">
                        Asunto: {t.subjectTpl}
                      </p>
                    </button>
                  ))}
                </div>
              </div>

              {/* Preview */}
              <div className="space-y-3">
                <Label className="text-slate-300 font-medium flex items-center gap-2">
                  <IconEye className="h-4 w-4" />
                  Vista previa
                </Label>
                <div className="rounded-lg border border-slate-700 overflow-hidden">
                  {previewLoading ? (
                    <div className="flex items-center justify-center h-[300px] bg-slate-900/50">
                      <IconLoader2 className="h-6 w-6 animate-spin text-slate-400" />
                    </div>
                  ) : (
                    <>
                      <div className="bg-slate-900 px-4 py-2 border-b border-slate-700">
                        <p className="text-xs text-slate-500">Asunto:</p>
                        <p className="text-sm text-slate-200 truncate">
                          {previewSubject || "Sin asunto"}
                        </p>
                      </div>
                      <div
                        className="bg-white p-4 h-[250px] overflow-auto text-sm"
                        dangerouslySetInnerHTML={{ __html: sanitizedHtml }}
                      />
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {currentStep === "audience" && (
          <div className="h-full flex flex-col gap-4">
            <div className="grid gap-4 lg:grid-cols-2">
              {/* Filters */}
              <div className="space-y-4">
                <div>
                  <Label className="text-slate-300 font-medium">
                    Filtrar audiencia
                  </Label>
                  <p className="text-sm text-slate-500 mt-1">
                    Dejá vacío para enviar a todos los contactos activos
                  </p>
                </div>

                <div className="space-y-3 rounded-lg border border-slate-800 bg-slate-900/50 p-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs text-slate-400">Empresa contiene</Label>
                    <Input
                      placeholder="Ej: Acme Corp"
                      value={filters.company ?? ""}
                      onChange={(e) => setFilters({ ...filters, company: e.target.value })}
                      className="border-slate-700 bg-slate-900 text-slate-200"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs text-slate-400">Cargo contiene</Label>
                    <Input
                      placeholder="Ej: Director"
                      value={filters.position ?? ""}
                      onChange={(e) => setFilters({ ...filters, position: e.target.value })}
                      className="border-slate-700 bg-slate-900 text-slate-200"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs text-slate-400">
                      Tags (todos deben coincidir)
                    </Label>
                    <TagMultiselect
                      selectedIds={filters.tagIds ?? []}
                      onChange={(tagIds) => setFilters({ ...filters, tagIds })}
                      allowCreate={false}
                    />
                  </div>
                </div>
              </div>

              {/* Matching Contacts Preview */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="text-slate-300 font-medium flex items-center gap-2">
                    <IconUsers className="h-4 w-4" />
                    Contactos afectados
                  </Label>
                  {audienceLoading ? (
                    <IconLoader2 className="h-4 w-4 animate-spin text-slate-400" />
                  ) : (
                    <Badge variant="secondary" className="text-sm">
                      {matchingTotal} contactos
                    </Badge>
                  )}
                </div>

                <Card className="border-slate-700 bg-slate-900/50">
                  <CardContent className="p-0">
                    {audienceLoading ? (
                      <div className="flex items-center justify-center py-8">
                        <IconLoader2 className="h-5 w-5 animate-spin text-slate-400" />
                      </div>
                    ) : matchingContacts.length === 0 ? (
                      <div className="py-8 text-center">
                        <IconUsers className="h-8 w-8 mx-auto text-slate-600 mb-2" />
                        <p className="text-slate-500">
                          {hasAnyFilter
                            ? "No hay contactos que coincidan"
                            : "Cargando contactos..."}
                        </p>
                      </div>
                    ) : (
                      <ScrollArea className="h-[280px]">
                        <div className="divide-y divide-slate-800">
                          {matchingContacts.map((contact) => (
                            <div key={contact.id} className="px-4 py-3">
                              <div className="flex items-center justify-between">
                                <div>
                                  <p className="text-sm text-slate-200">
                                    {contact.email}
                                  </p>
                                  <p className="text-xs text-slate-500">
                                    {[contact.firstName, contact.lastName]
                                      .filter(Boolean)
                                      .join(" ") || "—"}
                                    {contact.company && ` • ${contact.company}`}
                                  </p>
                                </div>
                                <IconMail className="h-4 w-4 text-slate-600" />
                              </div>
                            </div>
                          ))}
                          {matchingTotal > matchingContacts.length && (
                            <div className="px-4 py-3 text-center text-sm text-slate-500">
                              y {matchingTotal - matchingContacts.length} contactos más...
                            </div>
                          )}
                        </div>
                      </ScrollArea>
                    )}
                  </CardContent>
                </Card>

                {matchingTotal === 0 && !audienceLoading && (
                  <div className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3">
                    <IconAlertTriangle className="h-5 w-5 text-amber-400 shrink-0 mt-0.5" />
                    <p className="text-sm text-amber-200">
                      No hay contactos que coincidan con los filtros. La campaña se creará pero no tendrá destinatarios.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {currentStep === "confirm" && (
          <div className="h-full flex flex-col gap-6">
            {/* Name and Alias */}
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label className="text-slate-300">Nombre de la campaña *</Label>
                <Input
                  placeholder="Ej: Newsletter Enero 2026"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="border-slate-700 bg-slate-900 text-slate-200"
                  autoFocus
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-slate-300">Alias de remitente</Label>
                <Input
                  placeholder="Ej: Mi Empresa"
                  value={fromAlias}
                  onChange={(e) => setFromAlias(e.target.value)}
                  className="border-slate-700 bg-slate-900 text-slate-200"
                />
                <p className="text-xs text-slate-500">
                  Aparecerá como nombre del remitente
                </p>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-slate-300">
                Firma HTML (override para esta campaña)
              </Label>
              <Textarea
                rows={4}
                placeholder="<p>--<br>Firma especial para esta campaña</p>"
                value={signatureHtmlOverride}
                onChange={(e) => setSignatureHtmlOverride(e.target.value)}
                className="border-slate-700 bg-slate-900 font-mono text-sm text-slate-200"
              />
              <p className="text-xs text-slate-500">
                Si se completa, reemplaza la firma global configurada en Ajustes.
              </p>
            </div>

            {/* Summary Cards */}
            <div className="grid gap-4 sm:grid-cols-3">
              {/* Template */}
              <Card className="border-slate-700 bg-slate-900/50">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-600/20">
                      <IconTemplate className="h-5 w-5 text-blue-400" />
                    </div>
                    <div>
                      <p className="text-xs text-slate-500">Plantilla</p>
                      <p className="font-medium text-slate-200 truncate">
                        {selectedTemplate?.name}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Audience */}
              <Card className="border-slate-700 bg-slate-900/50">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-600/20">
                      <IconUsers className="h-5 w-5 text-green-400" />
                    </div>
                    <div>
                      <p className="text-xs text-slate-500">Destinatarios</p>
                      <p className="font-medium text-slate-200">
                        {matchingTotal} contactos
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Time Estimate */}
              <Card className="border-slate-700 bg-slate-900/50">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-600/20">
                      <IconClock className="h-5 w-5 text-amber-400" />
                    </div>
                    <div>
                      <p className="text-xs text-slate-500">Tiempo estimado</p>
                      <p className="font-medium text-slate-200">
                        {estimatedTime?.todayTime ?? "—"}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Detailed Time Info */}
            {estimatedTime && (
              <div className="rounded-lg border border-slate-700 bg-slate-900/50 p-4">
                <div className="flex items-start gap-3">
                  <IconInfoCircle className="h-5 w-5 text-blue-400 shrink-0 mt-0.5" />
                  <div className="space-y-2 text-sm">
                    <p className="text-slate-300">
                      <strong>Estimación de envío:</strong>
                    </p>
                    <ul className="space-y-1 text-slate-400">
                      <li>
                        • Se enviarán aproximadamente{" "}
                        <span className="text-slate-200">
                          {estimatedTime.emailsPerHour} emails por hora
                        </span>
                      </li>
                      <li>
                        • Cuota diaria:{" "}
                        <span className="text-slate-200">
                          {estimatedTime.dailyQuota} emails/día
                        </span>
                      </li>
                      {estimatedTime.daysNeeded > 1 && (
                        <li className="flex items-center gap-1">
                          <IconCalendarEvent className="h-4 w-4 text-amber-400" />
                          <span className="text-amber-300">
                            Esta campaña tardará {estimatedTime.daysNeeded} días en
                            completarse
                          </span>
                        </li>
                      )}
                    </ul>
                  </div>
                </div>
              </div>
            )}

            {/* Applied Filters Summary */}
            {hasAnyFilter && (
              <div className="rounded-lg border border-slate-700 bg-slate-900/50 p-4">
                <p className="text-sm text-slate-400 mb-2">Filtros aplicados:</p>
                <div className="flex flex-wrap gap-2">
                  {filters.company?.trim() && (
                    <Badge variant="outline" className="text-slate-300">
                      Empresa: {filters.company}
                    </Badge>
                  )}
                  {filters.position?.trim() && (
                    <Badge variant="outline" className="text-slate-300">
                      Cargo: {filters.position}
                    </Badge>
                  )}
                  {filters.tagIds && filters.tagIds.length > 0 && (
                    <Badge variant="outline" className="text-slate-300">
                      {filters.tagIds.length} tag(s) seleccionado(s)
                    </Badge>
                  )}
                </div>
              </div>
            )}

            {signatureHtmlOverride.trim() && (
              <div className="rounded-lg border border-violet-500/30 bg-violet-500/10 p-4">
                <p className="text-sm text-violet-300">
                  ✓ Esta campaña usará una firma personalizada (override).
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between border-t border-slate-800 px-6 py-4">
        <Button
          type="button"
          variant="ghost"
          onClick={currentStep === "template" ? onClose : goPrev}
          className="text-slate-400 hover:text-white"
        >
          {currentStep === "template" ? (
            "Cancelar"
          ) : (
            <>
              <IconChevronLeft className="mr-1 h-4 w-4" />
              Anterior
            </>
          )}
        </Button>

        {currentStep === "confirm" ? (
          <Button
            onClick={handleSubmit}
            disabled={!canProceed.confirm || saving}
            className="bg-blue-600 hover:bg-blue-700"
          >
            {saving ? (
              <>
                <IconLoader2 className="mr-2 h-4 w-4 animate-spin" />
                Creando...
              </>
            ) : (
              <>
                <IconRocket className="mr-2 h-4 w-4" />
                Crear campaña
              </>
            )}
          </Button>
        ) : (
          <Button
            onClick={goNext}
            disabled={!canProceed[currentStep]}
            className="bg-blue-600 hover:bg-blue-700"
          >
            Siguiente
            <IconChevronRight className="ml-1 h-4 w-4" />
          </Button>
        )}
      </div>
    </DialogContent>
  );
}
