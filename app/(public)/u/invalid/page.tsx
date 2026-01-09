import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { IconLinkOff } from "@tabler/icons-react";

export default function InvalidUnsubscribePage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-4">
      <Card className="w-full max-w-md border-slate-700 bg-slate-900/80 backdrop-blur-sm">
        <CardHeader className="text-center space-y-4">
          <div className="mx-auto w-16 h-16 rounded-2xl flex items-center justify-center shadow-lg bg-gradient-to-br from-slate-600 to-slate-700">
            <IconLinkOff className="w-8 h-8 text-amber-400" stroke={1.5} />
          </div>
          <div>
            <CardTitle className="text-2xl font-bold text-white">
              Link inválido
            </CardTitle>
            <CardDescription className="text-slate-400 mt-2">
              Este link de baja no es válido o está incompleto.
            </CardDescription>
          </div>
        </CardHeader>

        <CardContent className="space-y-6">
          <p className="text-center text-sm text-slate-500">
            Si llegaste acá desde un correo nuestro, es posible que el link esté
            corrupto. Contactanos si necesitás ayuda para darte de baja.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
