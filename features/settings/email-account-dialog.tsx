"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { IconLoader2, IconPlugConnected } from "@tabler/icons-react";
import {
  createEmailAccount,
  verifyEmailAccount,
} from "./email-accounts-api";

type EmailAccountDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => void;
};

const PRESETS = {
  hostinger: {
    label: "Hostinger",
    smtpHost: "smtp.hostinger.com",
    smtpPort: 465,
    smtpSecure: true,
    imapHost: "imap.hostinger.com",
    imapPort: 993,
    imapSecure: true,
  },
  gmail: {
    label: "Gmail (SMTP)",
    smtpHost: "smtp.gmail.com",
    smtpPort: 465,
    smtpSecure: true,
    imapHost: "imap.gmail.com",
    imapPort: 993,
    imapSecure: true,
  },
  outlook: {
    label: "Outlook / Office 365",
    smtpHost: "smtp.office365.com",
    smtpPort: 587,
    smtpSecure: false,
    imapHost: "outlook.office365.com",
    imapPort: 993,
    imapSecure: true,
  },
  custom: {
    label: "Personalizado",
    smtpHost: "",
    smtpPort: 465,
    smtpSecure: true,
    imapHost: "",
    imapPort: 993,
    imapSecure: true,
  },
};

type PresetKey = keyof typeof PRESETS;

