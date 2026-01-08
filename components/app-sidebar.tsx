"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  IconLayoutDashboard,
  IconUsers,
  IconTemplate,
  IconSend,
  IconMailOff,
  IconSettings,
} from "@tabler/icons-react";

const navigation = [
  { name: "Dashboard", href: "/dashboard", icon: IconLayoutDashboard },
  { name: "Contactos", href: "/contacts", icon: IconUsers },
  { name: "Plantillas", href: "/templates", icon: IconTemplate },
  { name: "Campañas", href: "/campaigns", icon: IconSend },
  { name: "Rebotes", href: "/bounces", icon: IconMailOff },
  { name: "Configuración", href: "/settings", icon: IconSettings },
];

export function AppSidebar() {
  const pathname = usePathname();

  return (
    <aside className="fixed inset-y-0 left-0 z-50 flex h-full w-64 flex-col border-r border-slate-800 bg-slate-950">
      {/* Logo */}
      <div className="flex h-16 items-center gap-3 border-b border-slate-800 px-6">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-blue-500 to-cyan-400">
          <IconSend className="h-5 w-5 text-white" stroke={1.5} />
        </div>
        <span className="text-lg font-semibold text-white">Gestor</span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1 px-3 py-4">
        {navigation.map((item) => {
          const isActive = pathname.startsWith(item.href);
          return (
            <Link
              key={item.name}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                isActive
                  ? "bg-slate-800 text-white"
                  : "text-slate-400 hover:bg-slate-900 hover:text-white"
              )}
            >
              <item.icon className="h-5 w-5" stroke={1.5} />
              {item.name}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="border-t border-slate-800 p-4">
        <div className="text-xs text-slate-500">
          Gestor de Correos v1.0
        </div>
      </div>
    </aside>
  );
}
