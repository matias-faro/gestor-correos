"use client";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  IconDots,
  IconEye,
  IconTrash,
  IconTemplate,
  IconUsers,
  IconSend,
  IconMail,
} from "@tabler/icons-react";
import type { Campaign, CampaignStatus, CampaignWithStats } from "./types";

const STATUS_LABELS: Record<CampaignStatus, string> = {
  draft: "Borrador",
  ready: "Lista",
  sending: "Enviando",
  paused: "Pausada",
  completed: "Completada",
  cancelled: "Cancelada",
};

const STATUS_VARIANTS: Record<
  CampaignStatus,
  "default" | "secondary" | "destructive" | "outline"
> = {
  draft: "outline",
  ready: "secondary",
  sending: "default",
  paused: "secondary",
  completed: "default",
  cancelled: "destructive",
};

const STATUS_COLORS: Record<CampaignStatus, string> = {
  draft: "",
  ready: "",
  sending: "bg-green-600 animate-pulse",
  paused: "bg-amber-600",
  completed: "bg-green-600",
  cancelled: "",
};

type CampaignsTableProps = {
  campaigns: CampaignWithStats[];
  loading?: boolean;
  onView: (campaign: Campaign) => void;
  onDelete: (campaign: Campaign) => void;
  statusFilter?: CampaignStatus | "all";
  onStatusFilterChange?: (status: CampaignStatus | "all") => void;
};

const STATUS_TABS: { id: CampaignStatus | "all"; label: string }[] = [
  { id: "all", label: "Todas" },
  { id: "draft", label: "Borrador" },
  { id: "ready", label: "Lista" },
  { id: "sending", label: "Enviando" },
  { id: "paused", label: "Pausada" },
  { id: "completed", label: "Completada" },
  { id: "cancelled", label: "Cancelada" },
];

