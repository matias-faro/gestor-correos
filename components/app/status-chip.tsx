"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type StatusTone = "success" | "warning" | "danger" | "info" | "neutral";

const toneStyles: Record<StatusTone, string> = {
  success: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300",
  warning: "border-amber-500/30 bg-amber-500/10 text-amber-300",
  danger: "border-rose-500/30 bg-rose-500/10 text-rose-300",
  info: "border-blue-500/30 bg-blue-500/10 text-blue-300",
  neutral: "border-slate-600/60 bg-slate-800/80 text-slate-300",
};

type StatusChipProps = {
  tone?: StatusTone;
  icon?: ReactNode;
  children: ReactNode;
  className?: string;
};

export function StatusChip({
  tone = "neutral",
  icon,
  children,
  className,
}: StatusChipProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium",
        toneStyles[tone],
        className
      )}
    >
      {icon}
      {children}
    </span>
  );
}
