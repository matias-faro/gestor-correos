import { createServiceClient } from "@/lib/supabase/server";
import { EmptyState } from "@/components/app/empty-state";
import { PageHeader } from "@/components/app/page-header";
import { StatusChip } from "@/components/app/status-chip";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  IconUsers,
  IconTemplate,
  IconSend,
  IconMailFast,
  IconChecklist,
  IconCircleCheck,
  IconCircleDashed,
  IconPlayerPause,
  IconExternalLink,
  IconArrowRight,
} from "@tabler/icons-react";
import Link from "next/link";
import {
  getDashboardStats,
  getActiveCampaign,
} from "@/server/services/DashboardService";

export default async function DashboardPage() {
  const stats = await getDashboardStats();
  const activeCampaign = await getActiveCampaign();
  const supabase = await createServiceClient();

  const { count: connectedEmailCount } = await supabase
    .from("email_accounts")
    .select("id", { count: "exact", head: true })
    .eq("verified", true);

  const checklistItems = [
    {
      id: "email-account",
      label: "Conectar una cuenta de envío",
      done: (connectedEmailCount ?? 0) > 0,
      href: "/settings",
    },
    {
      id: "templates",
      label: "Crear al menos una plantilla",
      done: stats.templatesCount > 0,
      href: "/templates",
    },
    {
      id: "contacts",
      label: "Cargar contactos para enviar",
      done: stats.contactsCount > 0,
      href: "/contacts",
    },
    {
      id: "campaign",
      label: "Crear y preparar una campaña",
      done: stats.campaignsCount > 0,
      href: "/campaigns",
    },
  ];

  const statCards = [
    {
      title: "Contactos",
      value: stats.contactsCount.toString(),
      description: "Total de contactos activos",
      icon: IconUsers,
      href: "/contacts",
    },
    {
      title: "Plantillas",
      value: stats.templatesCount.toString(),
      description: "Plantillas creadas",
      icon: IconTemplate,
      href: "/templates",
    },
    {
      title: "Campañas",
      value: stats.campaignsCount.toString(),
      description: "Campañas totales",
      icon: IconSend,
      href: "/campaigns",
    },
    {
      title: "Enviados hoy",
      value: stats.sentTodayCount.toString(),
      description: "Correos enviados hoy",
      icon: IconMailFast,
      href: "/campaigns",
    },
  ];

  return (
    <div className="space-y-8">
      <PageHeader
        title="Dashboard"
        description="Resumen de tu operación y próximos pasos para lanzar campañas."
        badge={
          activeCampaign ? (
            <StatusChip tone="success">Campaña en curso</StatusChip>
          ) : undefined
        }
      />

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {statCards.map((stat) => (
          <Link key={stat.title} href={stat.href}>
            <Card className="border-slate-800 bg-slate-900/40 transition-colors hover:border-slate-700 hover:bg-slate-900/70">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-slate-400">
                  {stat.title}
                </CardTitle>
                <div className="rounded-lg bg-slate-800 p-2">
                  <stat.icon className="h-4 w-4 text-slate-200" stroke={1.8} />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-white">{stat.value}</div>
                <p className="text-xs text-slate-500">{stat.description}</p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.2fr_1fr]">
        <Card className="border-slate-800 bg-slate-900/40">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-white">
              <IconChecklist className="h-5 w-5 text-slate-300" />
              Primeros pasos
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {checklistItems.map((item) => (
              <Link
                key={item.id}
                href={item.href}
                className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-950/50 px-4 py-3 transition-colors hover:border-slate-700 hover:bg-slate-900/70"
              >
                <div className="flex items-center gap-3">
                  {item.done ? (
                    <IconCircleCheck className="h-5 w-5 text-emerald-400" />
                  ) : (
                    <IconCircleDashed className="h-5 w-5 text-slate-500" />
                  )}
                  <p className="text-sm text-slate-200">{item.label}</p>
                </div>
                <IconArrowRight className="h-4 w-4 text-slate-500" />
              </Link>
            ))}
          </CardContent>
        </Card>

        <Card className="border-slate-800 bg-slate-900/40">
        <CardHeader>
          <CardTitle className="text-white">Estado de envío</CardTitle>
        </CardHeader>
        <CardContent>
          {activeCampaign ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {activeCampaign.status === "sending" ? (
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-500/15">
                      <IconSend className="h-5 w-5 text-emerald-400" />
                    </div>
                  ) : (
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-500/15">
                      <IconPlayerPause className="h-5 w-5 text-amber-400" />
                    </div>
                  )}
                  <div>
                    <h3 className="font-semibold text-white">
                      {activeCampaign.name}
                    </h3>
                    <p className="text-sm text-slate-400">
                      {activeCampaign.templateName ?? "Plantilla no definida"}
                    </p>
                  </div>
                </div>
                <Link href={`/campaigns/${activeCampaign.id}`}>
                  <Button
                    variant="outline"
                    size="sm"
                    className="border-slate-700 text-slate-300 hover:bg-slate-800"
                  >
                    <IconExternalLink className="mr-2 h-4 w-4" />
                    Ver detalles
                  </Button>
                </Link>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-400">Progreso</span>
                  <span className="text-white">
                    {activeCampaign.sentCount} / {activeCampaign.totalDrafts} enviados
                  </span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-slate-800">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-green-500 to-emerald-400 transition-all"
                    style={{
                      width: `${
                        activeCampaign.totalDrafts > 0
                          ? (activeCampaign.sentCount / activeCampaign.totalDrafts) * 100
                          : 0
                      }%`,
                    }}
                  />
                </div>
                <div className="flex justify-between text-xs text-slate-500">
                  <span>{activeCampaign.status === "sending" ? "Enviando" : "Pausada"}</span>
                  <span>{activeCampaign.pendingCount} pendientes</span>
                </div>
              </div>
            </div>
          ) : (
            <EmptyState
              icon={<IconSend className="h-6 w-6" stroke={1.5} />}
              title="No hay campañas activas"
              description="Creá una campaña y prepará destinatarios para comenzar a enviar."
              actions={
                <Link href="/campaigns">
                  <Button
                    variant="outline"
                    className="border-slate-700 text-slate-300 hover:bg-slate-800"
                  >
                    Ir a campañas
                  </Button>
                </Link>
              }
              className="px-4 py-9"
            />
          )}
        </CardContent>
      </Card>
      </div>
    </div>
  );
}
