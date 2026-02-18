import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { IconCheck, IconAlertTriangle } from "@tabler/icons-react";
import { unsubscribeByToken, UnsubscribeError } from "@/server/services/UnsubscribeService";

// Forzar render dinámico para cada token (no cachear)
export const dynamic = "force-dynamic";

type UnsubscribePageProps = {
  params: Promise<{
    token: string;
  }>;
};

type UnsubscribeResult =
  | { status: "success"; alreadyUnsubscribed: boolean }
  | { status: "error"; code: "expired_token" | "invalid_token" | "server_error" };

async function processUnsubscribe(token: string): Promise<UnsubscribeResult> {
  try {
    const result = await unsubscribeByToken(token);
    return { status: "success", alreadyUnsubscribed: result.alreadyUnsubscribed };
  } catch (err) {
    if (err instanceof UnsubscribeError) {
      if (err.code === "expired_token") {
        return { status: "error", code: "expired_token" };
      }
      // invalid_token, contact_not_found, token_contact_mismatch → all map to invalid
      return { status: "error", code: "invalid_token" };
    }
    // DB error, etc.
    console.error("[UnsubscribePage] Error inesperado:", err);
    return { status: "error", code: "server_error" };
  }
}

export default async function UnsubscribePage({ params }: UnsubscribePageProps) {
  const { token } = await params;

  // Ejecutar baja en 1 click (server-side)
  const result = await processUnsubscribe(decodeURIComponent(token));

  const isSuccess = result.status === "success";
  const errorMessage =
    result.status === "error"
      ? result.code === "expired_token"
        ? "Este link de baja expiró."
        : result.code === "server_error"
          ? "No pudimos procesar tu solicitud. Probá de nuevo más tarde."
          : "Este link de baja no es válido."
      : null;

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-4">
      <Card className="w-full max-w-md border-slate-700 bg-slate-900/80 backdrop-blur-sm">
        <CardHeader className="text-center space-y-4">
          <div className="mx-auto w-16 h-16 rounded-2xl flex items-center justify-center shadow-lg bg-gradient-to-br from-slate-600 to-slate-700">
            {isSuccess ? (
              <IconCheck className="w-8 h-8 text-emerald-400" stroke={2} />
            ) : (
              <IconAlertTriangle className="w-8 h-8 text-amber-400" stroke={1.5} />
            )}
          </div>
          <div>
            <CardTitle className="text-2xl font-bold text-white">
              {isSuccess ? "¡Listo!" : "Error"}
            </CardTitle>
            <CardDescription className="text-slate-400 mt-2">
              {isSuccess
                ? result.alreadyUnsubscribed
                  ? "Ya estabas dado de baja. No recibirás más correos."
                  : "Tu suscripción ha sido cancelada correctamente."
                : errorMessage}
            </CardDescription>
          </div>
        </CardHeader>

        <CardContent className="space-y-6">
          {isSuccess ? (
            <p className="text-center text-sm text-slate-500">
              No recibirás más correos de nuestra parte. Si esto fue un error,
              contactanos para reactivar tu suscripción.
            </p>
          ) : (
            <p className="text-center text-sm text-slate-500">
              Si creés que esto es un error, contactanos para ayudarte.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
