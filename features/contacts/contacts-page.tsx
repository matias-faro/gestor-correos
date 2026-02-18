"use client";

import { useState, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/app/page-header";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { IconPlus, IconChevronLeft, IconChevronRight } from "@tabler/icons-react";
import { toast } from "sonner";
import { ContactsFiltersPanel } from "./contacts-filters";
import { ContactsTable } from "./contacts-table";
import { ContactDialog } from "./contact-dialog";
import {
  fetchContacts,
  createContact,
  updateContact,
  deleteContact,
  fetchContactSources,
} from "./api";
import type { Contact, ContactSourceOption, ContactsFilters } from "./types";

const PAGE_SIZE = 25;

export function ContactsPage() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [sources, setSources] = useState<ContactSourceOption[]>([]);
  const [sourcesLoading, setSourcesLoading] = useState(true);
  const [filters, setFilters] = useState<ContactsFilters>({
    query: "",
    company: "",
    position: "",
    tagIds: [],
    includeUnsubscribed: false,
    includeSuppressed: false,
    limit: PAGE_SIZE,
    offset: 0,
  });

  // Modal states
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingContact, setEditingContact] = useState<Contact | null>(null);
  const [saving, setSaving] = useState(false);

  // Delete confirmation
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingContact, setDeletingContact] = useState<Contact | null>(null);
  const [deleting, setDeleting] = useState(false);

  const loadContacts = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchContacts(filters);
      setContacts(data.contacts);
      setTotal(data.total);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al cargar contactos");
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    loadContacts();
  }, [loadContacts]);

  useEffect(() => {
    const loadSources = async () => {
      setSourcesLoading(true);
      try {
        const data = await fetchContactSources();
        setSources(data);
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : "Error al cargar fuentes"
        );
      } finally {
        setSourcesLoading(false);
      }
    };
    loadSources();
  }, []);

  // Handlers
  const handleFiltersChange = (newFilters: ContactsFilters) => {
    setFilters({ ...newFilters, limit: PAGE_SIZE, offset: 0 });
  };

  const handlePageChange = (direction: "prev" | "next") => {
    const newOffset =
      direction === "prev"
        ? Math.max(0, (filters.offset ?? 0) - PAGE_SIZE)
        : (filters.offset ?? 0) + PAGE_SIZE;
    setFilters({ ...filters, offset: newOffset });
  };

  const handleCreate = () => {
    setEditingContact(null);
    setDialogOpen(true);
  };

  const handleEdit = (contact: Contact) => {
    setEditingContact(contact);
    setDialogOpen(true);
  };

  const handleSave = async (data: {
    id?: string;
    email: string;
    firstName?: string;
    lastName?: string;
    company?: string;
    position?: string;
    tagIds: string[];
  }) => {
    setSaving(true);
    try {
      if (data.id) {
        await updateContact(data as Parameters<typeof updateContact>[0]);
        toast.success("Contacto actualizado");
      } else {
        await createContact(data);
        toast.success("Contacto creado");
      }
      setDialogOpen(false);
      loadContacts();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al guardar");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteClick = (contact: Contact) => {
    setDeletingContact(contact);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!deletingContact) return;
    setDeleting(true);
    try {
      await deleteContact(deletingContact.id);
      toast.success("Contacto eliminado");
      setDeleteDialogOpen(false);
      setDeletingContact(null);
      loadContacts();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al eliminar");
    } finally {
      setDeleting(false);
    }
  };

  // Pagination info
  const currentPage = Math.floor((filters.offset ?? 0) / PAGE_SIZE) + 1;
  const totalPages = Math.ceil(total / PAGE_SIZE);
  const showingFrom = total === 0 ? 0 : (filters.offset ?? 0) + 1;
  const showingTo = Math.min((filters.offset ?? 0) + PAGE_SIZE, total);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Contactos"
        description="Centralizá tu base de contactos y segmentá con filtros y etiquetas."
        actions={[
          {
            id: "new-contact",
            label: "Nuevo contacto",
            icon: <IconPlus className="h-4 w-4" stroke={2} />,
            onClick: handleCreate,
          },
        ]}
      />

      {/* Filters */}
      <ContactsFiltersPanel
        filters={filters}
        onChange={handleFiltersChange}
        sources={sourcesLoading ? [] : sources}
      />

      {/* Table */}
      <ContactsTable
        contacts={contacts}
        loading={loading}
        onEdit={handleEdit}
        onDelete={handleDeleteClick}
      />

      {/* Pagination */}
      {total > 0 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-slate-400">
            Mostrando {showingFrom}-{showingTo} de {total} contactos
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={currentPage === 1}
              onClick={() => handlePageChange("prev")}
              className="border-slate-700 bg-slate-900 text-slate-300 hover:bg-slate-800"
            >
              <IconChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm text-slate-400">
              Página {currentPage} de {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={currentPage >= totalPages}
              onClick={() => handlePageChange("next")}
              className="border-slate-700 bg-slate-900 text-slate-300 hover:bg-slate-800"
            >
              <IconChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Create/Edit Dialog */}
      <ContactDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        contact={editingContact}
        onSave={handleSave}
        saving={saving}
      />

      {/* Delete Confirmation */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="border-slate-800 bg-slate-950 sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-white">Eliminar contacto</DialogTitle>
            <DialogDescription className="text-slate-400">
              ¿Estás seguro de que querés eliminar a{" "}
              <span className="font-medium text-slate-200">
                {deletingContact?.email}
              </span>
              ? Esta acción no se puede deshacer.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button
              variant="ghost"
              onClick={() => setDeleteDialogOpen(false)}
              className="text-slate-400 hover:text-white"
            >
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteConfirm}
              disabled={deleting}
              className="bg-red-600 hover:bg-red-700"
            >
              {deleting ? "Eliminando..." : "Eliminar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
