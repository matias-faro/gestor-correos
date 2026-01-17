"use client";

import { useState } from "react";
import { toast } from "sonner";
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
} from "@tabler/icons-react";
import type { Settings } from "./types";
import { updateSettings } from "./api";

type SettingsPageProps = {
  initialSettings: Settings;
};

export function SettingsPage({ initialSettings }: SettingsPageProps) {
  const [settings, setSettings] = useState(initialSettings);
  const [saving, setSaving] = useState(false);

  // Dialog states
  const [limitsDialogOpen, setLimitsDialogOpen] = useState(false);
  const [signatureDialogOpen, setSignatureDialogOpen] = useState(false);
  const [allowlistDialogOpen, setAllowlistDialogOpen] = useState(false);

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

  // Format send windows for display
  const formatWindows = () => {
    const weekdays = ["monday", "tuesday", "wednesday", "thursday", "friday"] as const;
    const weekend = ["saturday", "sunday"] as const;

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

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-white">Configuración</h1>
        <p className="mt-2 text-slate-400">
          Ajustes del sistema y preferencias de envío
        </p>
      </div>

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
                dangerouslySetInnerHTML={{ __html: settings.signatureDefaultHtml }}
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
        <DialogContent className="border-slate-800 bg-slate-950 sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-white">Firma por defecto</DialogTitle>
            <DialogDescription className="text-slate-400">
              HTML que se agregará al final de cada email.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-2">
            <Label htmlFor="signature" className="text-slate-300">
              Firma HTML
            </Label>
            <Textarea
              id="signature"
              value={signature}
              onChange={(e) => setSignature(e.target.value)}
              rows={6}
              placeholder="<p>Saludos,<br/>Tu nombre</p>"
              className="border-slate-700 bg-slate-900 font-mono text-sm text-slate-200"
            />
          </div>
          <DialogFooter>
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
    </div>
  );
}
