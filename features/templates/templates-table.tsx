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
import { EmptyState } from "@/components/app/empty-state";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { IconDots, IconPencil, IconTrash, IconEye } from "@tabler/icons-react";
import type { Template } from "./types";

type TemplatesTableProps = {
  templates: Template[];
  loading?: boolean;
  onEdit: (template: Template) => void;
  onDelete: (template: Template) => void;
  onPreview: (template: Template) => void;
};

export function TemplatesTable({
  templates,
  loading,
  onEdit,
  onDelete,
  onPreview,
}: TemplatesTableProps) {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-600 border-t-blue-500" />
      </div>
    );
  }

  if (templates.length === 0) {
    return (
      <EmptyState
        title="Todavía no creaste plantillas"
        description="Creá tu primera plantilla con asunto y HTML personalizado."
      />
    );
  }

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/30">
      <Table>
        <TableHeader>
          <TableRow className="border-slate-800 hover:bg-transparent">
            <TableHead className="text-slate-400">Nombre</TableHead>
            <TableHead className="text-slate-400">Asunto</TableHead>
            <TableHead className="text-slate-400">Creado</TableHead>
            <TableHead className="w-12" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {templates.map((template) => (
            <TableRow
              key={template.id}
              className="border-slate-800 hover:bg-slate-900/50"
            >
              <TableCell className="font-medium text-slate-200">
                {template.name}
              </TableCell>
              <TableCell className="max-w-xs truncate text-slate-300">
                {template.subjectTpl}
              </TableCell>
              <TableCell className="text-slate-400">
                {new Date(template.createdAt).toLocaleDateString("es-AR", {
                  day: "2-digit",
                  month: "short",
                  year: "numeric",
                })}
              </TableCell>
              <TableCell>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
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
                      onClick={() => onPreview(template)}
                      className="cursor-pointer text-slate-300 focus:bg-slate-800 focus:text-white"
                    >
                      <IconEye className="mr-2 h-4 w-4" />
                      Previsualizar
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => onEdit(template)}
                      className="cursor-pointer text-slate-300 focus:bg-slate-800 focus:text-white"
                    >
                      <IconPencil className="mr-2 h-4 w-4" />
                      Editar
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => onDelete(template)}
                      className="cursor-pointer text-red-400 focus:bg-red-500/10 focus:text-red-400"
                    >
                      <IconTrash className="mr-2 h-4 w-4" />
                      Eliminar
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
