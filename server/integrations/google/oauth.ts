import { google } from "googleapis";
import type { OAuth2Client } from "google-auth-library";
import {
  getGoogleAccountById,
  updateGoogleAccountTokens,
} from "@/server/integrations/db/google-accounts-repo";

// ─────────────────────────────────────────────────────────────────────────────
// Configuración OAuth
// ─────────────────────────────────────────────────────────────────────────────
function createOAuth2Client(): OAuth2Client {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error(
      "GOOGLE_CLIENT_ID y GOOGLE_CLIENT_SECRET son requeridos para Google APIs"
    );
  }

  return new google.auth.OAuth2(clientId, clientSecret);
}

// ─────────────────────────────────────────────────────────────────────────────
// Obtener cliente OAuth2 con tokens refrescados
// ─────────────────────────────────────────────────────────────────────────────
export async function getGoogleOAuthClient(
  googleAccountId: string
): Promise<OAuth2Client> {
  const account = await getGoogleAccountById(googleAccountId);

  if (!account) {
    throw new Error(`Cuenta de Google no encontrada: ${googleAccountId}`);
  }

  const oauth2Client = createOAuth2Client();

  // Configurar tokens
  oauth2Client.setCredentials({
    refresh_token: account.refreshToken,
    access_token: account.accessToken ?? undefined,
  });

  // Verificar si el token expiró o está por expirar
  const tokenExpiry = account.tokenExpiry ? new Date(account.tokenExpiry) : null;
  const now = new Date();
  const fiveMinutesFromNow = new Date(now.getTime() + 5 * 60 * 1000);

  if (!account.accessToken || !tokenExpiry || tokenExpiry < fiveMinutesFromNow) {
    try {
      const { credentials } = await oauth2Client.refreshAccessToken();

      if (credentials.access_token) {
        await updateGoogleAccountTokens(googleAccountId, {
          accessToken: credentials.access_token,
          tokenExpiry: credentials.expiry_date
            ? new Date(credentials.expiry_date).toISOString()
            : undefined,
        });

        oauth2Client.setCredentials(credentials);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Error desconocido";
      throw new Error(`Error al refrescar token de Google: ${message}`);
    }
  }

  return oauth2Client;
}