export function CampaignsTable({
  campaigns,
  loading,
  onView,
  onDelete,
  statusFilter = "all",
  onStatusFilterChange,
}: CampaignsTableProps) {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-600 border-t-blue-500" />
      </div>
    );
  }

  // Filter campaigns if status filter is active
  const filteredCampaigns = statusFilter === "all" 
    ? campaigns 
    : campaigns.filter(c => c.status === statusFilter);

  // Count by status for tabs
  const statusCounts = campaigns.reduce((acc, c) => {
    acc[c.status] = (acc[c.status] || 0) + 1;
    return acc;
  }, {} as Record<CampaignStatus, number>);

  if (campaigns.length === 0) {
    return (
      <div className="rounded-lg border border-slate-800 bg-slate-900/30 p-12">
        <div className="mx-auto max-w-md text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-slate-800">
            <IconMail className="h-8 w-8 text-slate-400" />
          </div>
          <h3 className="text-lg font-medium text-white">No hay campañas todavía</h3>
          <p className="mt-2 text-sm text-slate-400">
            Creá tu primera campaña siguiendo estos pasos:
          </p>
          <div className="mt-6 space-y-3 text-left">
            <div className="flex items-center gap-3 rounded-lg border border-slate-700 bg-slate-900/50 p-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-600/20 text-sm font-medium text-blue-400">
                1
              </div>
              <div className="flex items-center gap-2 text-sm text-slate-300">
                <IconTemplate className="h-4 w-4 text-slate-500" />
                Creá una plantilla con tu mensaje
              </div>
            </div>
            <div className="flex items-center gap-3 rounded-lg border border-slate-700 bg-slate-900/50 p-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-600/20 text-sm font-medium text-blue-400">
                2
              </div>
              <div className="flex items-center gap-2 text-sm text-slate-300">
                <IconUsers className="h-4 w-4 text-slate-500" />
                Importá o creá contactos
              </div>
            </div>
            <div className="flex items-center gap-3 rounded-lg border border-slate-700 bg-slate-900/50 p-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-600/20 text-sm font-medium text-blue-400">
                3
              </div>
              <div className="flex items-center gap-2 text-sm text-slate-300">
                <IconSend className="h-4 w-4 text-slate-500" />
                Creá la campaña y enviá
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Status Filter Tabs */}
      {onStatusFilterChange && (
        <div className="flex flex-wrap gap-2">
          {STATUS_TABS.map((tab) => {
            const count = tab.id === "all" 
              ? campaigns.length 
              : statusCounts[tab.id] || 0;
            
            if (tab.id !== "all" && count === 0) return null;

            return (
              <button
                key={tab.id}
                onClick={() => onStatusFilterChange(tab.id)}
                className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                  statusFilter === tab.id
                    ? "bg-slate-700 text-white"
                    : "bg-slate-900 text-slate-400 hover:bg-slate-800 hover:text-white"
                }`}
              >
                {tab.label}
                <span className="ml-1.5 text-xs opacity-60">({count})</span>
              </button>
            );
          })}
        </div>
      )}

      {filteredCampaigns.length === 0 ? (
        <div className="rounded-lg border border-slate-800 bg-slate-900/30 py-12 text-center">
          <p className="text-slate-500">No hay campañas con este estado</p>
        </div>
      ) : (
        <div className="rounded-lg border border-slate-800">
          <Table>
            <TableHeader>
              <TableRow className="border-slate-800 hover:bg-transparent">
                <TableHead className="text-slate-400">Nombre</TableHead>
                <TableHead className="text-slate-400">Plantilla</TableHead>
                <TableHead className="text-slate-400">Estado</TableHead>
                <TableHead className="text-slate-400">Progreso</TableHead>
                <TableHead className="text-slate-400">Creada</TableHead>
                <TableHead className="w-12" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredCampaigns.map((campaign) => {
                const { stats } = campaign;
                const progress = stats.totalDrafts > 0
                  ? Math.round((stats.sent / stats.totalDrafts) * 100)
                  : 0;

                return (
                  <TableRow
                    key={campaign.id}
                    className="cursor-pointer border-slate-800 hover:bg-slate-900/50"
                    onClick={() => onView(campaign)}
                  >
                    <TableCell className="font-medium text-slate-200">
                      {campaign.name}
                    </TableCell>
                    <TableCell className="text-slate-300">
                      {campaign.templateName ?? (
                        <span className="text-slate-500">Sin plantilla</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={STATUS_VARIANTS[campaign.status]}
                        className={`text-xs ${STATUS_COLORS[campaign.status]}`}
                      >
                        {STATUS_LABELS[campaign.status]}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {stats.totalDrafts > 0 ? (
                        <div className="flex items-center gap-2">
                          <div className="h-2 w-20 overflow-hidden rounded-full bg-slate-700">
                            <div
                              className={`h-full transition-all ${
                                progress === 100
                                  ? "bg-green-500"
                                  : campaign.status === "sending"
                                    ? "bg-blue-500"
                                    : "bg-slate-500"
                              }`}
                              style={{ width: `${progress}%` }}
                            />
                          </div>
                          <span className="text-xs text-slate-400">
                            {stats.sent}/{stats.totalDrafts}
                          </span>
                        </div>
                      ) : (
                        <span className="text-sm text-slate-500">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-slate-400">
                      {new Date(campaign.createdAt).toLocaleDateString("es-AR", {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                      })}
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger
                          asChild
                          onClick={(e) => e.stopPropagation()}
                        >
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0 text-slate-400 hover:text-white"
                          >
                            <IconDots className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent
                          align="end"
                          className="border-slate-800 bg-slate-950"
                        >
                          <DropdownMenuItem
                            onClick={(e) => {
                              e.stopPropagation();
                              onView(campaign);
                            }}
                            className="cursor-pointer text-slate-300 focus:bg-slate-800 focus:text-white"
                          >
                            <IconEye className="mr-2 h-4 w-4" />
                            Ver detalle
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={(e) => {
                              e.stopPropagation();
                              onDelete(campaign);
                            }}
                            className="cursor-pointer text-red-400 focus:bg-red-500/10 focus:text-red-400"
                          >
                            <IconTrash className="mr-2 h-4 w-4" />
                            Eliminar
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
