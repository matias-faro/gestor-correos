import { NextRequest, NextResponse } from "next/server";
import { requireApiAuth } from "@/server/auth/api";
import {
  getEmailAccountWithPassword,
  markEmailAccountVerified,
} from "@/server/integrations/db/email-accounts-repo";
import { verifySmtpConnection } from "@/server/integrations/email/smtp-sender";
import { verifyImapConnection } from "@/server/integrations/email/imap-bounce-scanner";

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/email-accounts/[id]/verify — Verificar conexión SMTP + IMAP
// ─────────────────────────────────────────────────────────────────────────────
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireApiAuth();
  if (!auth.success) return auth.response;

  const { id } = await params;

  // Obtener cuenta con password descifrado
  const account = await getEmailAccountWithPassword(id);
  if (!account) {
    return NextResponse.json({ error: "Cuenta no encontrada" }, { status: 404 });
  }
  if (account.userId !== auth.user.id) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  // Para cuentas Google, están automáticamente verificadas
  if (account.provider === "google") {
    return NextResponse.json({
      smtp: { success: true },
      imap: { success: true },
      verified: true,
    });
  }

  // Verificar IMAP/SMTP
  if (!account.smtpHost || !account.smtpPort || !account.imapSmtpUser || !account.imapSmtpPassword) {
    return NextResponse.json(
      { error: "Configuración SMTP incompleta" },
      { status: 400 }
    );
  }

  if (!account.imapHost || !account.imapPort) {
    return NextResponse.json(
      { error: "Configuración IMAP incompleta" },
      { status: 400 }
    );
  }

  try {
    // Verificar SMTP
    const smtpResult = await verifySmtpConnection({
      host: account.smtpHost,
      port: account.smtpPort,
      secure: account.smtpSecure,
      user: account.imapSmtpUser,
      password: account.imapSmtpPassword,
    });

    // Verificar IMAP
    const imapResult = await verifyImapConnection({
      host: account.imapHost,
      port: account.imapPort,
      secure: account.imapSecure,
      user: account.imapSmtpUser,
      password: account.imapSmtpPassword,
    });

    const allOk = smtpResult.success && imapResult.success;

    // Marcar como verificada si ambas conexiones fueron exitosas
    if (allOk) {
      await markEmailAccountVerified(id);
    }

    return NextResponse.json({
      smtp: smtpResult,
      imap: imapResult,
      verified: allOk,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error desconocido";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
