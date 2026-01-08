import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { IconSettings, IconClock, IconMail, IconShield } from "@tabler/icons-react";

export default function SettingsPage() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-white">Configuración</h1>
        <p className="mt-2 text-slate-400">
          Ajustes del sistema y preferencias de envío
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Ventanas de envío */}
        <Card className="border-slate-800 bg-slate-900/50">
          <CardHeader>
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
          </CardHeader>
          <CardContent>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between text-slate-300">
                <span>Lunes - Viernes</span>
                <span className="text-slate-400">09:00 - 20:00</span>
              </div>
              <div className="flex justify-between text-slate-300">
                <span>Sábado - Domingo</span>
                <span className="text-slate-400">09:00 - 13:00</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Cuota diaria */}
        <Card className="border-slate-800 bg-slate-900/50">
          <CardHeader>
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
          </CardHeader>
          <CardContent>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between text-slate-300">
                <span>Cuota diaria</span>
                <span className="text-slate-400">1490 emails</span>
              </div>
              <div className="flex justify-between text-slate-300">
                <span>Delay mínimo</span>
                <span className="text-slate-400">30 segundos</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Firma por defecto */}
        <Card className="border-slate-800 bg-slate-900/50">
          <CardHeader>
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
          </CardHeader>
          <CardContent>
            <p className="text-sm text-slate-500">
              No hay firma configurada
            </p>
          </CardContent>
        </Card>

        {/* Acceso */}
        <Card className="border-slate-800 bg-slate-900/50">
          <CardHeader>
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
          </CardHeader>
          <CardContent>
            <p className="text-sm text-slate-500">
              Sin restricciones configuradas
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
