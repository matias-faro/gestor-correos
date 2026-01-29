"use client";

import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { IconBrandGoogle, IconMail } from "@tabler/icons-react";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { GOOGLE_OAUTH_SCOPE_STRING } from "@/lib/google/scopes";

function LoginContent() {
  const searchParams = useSearchParams();
  const error = searchParams.get("error");

  const handleGoogleLogin = async () => {
    const supabase = createClient();

    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/api/auth/callback`,
        scopes: GOOGLE_OAUTH_SCOPE_STRING,
        queryParams: {
          access_type: "offline",
          prompt: "consent",
          include_granted_scopes: "true",
        },
      },
    });

    if (error) {
      console.error("Error de autenticación:", error);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-4">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-blue-900/20 via-transparent to-transparent" />

      <Card className="w-full max-w-md relative border-slate-700 bg-slate-900/80 backdrop-blur-sm">
        <CardHeader className="text-center space-y-4">
          <div className="mx-auto w-16 h-16 bg-gradient-to-br from-blue-500 to-cyan-400 rounded-2xl flex items-center justify-center shadow-lg shadow-blue-500/25">
            <IconMail className="w-8 h-8 text-white" stroke={1.5} />
          </div>
          <div>
            <CardTitle className="text-2xl font-bold text-white">
              Gestor de Correos
            </CardTitle>
            <CardDescription className="text-slate-400 mt-2">
              Sistema de gestión de campañas de email
            </CardDescription>
          </div>
        </CardHeader>

        <CardContent className="space-y-6">
          {error === "auth_failed" && (
            <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm text-center">
              Error en la autenticación. Por favor, intentá de nuevo.
            </div>
          )}

          {error === "unauthorized" && (
            <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg text-amber-400 text-sm text-center">
              Tu cuenta no está autorizada para acceder a esta aplicación.
            </div>
          )}

          <Button
            onClick={handleGoogleLogin}
            className="w-full h-12 bg-white hover:bg-slate-100 text-slate-900 font-medium"
            size="lg"
          >
            <IconBrandGoogle className="w-5 h-5 mr-2" stroke={1.5} />
            Iniciar sesión con Google
          </Button>

          <div className="text-center">
            <p className="text-xs text-slate-500 leading-relaxed">
              Al iniciar sesión, autorizás el acceso a tu cuenta de Gmail para
              enviar correos y detectar rebotes.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-slate-900">
          <div className="animate-pulse text-slate-400">Cargando...</div>
        </div>
      }
    >
      <LoginContent />
    </Suspense>
  );
}
