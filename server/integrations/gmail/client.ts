import { google } from "googleapis";
import { getGoogleAccountById } from "@/server/integrations/db/google-accounts-repo";
import { getGoogleOAuthClient } from "@/server/integrations/google/oauth";

// ─────────────────────────────────────────────────────────────────────────────
// Obtener cliente Gmail autenticado para una cuenta
// ─────────────────────────────────────────────────────────────────────────────
export async function getGmailClient(googleAccountId: string) {
  const oauth2Client = await getGoogleOAuthClient(googleAccountId);

  return google.gmail({ version: "v1", auth: oauth2Client });
}

// ─────────────────────────────────────────────────────────────────────────────
// Obtener email del remitente para una cuenta
// ─────────────────────────────────────────────────────────────────────────────
export async function getSenderEmail(googleAccountId: string): Promise<string> {
  const account = await getGoogleAccountById(googleAccountId);

  if (!account) {
    throw new Error(`Cuenta de Google no encontrada: ${googleAccountId}`);
  }

  return account.email;
}
