"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type EmptyStateProps = {
  icon?: ReactNode;
  title: string;
  description?: string;
  actions?: ReactNode;
  className?: string;
};

export function EmptyState({
  icon,
  title,
  description,
  actions,
  className,
}: EmptyStateProps) {
  return (
    <section
      className={cn(
        "rounded-2xl border border-dashed border-slate-700/80 bg-slate-900/30 px-6 py-12 text-center",
        className
      )}
    >
      {icon ? (
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-slate-800/80 text-slate-400">
          {icon}
        </div>
      ) : null}

      <h3 className="text-lg font-medium text-slate-100">{title}</h3>
      {description ? <p className="mt-2 text-sm text-slate-400">{description}</p> : null}
      {actions ? <div className="mt-6 flex items-center justify-center gap-2">{actions}</div> : null}
    </section>
  );
}
