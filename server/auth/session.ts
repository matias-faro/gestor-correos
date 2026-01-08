import { createClient, createServiceClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export type SessionUser = {
  id: string;
  email: string;
  displayName: string | null;
  avatarUrl: string | null;
};

/**
 * Obtiene el usuario autenticado actual.
 * Si no hay sesión, redirige a login.
 */
export async function getRequiredUser(): Promise<SessionUser> {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    redirect("/login");
  }

  return {
    id: user.id,
    email: user.email!,
    displayName: user.user_metadata?.full_name ?? null,
    avatarUrl: user.user_metadata?.avatar_url ?? null,
  };
}

/**
 * Obtiene el usuario si existe, sin redirigir.
 */
export async function getOptionalUser(): Promise<SessionUser | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  return {
    id: user.id,
    email: user.email!,
    displayName: user.user_metadata?.full_name ?? null,
    avatarUrl: user.user_metadata?.avatar_url ?? null,
  };
}

/**
 * Verifica si el usuario está en el allowlist.
 * En modo single-tenant, solo ciertos emails/dominios pueden acceder.
 */
export async function checkAllowlist(email: string): Promise<boolean> {
  const supabase = await createServiceClient();

  const { data: settings } = await supabase
    .from("settings")
    .select("allowlist_emails, allowlist_domains")
    .eq("id", 1)
    .single();

  if (!settings) {
    // Si no hay settings, permitir acceso (primera vez)
    return true;
  }

  const allowedEmails = settings.allowlist_emails as string[] | null;
  const allowedDomains = settings.allowlist_domains as string[] | null;

  // Si no hay allowlist configurado, permitir todos
  if (
    (!allowedEmails || allowedEmails.length === 0) &&
    (!allowedDomains || allowedDomains.length === 0)
  ) {
    return true;
  }

  // Verificar email exacto
  if (allowedEmails?.includes(email)) {
    return true;
  }

  // Verificar dominio
  const domain = email.split("@")[1];
  if (allowedDomains?.includes(domain)) {
    return true;
  }

  return false;
}

/**
 * Obtiene el usuario y verifica allowlist.
 * Redirige si no está autorizado.
 */
export async function getAuthorizedUser(): Promise<SessionUser> {
  const user = await getRequiredUser();
  const isAllowed = await checkAllowlist(user.email);

  if (!isAllowed) {
    redirect("/login?error=unauthorized");
  }

  return user;
}
