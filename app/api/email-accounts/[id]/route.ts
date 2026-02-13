import { NextRequest, NextResponse } from "next/server";
import { requireApiAuth } from "@/server/auth/api";
import {
  getEmailAccountById,
  updateImapSmtpAccount,
  deleteEmailAccount,
} from "@/server/integrations/db/email-accounts-repo";
import { z } from "zod/v4";

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /api/email-accounts/[id] — Actualizar cuenta IMAP/SMTP
// ─────────────────────────────────────────────────────────────────────────────
const updateAccountSchema = z.object({
  label: z.string().min(1).max(200).optional(),
  email: z.string().email().optional(),
  smtpHost: z.string().min(1).optional(),
  smtpPort: z.number().int().min(1).max(65535).optional(),
  smtpSecure: z.boolean().optional(),
  imapHost: z.string().min(1).optional(),
  imapPort: z.number().int().min(1).max(65535).optional(),
  imapSecure: z.boolean().optional(),
  imapSmtpUser: z.string().min(1).optional(),
  imapSmtpPassword: z.string().min(1).optional(),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireApiAuth();
  if (!auth.success) return auth.response;

  const { id } = await params;

  // Verificar que la cuenta existe y pertenece al usuario
  const account = await getEmailAccountById(id);
  if (!account) {
    return NextResponse.json({ error: "Cuenta no encontrada" }, { status: 404 });
  }
  if (account.userId !== auth.user.id) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }
  if (account.provider !== "imap_smtp") {
    return NextResponse.json(
      { error: "Solo se pueden editar cuentas IMAP/SMTP" },
      { status: 400 }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const parsed = updateAccountSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Datos inválidos", details: parsed.error.format() },
      { status: 400 }
    );
  }

  try {
    const updated = await updateImapSmtpAccount(id, parsed.data);

    return NextResponse.json({
      id: updated.id,
      provider: updated.provider,
      label: updated.label,
      email: updated.email,
      verified: updated.verified,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error desconocido";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// DELETE /api/email-accounts/[id] — Eliminar cuenta
// ─────────────────────────────────────────────────────────────────────────────
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireApiAuth();
  if (!auth.success) return auth.response;

  const { id } = await params;

  // Verificar que la cuenta existe y pertenece al usuario
  const account = await getEmailAccountById(id);
  if (!account) {
    return NextResponse.json({ error: "Cuenta no encontrada" }, { status: 404 });
  }
  if (account.userId !== auth.user.id) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  try {
    await deleteEmailAccount(id);
    return NextResponse.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error desconocido";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
