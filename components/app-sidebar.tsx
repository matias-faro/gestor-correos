"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
  SheetClose,
} from "@/components/ui/sheet";
import {
  IconLayoutDashboard,
  IconUsers,
  IconTemplate,
  IconSend,
  IconMailOff,
  IconSettings,
  IconMenu2,
} from "@tabler/icons-react";

export const APP_NAVIGATION = [
  { name: "Dashboard", href: "/dashboard", icon: IconLayoutDashboard },
  { name: "Contactos", href: "/contacts", icon: IconUsers },
  { name: "Plantillas", href: "/templates", icon: IconTemplate },
  { name: "Campañas", href: "/campaigns", icon: IconSend },
  { name: "Rebotes", href: "/bounces", icon: IconMailOff },
  { name: "Configuración", href: "/settings", icon: IconSettings },
];

function SidebarNav({
  mobile = false,
  closeOnNavigate = false,
}: {
  mobile?: boolean;
  closeOnNavigate?: boolean;
}) {
  const pathname = usePathname();

  return (
    <nav
      className={cn(
        "space-y-1",
        mobile ? "px-1 py-2" : "flex-1 px-3 py-4"
      )}
      aria-label="Navegación principal"
    >
      {APP_NAVIGATION.map((item) => {
        const isActive = pathname.startsWith(item.href);

        const linkClassName = cn(
          "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
          isActive
            ? "bg-accent text-accent-foreground"
            : "text-muted-foreground hover:bg-accent/70 hover:text-foreground"
        );

        if (closeOnNavigate) {
          return (
            <SheetClose asChild key={item.name}>
              <Link href={item.href} className={linkClassName}>
                <item.icon className="h-5 w-5" stroke={1.5} />
                {item.name}
              </Link>
            </SheetClose>
          );
        }

        return (
          <Link key={item.name} href={item.href} className={linkClassName}>
            <item.icon className="h-5 w-5" stroke={1.5} />
            {item.name}
          </Link>
        );
      })}
    </nav>
  );
}

export function AppSidebar() {
  return (
    <aside className="fixed inset-y-0 left-0 z-50 hidden h-full w-64 flex-col border-r border-border/90 bg-background/95 lg:flex">
      <div className="flex h-16 items-center gap-3 border-b border-border px-6">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/15">
          <IconSend className="h-5 w-5 text-primary" stroke={1.5} />
        </div>
        <div>
          <p className="text-sm font-semibold text-foreground">Gestor</p>
          <p className="text-xs text-muted-foreground">Campañas por email</p>
        </div>
      </div>

      <SidebarNav />

      <div className="border-t border-border px-4 py-3">
        <p className="text-xs text-muted-foreground">Gestor de Correos v1.0</p>
      </div>
    </aside>
  );
}

export function AppMobileSidebar() {
  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="text-muted-foreground hover:bg-accent hover:text-foreground lg:hidden"
          aria-label="Abrir navegación"
        >
          <IconMenu2 className="h-5 w-5" stroke={1.7} />
        </Button>
      </SheetTrigger>
      <SheetContent
        side="left"
        className="w-72 border-border bg-background p-0 text-foreground"
      >
        <SheetHeader className="border-b border-border px-5 py-4 text-left">
          <SheetTitle className="text-base text-foreground">Gestor</SheetTitle>
        </SheetHeader>
        <div className="px-3 py-3">
          <SidebarNav mobile closeOnNavigate />
        </div>
      </SheetContent>
    </Sheet>
  );
}
