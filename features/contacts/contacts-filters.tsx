"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { IconSearch, IconX } from "@tabler/icons-react";
import { TagMultiselect } from "./tag-multiselect";
import type { ContactSourceOption, ContactsFilters } from "./types";

type ContactsFiltersProps = {
  filters: ContactsFilters;
  onChange: (filters: ContactsFilters) => void;
  sources: ContactSourceOption[];
};

export function ContactsFiltersPanel({
  filters,
  onChange,
  sources,
}: ContactsFiltersProps) {
  const handleReset = () => {
    onChange({
      query: "",
      company: "",
      position: "",
      tagIds: [],
      sourceId: undefined,
      includeUnsubscribed: false,
      includeSuppressed: false,
    });
  };

  const hasFilters =
    filters.query ||
    filters.company ||
    filters.position ||
    (filters.tagIds && filters.tagIds.length > 0) ||
    filters.sourceId ||
    filters.includeUnsubscribed ||
    filters.includeSuppressed;

  return (
    <div className="space-y-4 rounded-xl border border-slate-800 bg-slate-900/40 p-4">
      {/* Búsqueda principal */}
      <div className="relative">
        <IconSearch className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
        <Input
          placeholder="Buscar por email, nombre..."
          value={filters.query ?? ""}
          onChange={(e) => onChange({ ...filters, query: e.target.value })}
          className="border-slate-700 bg-slate-900 pl-9 text-slate-200 placeholder:text-slate-500"
        />
      </div>

      {/* Filtros en grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {/* Fuente */}
        <div className="space-y-1.5">
          <Label className="text-xs text-slate-400">Fuente</Label>
          <select
            value={filters.sourceId ?? ""}
            onChange={(e) =>
              onChange({
                ...filters,
                sourceId: e.target.value || undefined,
              })
            }
            className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-200"
          >
            <option value="">Todas las fuentes</option>
            {sources.map((source) => (
              <option key={source.id} value={source.id}>
                {source.name}
              </option>
            ))}
          </select>
        </div>

        {/* Empresa */}
        <div className="space-y-1.5">
          <Label className="text-xs text-slate-400">Empresa</Label>
          <Input
            placeholder="Filtrar por empresa..."
            value={filters.company ?? ""}
            onChange={(e) => onChange({ ...filters, company: e.target.value })}
            className="border-slate-700 bg-slate-900 text-slate-200 placeholder:text-slate-500"
          />
        </div>

        {/* Cargo */}
        <div className="space-y-1.5">
          <Label className="text-xs text-slate-400">Cargo</Label>
          <Input
            placeholder="Filtrar por cargo..."
            value={filters.position ?? ""}
            onChange={(e) => onChange({ ...filters, position: e.target.value })}
            className="border-slate-700 bg-slate-900 text-slate-200 placeholder:text-slate-500"
          />
        </div>

        {/* Tags */}
        <div className="space-y-1.5 lg:col-span-2">
          <Label className="text-xs text-slate-400">Tags (todos deben coincidir)</Label>
          <TagMultiselect
            selectedIds={filters.tagIds ?? []}
            onChange={(tagIds) => onChange({ ...filters, tagIds })}
            allowCreate={false}
          />
        </div>
      </div>

      {/* Checkboxes y reset */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap gap-6">
          <div className="flex items-center gap-2">
            <Checkbox
              id="includeUnsubscribed"
              checked={filters.includeUnsubscribed ?? false}
              onCheckedChange={(checked) =>
                onChange({ ...filters, includeUnsubscribed: !!checked })
              }
              className="border-slate-600"
            />
            <Label
              htmlFor="includeUnsubscribed"
              className="cursor-pointer text-sm text-slate-400"
            >
              Incluir desuscritos
            </Label>
          </div>

          <div className="flex items-center gap-2">
            <Checkbox
              id="includeSuppressed"
              checked={filters.includeSuppressed ?? false}
              onCheckedChange={(checked) =>
                onChange({ ...filters, includeSuppressed: !!checked })
              }
              className="border-slate-600"
            />
            <Label
              htmlFor="includeSuppressed"
              className="cursor-pointer text-sm text-slate-400"
            >
              Incluir suprimidos
            </Label>
          </div>
        </div>

        {hasFilters && (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleReset}
            className="text-slate-400 hover:text-white"
          >
            <IconX className="mr-1 h-4 w-4" />
            Limpiar filtros
          </Button>
        )}
      </div>
    </div>
  );
}
