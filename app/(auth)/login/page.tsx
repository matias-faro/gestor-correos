"use client";

import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { IconBrandGoogle, IconMail, IconLoader2 } from "@tabler/icons-react";
import { useSearchParams, useRouter } from "next/navigation";
import { Suspense, useState } from "react";
import { GOOGLE_OAUTH_SCOPE_STRING } from "@/lib/google/scopes";

function LoginContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const error = searchParams.get("error");

  const [loginMode, setLoginMode] = useState<"select" | "email">("select");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [emailError, setEmailError] = useState<string | null>(null);

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

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;

    setLoading(true);
    setEmailError(null);

    const supabase = createClient();

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setEmailError(error.message);
      setLoading(false);
      return;
    }

    router.push("/dashboard");
    router.refresh();
  };

  const handleSignUp = async () => {
    if (!email || !password) return;

    setLoading(true);
    setEmailError(null);

    const supabase = createClient();

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/dashboard`,
      },
    });

    if (error) {
      setEmailError(error.message);
      setLoading(false);
      return;
    }

    setEmailError(null);
    setLoading(false);
    // Show success message
    setLoginMode("select");
    alert(
      "Se envió un email de confirmación. Revisá tu bandeja de entrada para activar tu cuenta."
    );
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

          {loginMode === "select" ? (
            <>
              <Button
                onClick={handleGoogleLogin}
                className="w-full h-12 bg-white hover:bg-slate-100 text-slate-900 font-medium"
                size="lg"
              >
                <IconBrandGoogle className="w-5 h-5 mr-2" stroke={1.5} />
                Iniciar sesión con Google
              </Button>

              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t border-slate-700" />
                </div>
                <div className="relative flex justify-center text-xs">
                  <span className="bg-slate-900 px-2 text-slate-500">o</span>
                </div>
              </div>

              <Button
                onClick={() => setLoginMode("email")}
                variant="outline"
                className="w-full h-12 border-slate-700 bg-transparent text-slate-300 hover:bg-slate-800 hover:text-white font-medium"
                size="lg"
              >
                <IconMail className="w-5 h-5 mr-2" stroke={1.5} />
                Iniciar sesión con email
              </Button>

              <div className="text-center">
                <p className="text-xs text-slate-500 leading-relaxed">
                  Con Google, se conecta automáticamente tu cuenta de Gmail para enviar correos y acceder a Google Sheets.
                  Con email/contraseña, podés configurar cualquier proveedor (Hostinger, Outlook, etc.) después en Ajustes.
                </p>
              </div>
            </>
          ) : (
            <>
              <form onSubmit={handleEmailLogin} className="space-y-4">
                {emailError && (
                  <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm text-center">
                    {emailError}
                  </div>
                )}

                <div className="space-y-2">
                  <Label htmlFor="email" className="text-slate-300">
                    Email
                  </Label>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="tu@email.com"
                    className="border-slate-700 bg-slate-800 text-slate-200"
                    autoFocus
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="password" className="text-slate-300">
                    Contraseña
                  </Label>
                  <Input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="border-slate-700 bg-slate-800 text-slate-200"
                  />
                </div>

                <div className="flex flex-col gap-2">
                  <Button
                    type="submit"
                    disabled={loading || !email || !password}
                    className="w-full h-11 bg-blue-600 hover:bg-blue-700"
                  >
                    {loading ? (
                      <IconLoader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : null}
                    Iniciar sesión
                  </Button>

                  <Button
                    type="button"
                    onClick={handleSignUp}
                    disabled={loading || !email || !password}
                    variant="ghost"
                    className="w-full text-slate-400 hover:text-white text-sm"
                  >
                    ¿No tenés cuenta? Registrate
                  </Button>
                </div>
              </form>

              <Button
                type="button"
                onClick={() => {
                  setLoginMode("select");
                  setEmailError(null);
                }}
                variant="ghost"
                className="w-full text-slate-500 hover:text-slate-300 text-sm"
              >
                ← Volver a opciones de inicio de sesión
              </Button>
            </>
          )}
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
