import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { IconMailOff, IconCheck } from "@tabler/icons-react";

type UnsubscribePageProps = {
  params: Promise<{
    token: string;
  }>;
  searchParams: Promise<{
    success?: string;
  }>;
};

export default async function UnsubscribePage({ searchParams }: UnsubscribePageProps) {
  const { success } = await searchParams;
  const isSuccess = success === "true";

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-4">
      <Card className="w-full max-w-md border-slate-700 bg-slate-900/80 backdrop-blur-sm">
        <CardHeader className="text-center space-y-4">
          <div className="mx-auto w-16 h-16 rounded-2xl flex items-center justify-center shadow-lg bg-gradient-to-br from-slate-600 to-slate-700">
            {isSuccess ? (
              <IconCheck className="w-8 h-8 text-emerald-400" stroke={2} />
            ) : (
              <IconMailOff className="w-8 h-8 text-slate-300" stroke={1.5} />
            )}
          </div>
          <div>
            <CardTitle className="text-2xl font-bold text-white">
              {isSuccess ? "¡Listo!" : "Cancelar suscripción"}
            </CardTitle>
            <CardDescription className="text-slate-400 mt-2">
              {isSuccess
                ? "Tu suscripción ha sido cancelada correctamente."
                : "¿Estás seguro de que querés cancelar tu suscripción?"}
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
            <form action="/api/unsubscribe" method="POST">
              <Button
                type="submit"
                className="w-full bg-red-600 hover:bg-red-700 text-white"
              >
                Confirmar cancelación
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
