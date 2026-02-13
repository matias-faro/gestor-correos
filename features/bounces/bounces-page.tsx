"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  IconRefresh,
  IconMailOff,
  IconExternalLink,
  IconChevronLeft,
  IconChevronRight,
  IconLoader2,
  IconTrash,
} from "@tabler/icons-react";
import { toast } from "sonner";
import {
  cleanupBounces,
  fetchBounces,
  scanBounces,
  scanTrashAndCleanupContacts,
} from "./api";
import type { BounceEventResponse } from "./types";

const PAGE_SIZE = 25;

export function BouncesPage() {
  const [bounces, setBounces] = useState<BounceEventResponse[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [trashCleanupDialogOpen, setTrashCleanupDialogOpen] = useState(false);
  const [trashCleaning, setTrashCleaning] = useState(false);
  const cancelTrashCleanupRef = useRef(false);
  const [trashProgress, setTrashProgress] = useState<{
    pages: number;
    scanned: number;
    extracted: number;
    deletedContacts: number;
    errors: number;
  }>({
    pages: 0,
    scanned: 0,
    extracted: 0,
    deletedContacts: 0,
    errors: 0,
  });
  const [offset, setOffset] = useState(0);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [cleanupDialogOpen, setCleanupDialogOpen] = useState(false);
  const [cleaning, setCleaning] = useState(false);

  const loadBounces = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchBounces({ limit: PAGE_SIZE, offset });
      setBounces(data.bounces);
      setTotal(data.total);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al cargar rebotes");
    } finally {
      setLoading(false);
    }
  }, [offset]);

  useEffect(() => {
    loadBounces();
  }, [loadBounces]);

  const handleScan = async () => {
    setScanning(true);
    try {
      const result = await scanBounces({
        maxResults: 100,
        newerThanDays: 0,
        trashProcessed: true,
      });

      if (result.created > 0) {
        toast.success(
          `Escaneo completado: ${result.scanned} mensajes, ${result.created} rebotes nuevos, ${result.suppressed} contactos suprimidos`
        );
        loadBounces();
      } else if (result.scanned > 0) {
        toast.info(`Escaneo completado: ${result.scanned} mensajes revisados, ningún rebote nuevo`);
      } else {
        toast.info("No se encontraron mensajes de rebote");
      }

      if (result.errors.length > 0) {
        console.warn("[BouncesPage] Errores durante escaneo:", result.errors);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al escanear rebotes");
    } finally {
      setScanning(false);
    }
  };

  const handleTrashCleanupConfirm = async () => {
    setTrashCleaning(true);
    cancelTrashCleanupRef.current = false;
    setTrashProgress({
      pages: 0,
      scanned: 0,
      extracted: 0,
      deletedContacts: 0,
      errors: 0,
    });

    try {
      let pageToken: string | undefined;
      let safetyPages = 0;
      const totals = {
        pages: 0,
        scanned: 0,
        extracted: 0,
        deletedContacts: 0,
        errors: 0,
      };

      while (!cancelTrashCleanupRef.current) {
        const res = await scanTrashAndCleanupContacts({
          maxResults: 100,
          newerThanDays: 0,
          pageToken,
          deleteContacts: true,
        });

        safetyPages += 1;
        if (safetyPages > 500) {
          throw new Error("Abortado por seguridad: demasiadas páginas en la bandeja de correo");
        }

        totals.pages += 1;
        totals.scanned += res.scanned;
        totals.extracted += res.extracted;
        totals.deletedContacts += res.deletedContacts;
        totals.errors += res.errors.length;
        setTrashProgress({ ...totals });

        pageToken = res.nextPageToken ?? undefined;
        if (!pageToken) break;
      }

      if (cancelTrashCleanupRef.current) {
        toast.info("Proceso detenido. Se aplicaron los cambios hasta la última página procesada.");
      } else {
        toast.success(
          `Listo: ${totals.scanned} mails revisados, ${totals.deletedContacts} contactos eliminados` +
            (totals.errors > 0 ? `, ${totals.errors} con error` : "")
        );
      }

      setTrashCleanupDialogOpen(false);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Error al escanear la papelera"
      );
    } finally {
      setTrashCleaning(false);
      cancelTrashCleanupRef.current = false;
    }
  };

  const handleTrashCleanupStop = () => {
    cancelTrashCleanupRef.current = true;
  };

  const handlePageChange = (direction: "prev" | "next") => {
    const newOffset =
      direction === "prev"
        ? Math.max(0, offset - PAGE_SIZE)
        : offset + PAGE_SIZE;
    setOffset(newOffset);
  };

  const toggleSelected = (id: string, checked: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  const setSelectedForCurrentPage = (checked: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      for (const b of bounces) {
        if (checked) next.add(b.id);
        else next.delete(b.id);
      }
      return next;
    });
  };

  const handleCleanupConfirm = async () => {
    if (selectedIds.size === 0) return;
    setCleaning(true);
    try {
      const ids = Array.from(selectedIds);
      const result = await cleanupBounces({
        ids,
        deleteContacts: true,
        trashGmailMessages: true,
      });

      toast.success(
        `Limpieza completada: ${result.deletedContacts} contactos eliminados, ${result.trashed} mails a papelera`
      );

      if (result.skippedUnknownEmails > 0) {
        toast.info(
          `${result.skippedUnknownEmails} rebotes sin email extraíble: no se eliminó contacto`
        );
      }

      if (result.errors.length > 0) {
        console.warn("[BouncesPage] Errores durante limpieza:", result.errors);
        toast.info(`Limpieza con advertencias: ${result.errors.length} con error`);
      }

      setCleanupDialogOpen(false);
      setSelectedIds(new Set());
      // Si quedamos parados en una página que puede quedar vacía tras eliminar,
      // volvemos a la primera página y dejamos que el effect recargue.
      if (offset !== 0) {
        setOffset(0);
      } else {
        loadBounces();
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al limpiar rebotes");
    } finally {
      setCleaning(false);
    }
  };

  // Pagination info
  const currentPage = Math.floor(offset / PAGE_SIZE) + 1;
  const totalPages = Math.ceil(total / PAGE_SIZE);
  const showingFrom = total === 0 ? 0 : offset + 1;
  const showingTo = Math.min(offset + PAGE_SIZE, total);

  const pageIds = bounces.map((b) => b.id);
  const selectedOnPage = pageIds.filter((id) => selectedIds.has(id)).length;
  const allOnPageSelected = pageIds.length > 0 && selectedOnPage === pageIds.length;
  const headerCheckboxState =
    allOnPageSelected ? true : selectedOnPage > 0 ? "indeterminate" : false;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">Rebotes</h1>
          <p className="mt-1 text-slate-400">
            Detecta y gestiona emails rebotados
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            onClick={handleScan}
            disabled={scanning || trashCleaning}
            className="bg-blue-600 hover:bg-blue-700"
          >
            {scanning ? (
              <IconLoader2 className="mr-2 h-4 w-4 animate-spin" stroke={2} />
            ) : (
              <IconRefresh className="mr-2 h-4 w-4" stroke={2} />
            )}
            {scanning ? "Escaneando..." : "Escanear rebotes"}
          </Button>
          <Button
            variant="outline"
            onClick={() => setTrashCleanupDialogOpen(true)}
            disabled={scanning || trashCleaning}
            className="border-red-500/40 bg-slate-950 text-red-300 hover:bg-red-500/10 hover:text-red-200"
            title="Escanea DSN en Papelera y elimina contactos por email rebotado"
          >
            <IconTrash className="mr-2 h-4 w-4" />
            Escanear papelera y borrar contactos
          </Button>
        </div>
      </div>

      {/* Table Card */}
      <Card className="border-slate-800 bg-slate-900/50">
        <CardHeader className="flex flex-row items-center justify-between gap-4">
          <CardTitle className="text-white">Rebotes detectados</CardTitle>
          {selectedIds.size > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-sm text-slate-400">
                {selectedIds.size} seleccionados
              </span>
              <Button
                variant="outline"
                onClick={() => setCleanupDialogOpen(true)}
                className="border-red-500/40 bg-slate-950 text-red-300 hover:bg-red-500/10 hover:text-red-200"
              >
                <IconTrash className="mr-2 h-4 w-4" />
                Eliminar contactos y mandar a papelera
              </Button>
            </div>
          )}
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-600 border-t-blue-500" />
            </div>
          ) : bounces.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <IconMailOff className="h-16 w-16 text-slate-600" stroke={1} />
              <p className="mt-4 text-lg text-slate-400">
                No hay rebotes detectados
              </p>
              <p className="mt-2 text-sm text-slate-500">
                Ejecutá un escaneo para detectar emails rebotados en tu bandeja
              </p>
            </div>
          ) : (
            <div className="rounded-lg border border-slate-800">
              <Table>
                <TableHeader>
                  <TableRow className="border-slate-800 hover:bg-transparent">
                    <TableHead className="w-10">
                      <Checkbox
                        checked={headerCheckboxState}
                        onCheckedChange={(value) =>
                          setSelectedForCurrentPage(value === true)
                        }
                        aria-label="Seleccionar todos en esta página"
                      />
                    </TableHead>
                    <TableHead className="text-slate-400">Fecha</TableHead>
                    <TableHead className="text-slate-400">Email rebotado</TableHead>
                    <TableHead className="text-slate-400">Motivo</TableHead>
                    <TableHead className="w-12" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {bounces.map((bounce) => (
                    <TableRow
                      key={bounce.id}
                      className="border-slate-800 hover:bg-slate-900/50"
                    >
                      <TableCell>
                        <Checkbox
                          checked={selectedIds.has(bounce.id)}
                          onCheckedChange={(value) =>
                            toggleSelected(bounce.id, value === true)
                          }
                          aria-label={`Seleccionar rebote ${bounce.bouncedEmail}`}
                        />
                      </TableCell>
                      <TableCell className="text-slate-300">
                        {formatDate(bounce.detectedAt)}
                      </TableCell>
                      <TableCell className="font-medium text-slate-200">
                        {bounce.bouncedEmail.startsWith("unknown-") ? (
                          <span className="text-slate-500 italic">
                            No se pudo extraer
                          </span>
                        ) : (
                          bounce.bouncedEmail
                        )}
                      </TableCell>
                      <TableCell className="max-w-md text-slate-300">
                        <span
                          className="block truncate"
                          title={bounce.reason ?? undefined}
                        >
                          {bounce.reason ?? "—"}
                        </span>
                      </TableCell>
                      <TableCell>
                        {bounce.gmailPermalink && (
                          <a
                            href={bounce.gmailPermalink}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center text-slate-400 transition-colors hover:text-white"
                            title="Ver mensaje original"
                          >
                            <IconExternalLink className="h-4 w-4" />
                          </a>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Pagination */}
      {total > 0 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-slate-400">
            Mostrando {showingFrom}-{showingTo} de {total} rebotes
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

      {/* Cleanup confirmation */}
      <Dialog open={cleanupDialogOpen} onOpenChange={setCleanupDialogOpen}>
        <DialogContent className="border-slate-800 bg-slate-950">
          <DialogHeader>
            <DialogTitle className="text-white">
              Eliminar contactos y mandar a papelera
            </DialogTitle>
            <DialogDescription className="text-slate-400">
              Vas a eliminar {selectedIds.size} contactos (si el email del rebote
              pudo extraerse) y enviar a papelera los mensajes de rebote.
              Esta acción no se puede deshacer.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setCleanupDialogOpen(false)}
              disabled={cleaning}
              className="border-slate-700 bg-slate-900 text-slate-300 hover:bg-slate-800"
            >
              Cancelar
            </Button>
            <Button
              onClick={handleCleanupConfirm}
              disabled={cleaning || selectedIds.size === 0}
              className="bg-red-600 hover:bg-red-700"
            >
              {cleaning ? "Procesando..." : "Confirmar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Trash scan confirmation */}
      <Dialog
        open={trashCleanupDialogOpen}
        onOpenChange={(open) => {
          if (trashCleaning) return;
          setTrashCleanupDialogOpen(open);
        }}
      >
        <DialogContent className="border-slate-800 bg-slate-950">
          <DialogHeader>
            <DialogTitle className="text-white">
              Escanear Papelera y borrar contactos
            </DialogTitle>
            <DialogDescription className="text-slate-400">
              Esta acción revisa mensajes de rebote (DSN) dentro de la Papelera de
              tu correo, extrae el “email rebotado” y elimina de la base de datos los
              contactos cuyo email coincida. Los mails no se borran (ya
              están en Papelera).
            </DialogDescription>
          </DialogHeader>

          {trashCleaning && (
            <div className="rounded-md border border-slate-800 bg-slate-900/50 p-3 text-sm text-slate-300">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <span className="text-slate-400">Páginas</span>:{" "}
                  {trashProgress.pages}
                </div>
                <div>
                  <span className="text-slate-400">Mails revisados</span>:{" "}
                  {trashProgress.scanned}
                </div>
                <div>
                  <span className="text-slate-400">Emails extraídos</span>:{" "}
                  {trashProgress.extracted}
                </div>
                <div>
                  <span className="text-slate-400">Contactos eliminados</span>:{" "}
                  {trashProgress.deletedContacts}
                </div>
                <div>
                  <span className="text-slate-400">Errores</span>:{" "}
                  {trashProgress.errors}
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            {trashCleaning ? (
              <>
                <Button
                  variant="outline"
                  onClick={handleTrashCleanupStop}
                  className="border-slate-700 bg-slate-900 text-slate-300 hover:bg-slate-800"
                >
                  Detener
                </Button>
                <Button
                  disabled
                  className="bg-red-600 hover:bg-red-700 disabled:opacity-60"
                >
                  Procesando...
                </Button>
              </>
            ) : (
              <>
                <Button
                  variant="outline"
                  onClick={() => setTrashCleanupDialogOpen(false)}
                  className="border-slate-700 bg-slate-900 text-slate-300 hover:bg-slate-800"
                >
                  Cancelar
                </Button>
                <Button
                  onClick={handleTrashCleanupConfirm}
                  className="bg-red-600 hover:bg-red-700"
                >
                  Confirmar y procesar
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return new Intl.DateTimeFormat("es-AR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}
