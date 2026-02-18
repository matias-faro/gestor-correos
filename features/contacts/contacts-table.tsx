"use client";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/app/empty-state";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { IconDots, IconPencil, IconTrash } from "@tabler/icons-react";
import type { Contact } from "./types";

type ContactsTableProps = {
  contacts: Contact[];
  loading?: boolean;
  onEdit: (contact: Contact) => void;
  onDelete: (contact: Contact) => void;
};

export function ContactsTable({
  contacts,
  loading,
  onEdit,
  onDelete,
}: ContactsTableProps) {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-600 border-t-blue-500" />
      </div>
    );
  }

  if (contacts.length === 0) {
    return (
      <EmptyState
        title="No se encontraron contactos"
        description="Probá ajustando los filtros o cargá nuevos contactos."
      />
    );
  }

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/30">
      <Table>
        <TableHeader>
          <TableRow className="border-slate-800 hover:bg-transparent">
            <TableHead className="text-slate-400">Email</TableHead>
            <TableHead className="text-slate-400">Nombre</TableHead>
            <TableHead className="text-slate-400">Empresa</TableHead>
            <TableHead className="text-slate-400">Cargo</TableHead>
            <TableHead className="text-slate-400">Tags</TableHead>
            <TableHead className="text-slate-400">Estado</TableHead>
            <TableHead className="w-12" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {contacts.map((contact) => (
            <TableRow
              key={contact.id}
              className="border-slate-800 hover:bg-slate-900/50"
            >
              <TableCell className="font-medium text-slate-200">
                {contact.email}
              </TableCell>
              <TableCell className="text-slate-300">
                {[contact.firstName, contact.lastName]
                  .filter(Boolean)
                  .join(" ") || "—"}
              </TableCell>
              <TableCell className="text-slate-300">
                {contact.company || "—"}
              </TableCell>
              <TableCell className="text-slate-300">
                {contact.position || "—"}
              </TableCell>
              <TableCell>
                <div className="flex flex-wrap gap-1">
                  {contact.tags.slice(0, 3).map((tag) => (
                    <Badge
                      key={tag.id}
                      variant="outline"
                      className={
                        tag.kind === "tipo"
                          ? "border-blue-500/30 bg-blue-500/10 text-blue-400"
                          : "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
                      }
                    >
                      {tag.name}
                    </Badge>
                  ))}
                  {contact.tags.length > 3 && (
                    <Badge
                      variant="outline"
                      className="border-slate-600 text-slate-400"
                    >
                      +{contact.tags.length - 3}
                    </Badge>
                  )}
                </div>
              </TableCell>
              <TableCell>
                <StatusBadge
                  subscription={contact.subscriptionStatus}
                  suppression={contact.suppressionStatus}
                />
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
                      onClick={() => onEdit(contact)}
                      className="cursor-pointer text-slate-300 focus:bg-slate-800 focus:text-white"
                    >
                      <IconPencil className="mr-2 h-4 w-4" />
                      Editar
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => onDelete(contact)}
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

function StatusBadge({
  subscription,
  suppression,
}: {
  subscription: "active" | "unsubscribed";
  suppression: "none" | "bounced";
}) {
  if (suppression === "bounced") {
    return (
      <Badge
        variant="outline"
        className="border-red-500/30 bg-red-500/10 text-red-400"
      >
        Rebotado
      </Badge>
    );
  }

  if (subscription === "unsubscribed") {
    return (
      <Badge
        variant="outline"
        className="border-amber-500/30 bg-amber-500/10 text-amber-400"
      >
        Desuscrito
      </Badge>
    );
  }

  return (
    <Badge
      variant="outline"
      className="border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
    >
      Activo
    </Badge>
  );
}
