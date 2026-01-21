import { createClient, createServiceClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

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
      if (session.provider_refresh_token) {
        const serviceClient = await createServiceClient();

        // Verificar si ya existe un registro para este usuario
        const { data: existingAccount } = await serviceClient
          .from("google_accounts")
          .select("id")
          .eq("user_id", user.id)
          .single();

        const googleAccountData = {
          user_id: user.id,
          google_sub: user.user_metadata?.sub ?? null,
          email: user.email,
          access_token: session.provider_token ?? null,
          refresh_token: session.provider_refresh_token,
          token_expiry: session.expires_at
            ? new Date(session.expires_at * 1000).toISOString()
            : null,
          scopes: [
            "gmail.send",
            "gmail.readonly",
            "gmail.modify",
            "spreadsheets.readonly",
            "drive.metadata.readonly",
          ],
          updated_at: new Date().toISOString(),
        };

        if (existingAccount) {
          // Actualizar registro existente
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
