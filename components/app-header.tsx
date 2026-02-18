"use client";

import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { AppMobileSidebar } from "@/components/app-sidebar";
import { StatusChip } from "@/components/app/status-chip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { IconLogout, IconCircleCheck, IconAlertCircle } from "@tabler/icons-react";

type AppHeaderProps = {
  user: {
    email: string;
    displayName: string | null;
    avatarUrl: string | null;
  };
  hasEmailConnection: boolean;
};

export function AppHeader({ user, hasEmailConnection }: AppHeaderProps) {
  const router = useRouter();

  const handleLogout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  };

  const initials = user.displayName
    ? user.displayName
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : user.email.slice(0, 2).toUpperCase();

  return (
    <header className="sticky top-0 z-40 flex h-16 items-center justify-between border-b border-slate-800/80 bg-slate-950/95 px-4 backdrop-blur-sm lg:px-6">
      <div className="flex items-center gap-3">
        <AppMobileSidebar />

        {hasEmailConnection ? (
          <StatusChip
            tone="success"
            icon={<IconCircleCheck className="h-3.5 w-3.5" stroke={2} />}
          >
            Email conectado
          </StatusChip>
        ) : (
          <StatusChip
            tone="warning"
            icon={<IconAlertCircle className="h-3.5 w-3.5" stroke={2} />}
          >
            Sin cuenta de email
          </StatusChip>
        )}
      </div>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            className="relative h-10 w-10 rounded-full ring-offset-slate-950 focus-visible:ring-slate-400"
          >
            <Avatar className="h-10 w-10">
              <AvatarImage src={user.avatarUrl ?? undefined} alt={user.displayName ?? user.email} />
              <AvatarFallback className="bg-slate-800 text-slate-300">
                {initials}
              </AvatarFallback>
            </Avatar>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          className="w-56 border-slate-800 bg-slate-950/95"
          align="end"
          forceMount
        >
          <DropdownMenuLabel className="font-normal">
            <div className="flex flex-col space-y-1">
              {user.displayName && (
                <p className="text-sm font-medium text-white">{user.displayName}</p>
              )}
              <p className="text-xs text-slate-400">{user.email}</p>
            </div>
          </DropdownMenuLabel>
          <DropdownMenuSeparator className="bg-slate-800" />
          <DropdownMenuItem
            onClick={handleLogout}
            className="cursor-pointer text-slate-300 focus:bg-slate-800 focus:text-white"
          >
            <IconLogout className="mr-2 h-4 w-4" stroke={1.5} />
            Cerrar sesión
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  );
}
