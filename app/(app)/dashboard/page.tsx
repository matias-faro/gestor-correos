import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  IconUsers,
  IconTemplate,
  IconSend,
  IconMailFast,
} from "@tabler/icons-react";

const stats = [
  {
    title: "Contactos",
    value: "0",
    description: "Total de contactos activos",
    icon: IconUsers,
    color: "from-blue-500 to-blue-600",
  },
  {
    title: "Plantillas",
    value: "0",
    description: "Plantillas creadas",
    icon: IconTemplate,
    color: "from-emerald-500 to-emerald-600",
  },
  {
    title: "Campañas",
    value: "0",
    description: "Campañas totales",
    icon: IconSend,
    color: "from-violet-500 to-violet-600",
  },
  {
    title: "Enviados hoy",
    value: "0",
    description: "Correos enviados hoy",
    icon: IconMailFast,
    color: "from-amber-500 to-amber-600",
  },
];

export default function DashboardPage() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-white">Dashboard</h1>
        <p className="mt-2 text-slate-400">
          Bienvenido al gestor de campañas de email
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <Card
            key={stat.title}
            className="border-slate-800 bg-slate-900/50"
          >
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-slate-400">
                {stat.title}
              </CardTitle>
              <div
                className={`rounded-lg bg-gradient-to-br ${stat.color} p-2`}
              >
                <stat.icon className="h-4 w-4 text-white" stroke={2} />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-white">{stat.value}</div>
              <p className="text-xs text-slate-500">{stat.description}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Sección de campañas activas */}
      <Card className="border-slate-800 bg-slate-900/50">
        <CardHeader>
          <CardTitle className="text-white">Campaña activa</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <IconSend className="h-12 w-12 text-slate-600" stroke={1} />
            <p className="mt-4 text-slate-400">
              No hay campañas activas en este momento
            </p>
            <p className="mt-1 text-sm text-slate-500">
              Creá una campaña desde la sección Campañas
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
