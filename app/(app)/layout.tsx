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

  // Verificar si tiene alguna cuenta de email configurada (Google o IMAP/SMTP)
  const supabase = await createServiceClient();
  const { count: emailAccountCount } = await supabase
    .from("email_accounts")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .eq("verified", true);

  // Fallback: si no hay email_accounts, verificar google_accounts (backward-compat)
  let hasEmailConnection = (emailAccountCount ?? 0) > 0;
  if (!hasEmailConnection) {
    const { data: googleAccount } = await supabase
      .from("google_accounts")
      .select("refresh_token")
      .eq("user_id", user.id)
      .single();
    hasEmailConnection = !!googleAccount?.refresh_token;
  }

  return (
    <div className="min-h-screen bg-slate-950">
      <AppSidebar />
      <div className="pl-64">
        <AppHeader user={user} hasEmailConnection={hasEmailConnection} />
        <main className="p-6">{children}</main>
      </div>
    </div>
  );
}
