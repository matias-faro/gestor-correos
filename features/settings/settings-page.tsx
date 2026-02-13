"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import DOMPurify from "dompurify";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  IconSettings,
  IconClock,
  IconMail,
  IconShield,
  IconPencil,
  IconLoader2,
  IconPhoto,
  IconPlug,
  IconCircleCheck,
  IconAlertTriangle,
  IconTrash,
  IconPlugConnected,
} from "@tabler/icons-react";
import type { ContactSource, Settings, SpreadsheetInfo } from "./types";
import {
  createContactSource,
  fetchContactSources,
  fetchSpreadsheets,
  syncContactSource,
  updateSettings,
  uploadSignatureAsset,
} from "./api";
import {
  fetchEmailAccounts,
  deleteEmailAccount,
  verifyEmailAccount,
  type EmailAccountResponse,
} from "./email-accounts-api";
import { EmailAccountDialog } from "./email-account-dialog";

type SettingsPageProps = {
  initialSettings: Settings;
};

export function SettingsPage({ initialSettings }: SettingsPageProps) {
  const [settings, setSettings] = useState(initialSettings);
  const [saving, setSaving] = useState(false);
  const [sourceSaving, setSourceSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);

  // Dialog states
  const [limitsDialogOpen, setLimitsDialogOpen] = useState(false);
  const [signatureDialogOpen, setSignatureDialogOpen] = useState(false);
  const [allowlistDialogOpen, setAllowlistDialogOpen] = useState(false);
  const [sourceDialogOpen, setSourceDialogOpen] = useState(false);

  // Form states
  const [dailyQuota, setDailyQuota] = useState(settings.dailyQuota.toString());
  const [minDelay, setMinDelay] = useState(settings.minDelaySeconds.toString());
  const [signature, setSignature] = useState(settings.signatureDefaultHtml ?? "");
  const [allowlistEmails, setAllowlistEmails] = useState(
    settings.allowlistEmails.join("\n")
  );
  const [allowlistDomains, setAllowlistDomains] = useState(
    settings.allowlistDomains.join("\n")
  );

  // Signature image upload
  const [uploadingImage, setUploadingImage] = useState(false);
  const signatureTextareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Email accounts
  const [emailAccounts, setEmailAccounts] = useState<EmailAccountResponse[]>([]);
  const [emailAccountsLoading, setEmailAccountsLoading] = useState(false);
  const [emailAccountDialogOpen, setEmailAccountDialogOpen] = useState(false);
  const [verifyingAccountId, setVerifyingAccountId] = useState<string | null>(null);
  const [deletingAccountId, setDeletingAccountId] = useState<string | null>(null);

  // Contact sources
  const [sources, setSources] = useState<ContactSource[]>([]);
  const [sourcesLoading, setSourcesLoading] = useState(false);
  const [spreadsheetQuery, setSpreadsheetQuery] = useState("");
  const [spreadsheets, setSpreadsheets] = useState<SpreadsheetInfo[]>([]);
  const [spreadsheetsLoading, setSpreadsheetsLoading] = useState(false);
  const [selectedSpreadsheet, setSelectedSpreadsheet] =
    useState<SpreadsheetInfo | null>(null);
  const [sourceName, setSourceName] = useState("");

  useEffect(() => {
    const loadData = async () => {
      setSourcesLoading(true);
      setEmailAccountsLoading(true);
      try {
        const [sourcesData, emailAccountsData] = await Promise.all([
          fetchContactSources(),
          fetchEmailAccounts(),
        ]);
        setSources(sourcesData);
        setEmailAccounts(emailAccountsData);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Error al cargar datos");
      } finally {
        setSourcesLoading(false);
        setEmailAccountsLoading(false);
      }
    };
    loadData();
  }, []);

  const activeSource = sources.find(
    (source) => source.id === settings.activeContactSourceId
  );
  const formatSyncTimestamp = (value: string | null) =>
    value ? new Date(value).toLocaleString() : "Nunca";
  const syncStatusLabel = (() => {
    if (!activeSource?.lastSyncStatus) return "Sin estado";
    if (activeSource.lastSyncStatus === "running") return "Sincronizando";
    if (activeSource.lastSyncStatus === "completed") return "Completado";
    if (activeSource.lastSyncStatus === "failed") return "Fallido";
    return activeSource.lastSyncStatus;
  })();
  const activeSourceId = activeSource?.id;
  const activeSourceStatus = activeSource?.lastSyncStatus;

  useEffect(() => {
    if (!activeSourceId || activeSourceStatus !== "running") return;
    let alive = true;
    const interval = setInterval(async () => {
      try {
        const data = await fetchContactSources();
        if (alive) setSources(data);
      } catch {
        // Silencioso: el estado se puede volver a cargar manualmente.
      }
    }, 5000);
    return () => {
      alive = false;
      clearInterval(interval);
    };
  }, [activeSourceId, activeSourceStatus]);

  // Format send windows for display
  const formatWindows = () => {
    const weekdayWindow = settings.sendWindows.monday[0];
    const weekendWindow = settings.sendWindows.saturday[0];

    return {
      weekdays: weekdayWindow
        ? `${weekdayWindow.start} - ${weekdayWindow.end}`
        : "No configurado",
      weekend: weekendWindow
        ? `${weekendWindow.start} - ${weekendWindow.end}`
        : "No configurado",
    };
  };

  const windows = formatWindows();

  // Save limits
  const handleSaveLimits = async () => {
    setSaving(true);
    try {
      const updated = await updateSettings({
        dailyQuota: parseInt(dailyQuota, 10),
        minDelaySeconds: parseInt(minDelay, 10),
      });
      setSettings(updated);
      setLimitsDialogOpen(false);
      toast.success("Límites actualizados");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al guardar");
    } finally {
      setSaving(false);
    }
  };

  // Save signature
  const handleSaveSignature = async () => {
    setSaving(true);
    try {
      const updated = await updateSettings({
        signatureDefaultHtml: signature || null,
      });
      setSettings(updated);
      setSignatureDialogOpen(false);
      toast.success("Firma actualizada");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al guardar");
    } finally {
      setSaving(false);
    }
  };

  // Upload signature image and insert <img> tag
  const handleImageUpload = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploadingImage(true);
    try {
      const { publicUrl } = await uploadSignatureAsset(file);

      // Build img tag
      const imgTag = `<img src="${publicUrl}" alt="Logo" width="140" style="display:block;" />`;

      // Insert at cursor position or append
      const textarea = signatureTextareaRef.current;
      if (textarea) {
        const start = textarea.selectionStart ?? signature.length;
        const end = textarea.selectionEnd ?? signature.length;
        const newValue = `${signature.slice(0, start)}${imgTag}${signature.slice(end)}`;
        setSignature(newValue);

        // Restore focus and cursor after state update
        window.requestAnimationFrame(() => {
          textarea.focus();
          const newPos = start + imgTag.length;
          textarea.setSelectionRange(newPos, newPos);
        });
      } else {
        // Fallback: append at the end
        setSignature((prev) => prev + imgTag);
      }

      toast.success("Imagen subida e insertada");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al subir imagen");
    } finally {
      setUploadingImage(false);
      // Reset input so the same file can be selected again
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  // Save allowlist
  const handleSaveAllowlist = async () => {
    setSaving(true);
    try {
      const emails = allowlistEmails
        .split("\n")
        .map((e) => e.trim())
        .filter((e) => e.includes("@"));
      const domains = allowlistDomains
        .split("\n")
        .map((d) => d.trim())
        .filter((d) => d.length > 0);

      const updated = await updateSettings({
        allowlistEmails: emails,
        allowlistDomains: domains,
      });
      setSettings(updated);
      setAllowlistDialogOpen(false);
      toast.success("Control de acceso actualizado");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al guardar");
    } finally {
      setSaving(false);
    }
  };

  const handleActiveSourceChange = async (value: string) => {
    setSourceSaving(true);
    try {
      const updated = await updateSettings({
        activeContactSourceId: value || null,
      });
      setSettings(updated);
      toast.success("Fuente activa actualizada");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al guardar");
    } finally {
      setSourceSaving(false);
    }
  };

  const handleSearchSpreadsheets = async () => {
    setSpreadsheetsLoading(true);
    try {
      const results = await fetchSpreadsheets(spreadsheetQuery.trim() || undefined);
      setSpreadsheets(results);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al buscar sheets");
    } finally {
      setSpreadsheetsLoading(false);
    }
  };

  const handleCreateSource = async () => {
    if (!selectedSpreadsheet) {
      toast.error("Seleccioná un spreadsheet");
      return;
    }
    setSourceSaving(true);
    try {
      const created = await createContactSource({
        name: sourceName.trim() || selectedSpreadsheet.name,
        spreadsheetId: selectedSpreadsheet.id,
      });
      const updatedSources = await fetchContactSources();
      setSources(updatedSources);
      setSourceDialogOpen(false);
      setSelectedSpreadsheet(null);
      setSourceName("");
      setSpreadsheetQuery("");
      setSpreadsheets([]);
      toast.success(`Fuente creada: ${created.name}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al crear fuente");
    } finally {
      setSourceSaving(false);
    }
  };

  // Email account handlers
  const handleVerifyAccount = async (id: string) => {
    setVerifyingAccountId(id);
    try {
      const result = await verifyEmailAccount(id);
      if (result.verified) {
        toast.success("✅ Conexión verificada correctamente");
        // Actualizar estado local
        setEmailAccounts((prev) =>
          prev.map((a) =>
            a.id === id
              ? { ...a, verified: true, lastVerifiedAt: new Date().toISOString() }
              : a
          )
        );
      } else {
        const errors: string[] = [];
        if (!result.smtp.success) errors.push(`SMTP: ${result.smtp.error}`);
        if (!result.imap.success) errors.push(`IMAP: ${result.imap.error}`);
        toast.error(`Verificación falló:\n${errors.join("\n")}`, { duration: 8000 });
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al verificar");
    } finally {
      setVerifyingAccountId(null);
    }
  };

  const handleDeleteAccount = async (id: string) => {
    setDeletingAccountId(id);
    try {
      await deleteEmailAccount(id);
      setEmailAccounts((prev) => prev.filter((a) => a.id !== id));
      toast.success("Cuenta eliminada");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al eliminar");
    } finally {
      setDeletingAccountId(null);
    }
  };

  const handleSyncActiveSource = async () => {
    if (!settings.activeContactSourceId) {
      toast.error("Seleccioná una fuente activa");
      return;
    }
    setSyncing(true);
    try {
      await syncContactSource(settings.activeContactSourceId);
      const updatedSources = await fetchContactSources();
      setSources(updatedSources);
      toast.success("Sincronización iniciada");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al sincronizar");
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-white">Configuración</h1>
        <p className="mt-2 text-slate-400">
          Ajustes del sistema y preferencias de envío
        </p>
      </div>

      {/* Cuentas de Email */}
      <Card className="border-slate-800 bg-slate-900/50">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-indigo-500/10 p-2">
                <IconPlug className="h-5 w-5 text-indigo-400" stroke={1.5} />
              </div>
              <div>
                <CardTitle className="text-white">Cuentas de email</CardTitle>
                <CardDescription className="text-slate-400">
                  Cuentas configuradas para enviar correos (Gmail, Hostinger, etc.)
                </CardDescription>
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setEmailAccountDialogOpen(true)}
              className="text-slate-300 hover:text-white"
            >
              Agregar cuenta
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {emailAccountsLoading ? (
            <div className="flex items-center gap-2 text-sm text-slate-500">
              <IconLoader2 className="h-4 w-4 animate-spin" />
              Cargando cuentas...
            </div>
          ) : emailAccounts.length === 0 ? (
            <p className="text-sm text-slate-500">
              No hay cuentas de email configuradas. Agregá una cuenta para poder
              enviar campañas.
            </p>
          ) : (
            <div className="space-y-3">
              {emailAccounts.map((account) => (
                <div
                  key={account.id}
                  className="flex items-center justify-between rounded-md border border-slate-800 bg-slate-950/60 p-3"
                >
                  <div className="flex items-center gap-3">
                    {account.verified ? (
                      <IconCircleCheck className="h-5 w-5 text-emerald-400" stroke={2} />
                    ) : (
                      <IconAlertTriangle className="h-5 w-5 text-amber-400" stroke={2} />
                    )}
                    <div>
                      <div className="text-sm font-medium text-slate-200">
                        {account.label}
                      </div>
                      <div className="text-xs text-slate-500">
                        {account.email} • {account.provider === "google" ? "Gmail API" : "IMAP/SMTP"}
                        {!account.verified && " • Sin verificar"}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    {account.provider === "imap_smtp" && (
                      <>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleVerifyAccount(account.id)}
                          disabled={verifyingAccountId === account.id}
                          className="h-8 w-8 text-slate-400 hover:text-white"
                          title="Verificar conexión"
                        >
                          {verifyingAccountId === account.id ? (
                            <IconLoader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <IconPlugConnected className="h-4 w-4" />
                          )}
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDeleteAccount(account.id)}
                          disabled={deletingAccountId === account.id}
                          className="h-8 w-8 text-slate-400 hover:text-red-400"
                          title="Eliminar cuenta"
                        >
                          {deletingAccountId === account.id ? (
                            <IconLoader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <IconTrash className="h-4 w-4" />
                          )}
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Ventanas de envío (solo lectura por ahora) */}
        <Card className="border-slate-800 bg-slate-900/50">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-blue-500/10 p-2">
                  <IconClock className="h-5 w-5 text-blue-400" stroke={1.5} />
                </div>
                <div>
                  <CardTitle className="text-white">Ventanas de envío</CardTitle>
                  <CardDescription className="text-slate-400">
                    Horarios permitidos para enviar emails
                  </CardDescription>
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between text-slate-300">
                <span>Lunes - Viernes</span>
                <span className="text-slate-400">{windows.weekdays}</span>
              </div>
              <div className="flex justify-between text-slate-300">
                <span>Sábado - Domingo</span>
                <span className="text-slate-400">{windows.weekend}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Límites de envío */}
        <Card className="border-slate-800 bg-slate-900/50">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-emerald-500/10 p-2">
                  <IconMail className="h-5 w-5 text-emerald-400" stroke={1.5} />
                </div>
                <div>
                  <CardTitle className="text-white">Límites de envío</CardTitle>
                  <CardDescription className="text-slate-400">
                    Configuración de cuota y delays
                  </CardDescription>
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => {
                  setDailyQuota(settings.dailyQuota.toString());
                  setMinDelay(settings.minDelaySeconds.toString());
                  setLimitsDialogOpen(true);
                }}
                className="text-slate-400 hover:text-white"
              >
                <IconPencil className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between text-slate-300">
                <span>Cuota diaria</span>
                <span className="text-slate-400">{settings.dailyQuota} emails</span>
              </div>
              <div className="flex justify-between text-slate-300">
                <span>Delay mínimo</span>
                <span className="text-slate-400">{settings.minDelaySeconds} segundos</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Firma por defecto */}
        <Card className="border-slate-800 bg-slate-900/50">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-violet-500/10 p-2">
                  <IconSettings className="h-5 w-5 text-violet-400" stroke={1.5} />
                </div>
                <div>
                  <CardTitle className="text-white">Firma por defecto</CardTitle>
                  <CardDescription className="text-slate-400">
                    Firma HTML para todos los emails
                  </CardDescription>
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => {
                  setSignature(settings.signatureDefaultHtml ?? "");
                  setSignatureDialogOpen(true);
                }}
                className="text-slate-400 hover:text-white"
              >
                <IconPencil className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {settings.signatureDefaultHtml ? (
              <div
                className="prose prose-sm prose-invert max-w-none text-slate-300"
                dangerouslySetInnerHTML={{
                  __html: DOMPurify.sanitize(settings.signatureDefaultHtml),
                }}
              />
            ) : (
              <p className="text-sm text-slate-500">No hay firma configurada</p>
            )}
          </CardContent>
        </Card>

        {/* Control de acceso */}
        <Card className="border-slate-800 bg-slate-900/50">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-amber-500/10 p-2">
                  <IconShield className="h-5 w-5 text-amber-400" stroke={1.5} />
                </div>
                <div>
                  <CardTitle className="text-white">Control de acceso</CardTitle>
                  <CardDescription className="text-slate-400">
                    Allowlist de emails y dominios
                  </CardDescription>
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => {
                  setAllowlistEmails(settings.allowlistEmails.join("\n"));
                  setAllowlistDomains(settings.allowlistDomains.join("\n"));
                  setAllowlistDialogOpen(true);
                }}
                className="text-slate-400 hover:text-white"
              >
                <IconPencil className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {settings.allowlistEmails.length > 0 ||
            settings.allowlistDomains.length > 0 ? (
              <div className="space-y-2 text-sm">
                {settings.allowlistEmails.length > 0 && (
                  <div>
                    <span className="text-slate-500">Emails: </span>
                    <span className="text-slate-300">
                      {settings.allowlistEmails.join(", ")}
                    </span>
                  </div>
                )}
                {settings.allowlistDomains.length > 0 && (
                  <div>
                    <span className="text-slate-500">Dominios: </span>
                    <span className="text-slate-300">
                      {settings.allowlistDomains.join(", ")}
                    </span>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-sm text-slate-500">Sin restricciones configuradas</p>
            )}
          </CardContent>
        </Card>

        {/* Base de datos (Google Sheets) */}
        <Card className="border-slate-800 bg-slate-900/50">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-cyan-500/10 p-2">
                  <IconSettings className="h-5 w-5 text-cyan-400" stroke={1.5} />
                </div>
                <div>
                  <CardTitle className="text-white">
                    Base de datos (Google Sheets)
                  </CardTitle>
                  <CardDescription className="text-slate-400">
                    Elegí la fuente activa y sincronizá contactos
                  </CardDescription>
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setSourceDialogOpen(true);
                  setSelectedSpreadsheet(null);
                  setSourceName("");
                  setSpreadsheetQuery("");
                  setSpreadsheets([]);
                }}
                className="text-slate-300 hover:text-white"
              >
                Agregar BD
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label className="text-slate-300">Fuente activa</Label>
              <select
                className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-200"
                value={settings.activeContactSourceId ?? ""}
                onChange={(e) => handleActiveSourceChange(e.target.value)}
                disabled={sourceSaving || sourcesLoading}
              >
                <option value="">Sin fuente activa</option>
                {sources.map((source) => (
                  <option key={source.id} value={source.id}>
                    {source.sheetTab && source.sheetTab !== "Base de datos"
                      ? `${source.name} - ${source.sheetTab}`
                      : source.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="rounded-md border border-slate-800 bg-slate-950/60 p-3 text-sm">
              {activeSource ? (
                <div className="space-y-2 text-slate-300">
                  <div>
                    <span className="text-slate-500">Sheet:</span>{" "}
                    {activeSource.name}
                  </div>
                  <div>
                    <span className="text-slate-500">Pestaña:</span>{" "}
                    {activeSource.sheetTab}
                  </div>
                  <div>
                    <span className="text-slate-500">Último sync:</span>{" "}
                    {formatSyncTimestamp(activeSource.lastSyncedAt)}
                  </div>
                  <div>
                    <span className="text-slate-500">Inicio:</span>{" "}
                    {formatSyncTimestamp(activeSource.lastSyncStartedAt)}
                  </div>
                  <div>
                    <span className="text-slate-500">Estado:</span>{" "}
                    {syncStatusLabel}
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2">
                    <div>
                      <span className="text-slate-500">Procesados:</span>{" "}
                      {activeSource.lastSyncProcessed ?? 0}
                    </div>
                    <div>
                      <span className="text-slate-500">Saltados:</span>{" "}
                      {activeSource.lastSyncSkipped ?? 0}
                    </div>
                    <div>
                      <span className="text-slate-500">Desasociados:</span>{" "}
                      {activeSource.lastSyncRemovedMemberships ?? 0}
                    </div>
                    <div>
                      <span className="text-slate-500">Eliminados:</span>{" "}
                      {activeSource.lastSyncDeletedContacts ?? 0}
                    </div>
                  </div>
                  <div>
                    <span className="text-slate-500">Última fila:</span>{" "}
                    {activeSource.lastSyncLastRow ?? "Sin datos"}
                  </div>
                  {activeSource.lastSyncError ? (
                    <div className="text-red-400">
                      {activeSource.lastSyncError}
                    </div>
                  ) : null}
                </div>
              ) : (
                <div className="text-slate-500">
                  Seleccioná una fuente activa para ver su estado.
                </div>
              )}
            </div>

            <Button
              type="button"
              onClick={handleSyncActiveSource}
              disabled={syncing || !settings.activeContactSourceId}
              className="bg-cyan-600 hover:bg-cyan-700"
            >
              {syncing ? (
                <IconLoader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              Sincronizar ahora
            </Button>
            <p className="text-xs text-slate-500">
              Sincronizar ahora hace un hard reset: borra los contactos de esta
              fuente y los reimporta desde la hoja.
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Dialog: Límites de envío */}
      <Dialog open={limitsDialogOpen} onOpenChange={setLimitsDialogOpen}>
        <DialogContent className="border-slate-800 bg-slate-950 sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-white">Límites de envío</DialogTitle>
            <DialogDescription className="text-slate-400">
              Configurá la cuota diaria y el delay mínimo entre emails.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid gap-2">
              <Label htmlFor="dailyQuota" className="text-slate-300">
                Cuota diaria (emails)
              </Label>
              <Input
                id="dailyQuota"
                type="number"
                min="1"
                value={dailyQuota}
                onChange={(e) => setDailyQuota(e.target.value)}
                className="border-slate-700 bg-slate-900 text-slate-200"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="minDelay" className="text-slate-300">
                Delay mínimo (segundos)
              </Label>
              <Input
                id="minDelay"
                type="number"
                min="0"
                value={minDelay}
                onChange={(e) => setMinDelay(e.target.value)}
                className="border-slate-700 bg-slate-900 text-slate-200"
              />
              <p className="text-xs text-slate-500">
                Tiempo mínimo entre cada email enviado.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => setLimitsDialogOpen(false)}
              className="text-slate-400 hover:text-white"
            >
              Cancelar
            </Button>
            <Button
              type="button"
              onClick={handleSaveLimits}
              disabled={saving}
              className="bg-emerald-600 hover:bg-emerald-700"
            >
              {saving ? (
                <IconLoader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: Firma */}
      <Dialog open={signatureDialogOpen} onOpenChange={setSignatureDialogOpen}>
        <DialogContent className="border-slate-800 bg-slate-950 sm:max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="text-white">Firma por defecto</DialogTitle>
            <DialogDescription className="text-slate-400">
              HTML que se agregará al final de cada email.
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-auto space-y-4">
            {/* Image upload section */}
            <div className="rounded-lg border border-slate-700 bg-slate-900/50 p-3">
              <div className="flex items-center justify-between">
                <div className="text-sm text-slate-300">
                  <span className="font-medium">Insertar imagen</span>
                  <p className="text-xs text-slate-500 mt-0.5">
                    PNG, JPG o WebP (máx. 2 MB)
                  </p>
                </div>
                <div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    onChange={handleImageUpload}
                    className="hidden"
                    id="signature-image-upload"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploadingImage}
                    className="border-slate-600 bg-slate-800 text-slate-300 hover:bg-slate-700"
                  >
                    {uploadingImage ? (
                      <IconLoader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <IconPhoto className="mr-2 h-4 w-4" />
                    )}
                    {uploadingImage ? "Subiendo..." : "Subir imagen"}
                  </Button>
                </div>
              </div>
            </div>

            {/* HTML editor */}
            <div className="grid gap-2">
              <Label htmlFor="signature" className="text-slate-300">
                Firma HTML
              </Label>
              <Textarea
                ref={signatureTextareaRef}
                id="signature"
                value={signature}
                onChange={(e) => setSignature(e.target.value)}
                rows={6}
                placeholder="<p>Saludos,<br/>Tu nombre</p>"
                className="border-slate-700 bg-slate-900 font-mono text-sm text-slate-200"
              />
            </div>

            {/* Live preview */}
            {signature.trim() && (
              <div className="grid gap-2">
                <Label className="text-slate-300">Vista previa</Label>
                <div
                  className="rounded-md border border-slate-700 bg-white p-3 min-h-[60px]"
                  dangerouslySetInnerHTML={{
                    __html: DOMPurify.sanitize(signature),
                  }}
                />
              </div>
            )}
          </div>

          <DialogFooter className="pt-4">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setSignatureDialogOpen(false)}
              className="text-slate-400 hover:text-white"
            >
              Cancelar
            </Button>
            <Button
              type="button"
              onClick={handleSaveSignature}
              disabled={saving}
              className="bg-violet-600 hover:bg-violet-700"
            >
              {saving ? (
                <IconLoader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: Allowlist */}
      <Dialog open={allowlistDialogOpen} onOpenChange={setAllowlistDialogOpen}>
        <DialogContent className="border-slate-800 bg-slate-950 sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-white">Control de acceso</DialogTitle>
            <DialogDescription className="text-slate-400">
              Solo usuarios con estos emails o dominios podrán acceder.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid gap-2">
              <Label htmlFor="emails" className="text-slate-300">
                Emails permitidos (uno por línea)
              </Label>
              <Textarea
                id="emails"
                value={allowlistEmails}
                onChange={(e) => setAllowlistEmails(e.target.value)}
                rows={3}
                placeholder="usuario@ejemplo.com"
                className="border-slate-700 bg-slate-900 font-mono text-sm text-slate-200"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="domains" className="text-slate-300">
                Dominios permitidos (uno por línea)
              </Label>
              <Textarea
                id="domains"
                value={allowlistDomains}
                onChange={(e) => setAllowlistDomains(e.target.value)}
                rows={3}
                placeholder="ejemplo.com"
                className="border-slate-700 bg-slate-900 font-mono text-sm text-slate-200"
              />
              <p className="text-xs text-slate-500">
                Dejá vacío para permitir cualquier usuario autenticado.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => setAllowlistDialogOpen(false)}
              className="text-slate-400 hover:text-white"
            >
              Cancelar
            </Button>
            <Button
              type="button"
              onClick={handleSaveAllowlist}
              disabled={saving}
              className="bg-amber-600 hover:bg-amber-700"
            >
              {saving ? (
                <IconLoader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: Agregar fuente */}
      <Dialog open={sourceDialogOpen} onOpenChange={setSourceDialogOpen}>
        <DialogContent className="border-slate-800 bg-slate-950 sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-white">Agregar fuente</DialogTitle>
            <DialogDescription className="text-slate-400">
              Buscá un spreadsheet y asignale un nombre interno.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid gap-2">
              <Label className="text-slate-300">Buscar spreadsheet</Label>
              <div className="flex gap-2">
                <Input
                  value={spreadsheetQuery}
                  onChange={(e) => setSpreadsheetQuery(e.target.value)}
                  placeholder="Nombre del spreadsheet"
                  className="border-slate-700 bg-slate-900 text-slate-200"
                />
                <Button
                  type="button"
                  onClick={handleSearchSpreadsheets}
                  disabled={spreadsheetsLoading}
                  className="bg-slate-800 hover:bg-slate-700"
                >
                  {spreadsheetsLoading ? (
                    <IconLoader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    "Buscar"
                  )}
                </Button>
              </div>
            </div>

            <div className="max-h-48 overflow-auto rounded-md border border-slate-800">
              {spreadsheets.length === 0 ? (
                <div className="p-3 text-sm text-slate-500">
                  No hay resultados.
                </div>
              ) : (
                spreadsheets.map((sheet) => (
                  <button
                    key={sheet.id}
                    type="button"
                    onClick={() => {
                      setSelectedSpreadsheet(sheet);
                      setSourceName(sheet.name);
                    }}
                    className={`w-full px-3 py-2 text-left text-sm transition ${
                      selectedSpreadsheet?.id === sheet.id
                        ? "bg-slate-800 text-white"
                        : "text-slate-300 hover:bg-slate-900"
                    }`}
                  >
                    {sheet.name}
                  </button>
                ))
              )}
            </div>

            <div className="grid gap-2">
              <Label className="text-slate-300">Nombre interno</Label>
              <Input
                value={sourceName}
                onChange={(e) => setSourceName(e.target.value)}
                placeholder="Nombre para identificar la BD"
                className="border-slate-700 bg-slate-900 text-slate-200"
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => setSourceDialogOpen(false)}
              className="text-slate-400 hover:text-white"
            >
              Cancelar
            </Button>
            <Button
              type="button"
              onClick={handleCreateSource}
              disabled={sourceSaving}
              className="bg-cyan-600 hover:bg-cyan-700"
            >
              {sourceSaving ? (
                <IconLoader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              Crear fuente
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: Agregar cuenta de email */}
      <EmailAccountDialog
        open={emailAccountDialogOpen}
        onOpenChange={setEmailAccountDialogOpen}
        onCreated={async () => {
          // Recargar lista completa para tener todos los campos actualizados
          try {
            const updated = await fetchEmailAccounts();
            setEmailAccounts(updated);
          } catch {
            // Silencioso: ya se mostró toast de éxito en el dialog
          }
        }}
      />
    </div>
  );
}