export function EmailAccountDialog({
  open,
  onOpenChange,
  onCreated,
}: EmailAccountDialogProps) {
  const [saving, setSaving] = useState(false);
  const [verifying, setVerifying] = useState(false);

  // Form fields
  const [preset, setPreset] = useState<PresetKey>("hostinger");
  const [label, setLabel] = useState("");
  const [email, setEmail] = useState("");
  const [smtpHost, setSmtpHost] = useState(PRESETS.hostinger.smtpHost);
  const [smtpPort, setSmtpPort] = useState(PRESETS.hostinger.smtpPort.toString());
  const [smtpSecure, setSmtpSecure] = useState(PRESETS.hostinger.smtpSecure);
  const [imapHost, setImapHost] = useState(PRESETS.hostinger.imapHost);
  const [imapPort, setImapPort] = useState(PRESETS.hostinger.imapPort.toString());
  const [imapSecure, setImapSecure] = useState(PRESETS.hostinger.imapSecure);
  const [user, setUser] = useState("");
  const [password, setPassword] = useState("");

  const handlePresetChange = (key: PresetKey) => {
    setPreset(key);
    const p = PRESETS[key];
    setSmtpHost(p.smtpHost);
    setSmtpPort(p.smtpPort.toString());
    setSmtpSecure(p.smtpSecure);
    setImapHost(p.imapHost);
    setImapPort(p.imapPort.toString());
    setImapSecure(p.imapSecure);
  };

  const resetForm = () => {
    setPreset("hostinger");
    setLabel("");
    setEmail("");
    setSmtpHost(PRESETS.hostinger.smtpHost);
    setSmtpPort(PRESETS.hostinger.smtpPort.toString());
    setSmtpSecure(PRESETS.hostinger.smtpSecure);
    setImapHost(PRESETS.hostinger.imapHost);
    setImapPort(PRESETS.hostinger.imapPort.toString());
    setImapSecure(PRESETS.hostinger.imapSecure);
    setUser("");
    setPassword("");
  };

  const handleSave = async () => {
    if (!email || !smtpHost || !imapHost || !user || !password) {
      toast.error("Completá todos los campos obligatorios");
      return;
    }

    setSaving(true);
    try {
      const account = await createEmailAccount({
        label: label || `${PRESETS[preset].label} - ${email}`,
        email,
        smtpHost,
        smtpPort: parseInt(smtpPort, 10),
        smtpSecure,
        imapHost,
        imapPort: parseInt(imapPort, 10),
        imapSecure,
        imapSmtpUser: user,
        imapSmtpPassword: password,
      });

      toast.success("Cuenta de email creada. Verificá la conexión.");
      onCreated();
      resetForm();
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al crear cuenta");
    } finally {
      setSaving(false);
    }
  };

  const handleVerifyAndSave = async () => {
    if (!email || !smtpHost || !imapHost || !user || !password) {
      toast.error("Completá todos los campos obligatorios");
      return;
    }

    setVerifying(true);
    try {
      // Primero crear la cuenta
      const account = await createEmailAccount({
        label: label || `${PRESETS[preset].label} - ${email}`,
        email,
        smtpHost,
        smtpPort: parseInt(smtpPort, 10),
        smtpSecure,
        imapHost,
        imapPort: parseInt(imapPort, 10),
        imapSecure,
        imapSmtpUser: user,
        imapSmtpPassword: password,
      });

      // Luego verificar
      const verifyResult = await verifyEmailAccount(account.id);

      if (verifyResult.verified) {
        toast.success("✅ Cuenta verificada y conectada correctamente");
        account.verified = true;
      } else {
        const errors: string[] = [];
        if (!verifyResult.smtp.success) {
          errors.push(`SMTP: ${verifyResult.smtp.error ?? "Error desconocido"}`);
        }
        if (!verifyResult.imap.success) {
          errors.push(`IMAP: ${verifyResult.imap.error ?? "Error desconocido"}`);
        }
        toast.error(
          `Cuenta creada pero la verificación falló:\n${errors.join("\n")}`,
          { duration: 8000 }
        );
      }

      onCreated();
      resetForm();
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al crear/verificar");
    } finally {
      setVerifying(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) resetForm();
        onOpenChange(v);
      }}
    >
      <DialogContent className="border-slate-800 bg-slate-950 sm:max-w-2xl max-h-[90vh] overflow-auto">
        <DialogHeader>
          <DialogTitle className="text-white">
            Agregar cuenta de email (IMAP/SMTP)
          </DialogTitle>
          <DialogDescription className="text-slate-400">
            Conectá una cuenta de email de cualquier proveedor (Hostinger,
            Gmail, Outlook, etc.)
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          {/* Preset selector */}
          <div className="grid gap-2">
            <Label className="text-slate-300">Proveedor</Label>
            <div className="flex flex-wrap gap-2">
              {(Object.keys(PRESETS) as PresetKey[]).map((key) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => handlePresetChange(key)}
                  className={`rounded-md px-3 py-1.5 text-sm transition ${
                    preset === key
                      ? "bg-blue-600 text-white"
                      : "bg-slate-800 text-slate-300 hover:bg-slate-700"
                  }`}
                >
                  {PRESETS[key].label}
                </button>
              ))}
            </div>
          </div>

          {/* Basic fields */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label className="text-slate-300">Nombre (opcional)</Label>
              <Input
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder={`${PRESETS[preset].label} - mi@email.com`}
                className="border-slate-700 bg-slate-900 text-slate-200"
              />
            </div>
            <div className="grid gap-2">
              <Label className="text-slate-300">
                Email de envío <span className="text-red-400">*</span>
              </Label>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="contacto@miempresa.com"
                className="border-slate-700 bg-slate-900 text-slate-200"
              />
            </div>
          </div>

          {/* Credentials */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label className="text-slate-300">
                Usuario <span className="text-red-400">*</span>
              </Label>
              <Input
                value={user}
                onChange={(e) => setUser(e.target.value)}
                placeholder="contacto@miempresa.com"
                className="border-slate-700 bg-slate-900 text-slate-200"
              />
              <p className="text-xs text-slate-500">
                Generalmente es el email completo
              </p>
            </div>
            <div className="grid gap-2">
              <Label className="text-slate-300">
                Contraseña <span className="text-red-400">*</span>
              </Label>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="border-slate-700 bg-slate-900 text-slate-200"
              />
              <p className="text-xs text-slate-500">
                Se guarda cifrada en la base de datos
              </p>
            </div>
          </div>

          {/* SMTP settings */}
          <div className="rounded-lg border border-slate-800 p-4 space-y-3">
            <h4 className="text-sm font-medium text-slate-200">
              Configuración SMTP (envío)
            </h4>
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="grid gap-2">
                <Label className="text-slate-400 text-xs">Host</Label>
                <Input
                  value={smtpHost}
                  onChange={(e) => setSmtpHost(e.target.value)}
                  placeholder="smtp.hostinger.com"
                  className="border-slate-700 bg-slate-900 text-slate-200 text-sm"
                />
              </div>
              <div className="grid gap-2">
                <Label className="text-slate-400 text-xs">Puerto</Label>
                <Input
                  type="number"
                  value={smtpPort}
                  onChange={(e) => setSmtpPort(e.target.value)}
                  placeholder="465"
                  className="border-slate-700 bg-slate-900 text-slate-200 text-sm"
                />
              </div>
              <div className="flex items-end gap-2 pb-1">
                <Checkbox
                  id="smtpSecure"
                  checked={smtpSecure}
                  onCheckedChange={(checked) =>
                    setSmtpSecure(checked === true)
                  }
                />
                <Label
                  htmlFor="smtpSecure"
                  className="text-slate-300 text-sm cursor-pointer"
                >
                  SSL/TLS
                </Label>
              </div>
            </div>
          </div>

          {/* IMAP settings */}
          <div className="rounded-lg border border-slate-800 p-4 space-y-3">
            <h4 className="text-sm font-medium text-slate-200">
              Configuración IMAP (lectura / rebotes)
            </h4>
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="grid gap-2">
                <Label className="text-slate-400 text-xs">Host</Label>
                <Input
                  value={imapHost}
                  onChange={(e) => setImapHost(e.target.value)}
                  placeholder="imap.hostinger.com"
                  className="border-slate-700 bg-slate-900 text-slate-200 text-sm"
                />
              </div>
              <div className="grid gap-2">
                <Label className="text-slate-400 text-xs">Puerto</Label>
                <Input
                  type="number"
                  value={imapPort}
                  onChange={(e) => setImapPort(e.target.value)}
                  placeholder="993"
                  className="border-slate-700 bg-slate-900 text-slate-200 text-sm"
                />
              </div>
              <div className="flex items-end gap-2 pb-1">
                <Checkbox
                  id="imapSecure"
                  checked={imapSecure}
                  onCheckedChange={(checked) =>
                    setImapSecure(checked === true)
                  }
                />
                <Label
                  htmlFor="imapSecure"
                  className="text-slate-300 text-sm cursor-pointer"
                >
                  SSL/TLS
                </Label>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button
            type="button"
            variant="ghost"
            onClick={() => {
              resetForm();
              onOpenChange(false);
            }}
            className="text-slate-400 hover:text-white"
          >
            Cancelar
          </Button>
          <Button
            type="button"
            onClick={handleSave}
            disabled={saving || verifying}
            variant="outline"
            className="border-slate-600 text-slate-300 hover:bg-slate-800"
          >
            {saving ? (
              <IconLoader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : null}
            Guardar sin verificar
          </Button>
          <Button
            type="button"
            onClick={handleVerifyAndSave}
            disabled={saving || verifying}
            className="bg-blue-600 hover:bg-blue-700"
          >
            {verifying ? (
              <IconLoader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <IconPlugConnected className="mr-2 h-4 w-4" />
            )}
            Verificar y guardar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
