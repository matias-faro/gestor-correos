import { NextRequest, NextResponse } from "next/server";
import { requireApiAuth } from "@/server/auth/api";
import {
  getEmailAccountsByUserId,
  createImapSmtpAccount,
} from "@/server/integrations/db/email-accounts-repo";
import { z } from "zod/v4";

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/email-accounts — Listar cuentas del usuario
// ─────────────────────────────────────────────────────────────────────────────
export async function GET() {
  const auth = await requireApiAuth();
  if (!auth.success) return auth.response;

  try {
    const accounts = await getEmailAccountsByUserId(auth.user.id);

    // No exponer passwords ni datos internos sensibles
    const safeAccounts = accounts.map((a) => ({
      id: a.id,
      provider: a.provider,
      label: a.label,
      email: a.email,
      smtpHost: a.smtpHost,
      smtpPort: a.smtpPort,
      smtpSecure: a.smtpSecure,
      imapHost: a.imapHost,
      imapPort: a.imapPort,
      imapSecure: a.imapSecure,
      imapSmtpUser: a.imapSmtpUser,
      googleAccountId: a.googleAccountId,
      verified: a.verified,
      lastVerifiedAt: a.lastVerifiedAt,
      createdAt: a.createdAt,
      updatedAt: a.updatedAt,
    }));

    return NextResponse.json({ accounts: safeAccounts });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error desconocido";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/email-accounts — Crear cuenta IMAP/SMTP
// ─────────────────────────────────────────────────────────────────────────────
const createAccountSchema = z.object({
  label: z.string().min(1, "El nombre es obligatorio").max(200),
  email: z.string().email("Email inválido"),
  smtpHost: z.string().min(1, "SMTP host es obligatorio"),
  smtpPort: z.number().int().min(1).max(65535),
  smtpSecure: z.boolean(),
  imapHost: z.string().min(1, "IMAP host es obligatorio"),
  imapPort: z.number().int().min(1).max(65535),
  imapSecure: z.boolean(),
  imapSmtpUser: z.string().min(1, "Usuario es obligatorio"),
  imapSmtpPassword: z.string().min(1, "Contraseña es obligatoria"),
});

export async function POST(request: NextRequest) {
  const auth = await requireApiAuth();
  if (!auth.success) return auth.response;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const parsed = createAccountSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Datos inválidos", details: parsed.error.format() },
      { status: 400 }
    );
  }

  try {
    const account = await createImapSmtpAccount({
      userId: auth.user.id,
      ...parsed.data,
    });

    return NextResponse.json({
      id: account.id,
      provider: account.provider,
      label: account.label,
      email: account.email,
      smtpHost: account.smtpHost,
      smtpPort: account.smtpPort,
      smtpSecure: account.smtpSecure,
      imapHost: account.imapHost,
      imapPort: account.imapPort,
      imapSecure: account.imapSecure,
      imapSmtpUser: account.imapSmtpUser,
      googleAccountId: account.googleAccountId,
      verified: account.verified,
      lastVerifiedAt: account.lastVerifiedAt,
      createdAt: account.createdAt,
      updatedAt: account.updatedAt,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error desconocido";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
