"use client";

import { Button } from "@/components/ui/button";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type PageHeaderAction = {
  id: string;
  label: string;
  onClick?: () => void;
  href?: string;
  icon?: ReactNode;
  variant?: "default" | "outline" | "ghost";
  disabled?: boolean;
};

type PageHeaderProps = {
  title: string;
  description?: string;
  badge?: ReactNode;
  actions?: PageHeaderAction[];
  className?: string;
};

export function PageHeader({
  title,
  description,
  badge,
  actions = [],
  className,
}: PageHeaderProps) {
  return (
    <header
      className={cn(
        "flex flex-col gap-4 rounded-2xl border border-slate-800/80 bg-slate-900/40 p-5 sm:p-6 lg:flex-row lg:items-start lg:justify-between",
        className
      )}
    >
      <div className="space-y-2">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-semibold tracking-tight text-slate-100 sm:text-3xl">
            {title}
          </h1>
          {badge}
        </div>
        {description ? (
          <p className="max-w-2xl text-sm text-slate-400 sm:text-base">
            {description}
          </p>
        ) : null}
      </div>

      {actions.length > 0 ? (
        <div className="flex flex-wrap items-center gap-2">
          {actions.map((action) => {
            const content = (
              <>
                {action.icon}
                {action.label}
              </>
            );

            if (action.href) {
              return (
                <Button
                  key={action.id}
                  asChild
                  variant={action.variant ?? "default"}
                  className="min-w-[9.5rem]"
                  disabled={action.disabled}
                >
                  <a href={action.href}>{content}</a>
                </Button>
              );
            }

            return (
              <Button
                key={action.id}
                type="button"
                onClick={action.onClick}
                variant={action.variant ?? "default"}
                className="min-w-[9.5rem]"
                disabled={action.disabled}
              >
                {content}
              </Button>
            );
          })}
        </div>
      ) : null}
    </header>
  );
}
