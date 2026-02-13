import { createClient, createServiceClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { GOOGLE_OAUTH_SCOPES } from "@/lib/google/scopes";
import {
  getEmailAccountByGoogleAccountId,
  createGoogleEmailAccount,
} from "@/server/integrations/db/email-accounts-repo";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/dashboard";

  if (code) {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error && data.session) {
      const { session, user } = data;

      // Guardar el refresh token de Google en google_accounts
      {
        const serviceClient = await createServiceClient();

        // Verificar si ya existe un registro para este usuario
        const { data: existingAccount } = await serviceClient
          .from("google_accounts")
          .select("id, refresh_token")
          .eq("user_id", user.id)
          .single();

        const refreshToken =
          session.provider_refresh_token ?? existingAccount?.refresh_token ?? null;

        // Si no tenemos refresh token (ni nuevo ni previo), no podemos operar con Google APIs.
        // Esto suele pasar cuando el provider no devuelve refresh_token (p.ej. falta access_type=offline
        // o el usuario ya autorizó sin "prompt=consent"). En ese caso, forzamos un error explícito.
        if (!refreshToken) {
          return NextResponse.redirect(`${origin}/login?error=auth_failed`);
        }

        const googleAccountData = {
          user_id: user.id,
          google_sub: user.user_metadata?.sub ?? null,
          email: user.email,
          access_token: session.provider_token ?? null,
          refresh_token: refreshToken,
          token_expiry: session.expires_at
            ? new Date(session.expires_at * 1000).toISOString()
            : null,
          scopes: [...GOOGLE_OAUTH_SCOPES],
          updated_at: new Date().toISOString(),
        };

        if (existingAccount) {
          // Actualizar registro existente (manteniendo refresh_token previo si no vino uno nuevo)
          await serviceClient
            .from("google_accounts")
            .update(googleAccountData)
            .eq("id", existingAccount.id);
        } else {
          // Crear nuevo registro
          await serviceClient.from("google_accounts").insert({
            ...googleAccountData,
            created_at: new Date().toISOString(),
          });
        }
      }

      // Crear/actualizar perfil del usuario
      const serviceClient = await createServiceClient();
      await serviceClient.from("profiles").upsert({
        user_id: user.id,
        email: user.email,
        display_name: user.user_metadata?.full_name ?? null,
        created_at: new Date().toISOString(),
      });

      // Asegurar que existe un email_account asociado al google_account
      {
        // Buscar la cuenta de Google recién creada/actualizada
        const { data: googleAcct } = await serviceClient
          .from("google_accounts")
          .select("id")
          .eq("user_id", user.id)
          .single();

        if (googleAcct?.id) {
          const existingEmailAcct = await getEmailAccountByGoogleAccountId(googleAcct.id);
          if (!existingEmailAcct) {
            try {
              await createGoogleEmailAccount({
                userId: user.id,
                email: user.email!,
                googleAccountId: googleAcct.id,
              });
            } catch (err) {
              // No bloquear login si falla la creación del email_account
              console.warn(
                "[auth/callback] Error creando email_account para Google:",
                err instanceof Error ? err.message : err
              );
            }
          }
        }
      }

      const forwardedHost = request.headers.get("x-forwarded-host");
      const isLocalEnv = process.env.NODE_ENV === "development";

      if (isLocalEnv) {
        return NextResponse.redirect(`${origin}${next}`);
      } else if (forwardedHost) {
        return NextResponse.redirect(`https://${forwardedHost}${next}`);
      } else {
        return NextResponse.redirect(`${origin}${next}`);
      }
    }
  }

  // Si hay error, redirigir a login con mensaje
  return NextResponse.redirect(`${origin}/login?error=auth_failed`);
}
