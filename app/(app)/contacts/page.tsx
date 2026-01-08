import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { IconUsers, IconPlus } from "@tabler/icons-react";

export default function ContactsPage() {
  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">Contactos</h1>
          <p className="mt-2 text-slate-400">
            Gestiona tu base de contactos y segmentos
          </p>
        </div>
        <Button className="bg-blue-600 hover:bg-blue-700">
          <IconPlus className="mr-2 h-4 w-4" stroke={2} />
          Nuevo contacto
        </Button>
      </div>

      <Card className="border-slate-800 bg-slate-900/50">
        <CardHeader>
          <CardTitle className="text-white">Lista de contactos</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <IconUsers className="h-16 w-16 text-slate-600" stroke={1} />
            <p className="mt-4 text-lg text-slate-400">
              No hay contactos todavía
            </p>
            <p className="mt-2 text-sm text-slate-500">
              Agregá tu primer contacto para comenzar a crear campañas
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
