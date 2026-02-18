"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type StatusTone = "success" | "warning" | "danger" | "info" | "neutral";

const toneStyles: Record<StatusTone, string> = {
  success: "border-emerald-500/35 bg-emerald-500/12 text-emerald-300",
  warning: "border-amber-500/35 bg-amber-500/12 text-amber-300",
  danger: "border-rose-500/35 bg-rose-500/12 text-rose-300",
  info: "border-blue-500/35 bg-blue-500/12 text-blue-300",
  neutral: "border-border bg-muted/80 text-muted-foreground",
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
