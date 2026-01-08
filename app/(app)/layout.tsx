import { getAuthorizedUser } from "@/server/auth/session";
import { createServiceClient } from "@/lib/supabase/server";
import { AppSidebar } from "@/components/app-sidebar";
import { AppHeader } from "@/components/app-header";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getAuthorizedUser();

  // Verificar si tiene conexión de Gmail
  const supabase = await createServiceClient();
  const { data: googleAccount } = await supabase
    .from("google_accounts")
    .select("refresh_token")
    .eq("user_id", user.id)
    .single();

  const hasGmailConnection = !!googleAccount?.refresh_token;

  return (
    <div className="min-h-screen bg-slate-950">
      <AppSidebar />
      <div className="pl-64">
        <AppHeader user={user} hasGmailConnection={hasGmailConnection} />
        <main className="p-6">{children}</main>
      </div>
    </div>
  );
}
