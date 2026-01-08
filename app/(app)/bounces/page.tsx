import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { IconMailOff, IconRefresh } from "@tabler/icons-react";

export default function BouncesPage() {
  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">Rebotes</h1>
          <p className="mt-2 text-slate-400">
            Detecta y gestiona emails rebotados
          </p>
        </div>
        <Button className="bg-blue-600 hover:bg-blue-700">
          <IconRefresh className="mr-2 h-4 w-4" stroke={2} />
          Escanear rebotes
        </Button>
      </div>

      <Card className="border-slate-800 bg-slate-900/50">
        <CardHeader>
          <CardTitle className="text-white">Rebotes detectados</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <IconMailOff className="h-16 w-16 text-slate-600" stroke={1} />
            <p className="mt-4 text-lg text-slate-400">
              No hay rebotes detectados
            </p>
            <p className="mt-2 text-sm text-slate-500">
              Ejecutá un escaneo para detectar emails rebotados en tu bandeja
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
