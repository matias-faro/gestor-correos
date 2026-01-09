"use client";

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod/v4";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { IconInfoCircle } from "@tabler/icons-react";
import type { Template } from "./types";

const templateFormSchema = z.object({
  name: z.string().min(1, "El nombre es obligatorio").max(200),
  subjectTpl: z.string().min(1, "El asunto es obligatorio").max(500),
  htmlTpl: z.string().min(1, "El contenido HTML es obligatorio"),
});

type TemplateFormData = z.infer<typeof templateFormSchema>;

type TemplateDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  template: Template | null;
  onSave: (data: {
    id?: string;
    name: string;
    subjectTpl: string;
    htmlTpl: string;
  }) => Promise<void>;
  saving?: boolean;
};

const AVAILABLE_VARIABLES = [
  { name: "FirstName", example: "{{FirstName}}" },
  { name: "LastName", example: "{{LastName}}" },
  { name: "Company", example: "{{Company}}" },
  { name: "UnsubscribeUrl", example: "{{UnsubscribeUrl}}" },
];

export function TemplateDialog({
  open,
  onOpenChange,
  template,
  onSave,
  saving,
}: TemplateDialogProps) {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<TemplateFormData>({
    resolver: zodResolver(templateFormSchema),
    defaultValues: {
      name: "",
      subjectTpl: "",
      htmlTpl: "",
    },
  });

  useEffect(() => {
    if (open) {
      if (template) {
        reset({
          name: template.name,
          subjectTpl: template.subjectTpl,
          htmlTpl: template.htmlTpl,
        });
      } else {
        reset({
          name: "",
          subjectTpl: "",
          htmlTpl: "",
        });
      }
    }
  }, [open, template, reset]);

  const onSubmit = async (data: TemplateFormData) => {
    await onSave({
      id: template?.id,
      name: data.name,
      subjectTpl: data.subjectTpl,
      htmlTpl: data.htmlTpl,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="border-slate-800 bg-slate-950 sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-white">
            {template ? "Editar plantilla" : "Nueva plantilla"}
          </DialogTitle>
          <DialogDescription className="text-slate-400">
            {template
              ? "Modificá los datos de la plantilla"
              : "Creá una plantilla de email con variables personalizables"}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {/* Variables disponibles */}
          <div className="rounded-lg border border-slate-700 bg-slate-900/50 p-3">
            <div className="flex items-center gap-2 text-sm text-slate-300">
              <IconInfoCircle className="h-4 w-4 text-blue-400" />
              <span className="font-medium">Variables disponibles:</span>
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              {AVAILABLE_VARIABLES.map((v) => (
                <code
                  key={v.name}
                  className="rounded bg-slate-800 px-2 py-0.5 text-xs text-blue-300"
                >
                  {v.example}
                </code>
              ))}
            </div>
            <p className="mt-2 text-xs text-slate-500">
              Condicional: <code className="text-emerald-400">{"{{#if FirstName}}Hola {{FirstName}}{{else}}Hola{{/if}}"}</code>
            </p>
          </div>

          {/* Nombre */}
          <div className="space-y-1.5">
            <Label htmlFor="name" className="text-slate-300">
              Nombre <span className="text-red-400">*</span>
            </Label>
            <Input
              id="name"
              placeholder="Mi plantilla de bienvenida"
              {...register("name")}
              className="border-slate-700 bg-slate-900 text-slate-200 placeholder:text-slate-500"
            />
            {errors.name && (
              <p className="text-xs text-red-400">{errors.name.message}</p>
            )}
          </div>

          {/* Asunto */}
          <div className="space-y-1.5">
            <Label htmlFor="subjectTpl" className="text-slate-300">
              Asunto <span className="text-red-400">*</span>
            </Label>
            <Input
              id="subjectTpl"
              placeholder="Hola {{FirstName}}, tenemos novedades para vos"
              {...register("subjectTpl")}
              className="border-slate-700 bg-slate-900 text-slate-200 placeholder:text-slate-500"
            />
            {errors.subjectTpl && (
              <p className="text-xs text-red-400">{errors.subjectTpl.message}</p>
            )}
          </div>

          {/* HTML */}
          <div className="space-y-1.5">
            <Label htmlFor="htmlTpl" className="text-slate-300">
              Contenido HTML <span className="text-red-400">*</span>
            </Label>
            <textarea
              id="htmlTpl"
              rows={12}
              placeholder="<html><body><h1>Hola {{FirstName}}</h1>...</body></html>"
              {...register("htmlTpl")}
              className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-200 placeholder:text-slate-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 font-mono"
            />
            {errors.htmlTpl && (
              <p className="text-xs text-red-400">{errors.htmlTpl.message}</p>
            )}
          </div>

          <DialogFooter className="gap-2 pt-4">
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
              className="text-slate-400 hover:text-white"
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={saving}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {saving ? "Guardando..." : template ? "Guardar" : "Crear"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
