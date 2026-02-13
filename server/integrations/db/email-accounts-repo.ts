import { createServiceClient } from "@/lib/supabase/server";
import { encryptCredential, decryptCredential } from "@/server/domain/crypto";

// ─────────────────────────────────────────────────────────────────────────────
// Tipos
// ─────────────────────────────────────────────────────────────────────────────
export type EmailProviderType = "google" | "imap_smtp";

export type EmailAccount = {
  id: string;
  userId: string;
  provider: EmailProviderType;
  label: string;
  email: string;

  // IMAP/SMTP fields (null for Google)
  smtpHost: string | null;
  smtpPort: number | null;
  smtpSecure: boolean;
  imapHost: string | null;
  imapPort: number | null;
  imapSecure: boolean;
  imapSmtpUser: string | null;
  // Password se descifra solo cuando se necesita (ver getEmailAccountWithPassword)

  // Google reference
  googleAccountId: string | null;

  // Verification
  verified: boolean;
  lastVerifiedAt: string | null;

  createdAt: string;
  updatedAt: string;
};

/** EmailAccount con password descifrado — SOLO para uso interno del servidor */
export type EmailAccountWithPassword = EmailAccount & {
  imapSmtpPassword: string | null;
};

type DbEmailAccount = {
  id: string;
  user_id: string;
  provider: EmailProviderType;
  label: string;
  email: string;
  smtp_host: string | null;
  smtp_port: number | null;
  smtp_secure: boolean;
  imap_host: string | null;
  imap_port: number | null;
  imap_secure: boolean;
  imap_smtp_user: string | null;
  imap_smtp_password_encrypted: string | null;
  google_account_id: string | null;
  verified: boolean;
  last_verified_at: string | null;
  created_at: string;
  updated_at: string;
};

// ─────────────────────────────────────────────────────────────────────────────
// Mapear DB a respuesta
// ─────────────────────────────────────────────────────────────────────────────
function mapEmailAccount(data: DbEmailAccount): EmailAccount {
  return {
    id: data.id,
    userId: data.user_id,
    provider: data.provider,
    label: data.label,
    email: data.email,
    smtpHost: data.smtp_host,
    smtpPort: data.smtp_port,
    smtpSecure: data.smtp_secure,
    imapHost: data.imap_host,
    imapPort: data.imap_port,
    imapSecure: data.imap_secure,
    imapSmtpUser: data.imap_smtp_user,
    googleAccountId: data.google_account_id,
    verified: data.verified,
    lastVerifiedAt: data.last_verified_at,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
  };
}

function mapEmailAccountWithPassword(data: DbEmailAccount): EmailAccountWithPassword {
  const account = mapEmailAccount(data);
  let password: string | null = null;

  if (data.imap_smtp_password_encrypted) {
    try {
      password = decryptCredential(data.imap_smtp_password_encrypted);
    } catch (err) {
      console.error(
        `[email-accounts-repo] Error al descifrar password para cuenta ${data.id}:`,
        err instanceof Error ? err.message : err
      );
    }
  }

  return { ...account, imapSmtpPassword: password };
}

// ─────────────────────────────────────────────────────────────────────────────
// Obtener cuenta por ID (sin password)
// ─────────────────────────────────────────────────────────────────────────────
export async function getEmailAccountById(
  id: string
): Promise<EmailAccount | null> {
  const supabase = await createServiceClient();

  const { data, error } = await supabase
    .from("email_accounts")
    .select("*")
    .eq("id", id)
    .single();

  if (error) {
    if (error.code === "PGRST116") return null;
    throw new Error(`Error al obtener cuenta de email: ${error.message}`);
  }

  return mapEmailAccount(data as DbEmailAccount);
}

// ─────────────────────────────────────────────────────────────────────────────
// Obtener cuenta por ID con password descifrado (SOLO uso interno)
// ─────────────────────────────────────────────────────────────────────────────
export async function getEmailAccountWithPassword(
  id: string
): Promise<EmailAccountWithPassword | null> {
  const supabase = await createServiceClient();

  const { data, error } = await supabase
    .from("email_accounts")
    .select("*")
    .eq("id", id)
    .single();

  if (error) {
    if (error.code === "PGRST116") return null;
    throw new Error(`Error al obtener cuenta de email: ${error.message}`);
  }

  return mapEmailAccountWithPassword(data as DbEmailAccount);
}

// ─────────────────────────────────────────────────────────────────────────────
// Listar cuentas de un usuario
// ─────────────────────────────────────────────────────────────────────────────
export async function getEmailAccountsByUserId(
  userId: string
): Promise<EmailAccount[]> {
  const supabase = await createServiceClient();

  const { data, error } = await supabase
    .from("email_accounts")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: true });

  if (error) {
    throw new Error(`Error al listar cuentas de email: ${error.message}`);
  }

  return (data ?? []).map((row) => mapEmailAccount(row as DbEmailAccount));
}

// ─────────────────────────────────────────────────────────────────────────────
// Obtener cuenta de email por defecto para un usuario (primera creada)
// ─────────────────────────────────────────────────────────────────────────────
export async function getDefaultEmailAccountForUser(
  userId: string
): Promise<EmailAccount | null> {
  const supabase = await createServiceClient();

  const { data, error } = await supabase
    .from("email_accounts")
    .select("*")
    .eq("user_id", userId)
    .eq("verified", true)
    .order("created_at", { ascending: true })
    .limit(1)
    .single();

  if (error) {
    if (error.code === "PGRST116") return null;
    throw new Error(`Error al obtener cuenta de email por defecto: ${error.message}`);
  }

  return mapEmailAccount(data as DbEmailAccount);
}

// ─────────────────────────────────────────────────────────────────────────────
// Obtener email account por google_account_id
// ─────────────────────────────────────────────────────────────────────────────
export async function getEmailAccountByGoogleAccountId(
  googleAccountId: string
): Promise<EmailAccount | null> {
  const supabase = await createServiceClient();

  const { data, error } = await supabase
    .from("email_accounts")
    .select("*")
    .eq("google_account_id", googleAccountId)
    .single();

  if (error) {
    if (error.code === "PGRST116") return null;
    throw new Error(`Error al obtener cuenta de email por Google ID: ${error.message}`);
  }

  return mapEmailAccount(data as DbEmailAccount);
}

// ─────────────────────────────────────────────────────────────────────────────
// Crear cuenta IMAP/SMTP
// ─────────────────────────────────────────────────────────────────────────────
export type CreateImapSmtpAccountInput = {
  userId: string;
  label: string;
  email: string;
  smtpHost: string;
  smtpPort: number;
  smtpSecure: boolean;
  imapHost: string;
  imapPort: number;
  imapSecure: boolean;
  imapSmtpUser: string;
  imapSmtpPassword: string;
};

export async function createImapSmtpAccount(
  input: CreateImapSmtpAccountInput
): Promise<EmailAccount> {
  const supabase = await createServiceClient();

  const encryptedPassword = encryptCredential(input.imapSmtpPassword);

  const { data, error } = await supabase
    .from("email_accounts")
    .insert({
      user_id: input.userId,
      provider: "imap_smtp",
      label: input.label,
      email: input.email,
      smtp_host: input.smtpHost,
      smtp_port: input.smtpPort,
      smtp_secure: input.smtpSecure,
      imap_host: input.imapHost,
      imap_port: input.imapPort,
      imap_secure: input.imapSecure,
      imap_smtp_user: input.imapSmtpUser,
      imap_smtp_password_encrypted: encryptedPassword,
      google_account_id: null,
      verified: false,
    })
    .select("*")
    .single();

  if (error) {
    throw new Error(`Error al crear cuenta de email: ${error.message}`);
  }

  return mapEmailAccount(data as DbEmailAccount);
}

// ─────────────────────────────────────────────────────────────────────────────
// Crear cuenta Google (llamado desde auth callback)
// ─────────────────────────────────────────────────────────────────────────────
export async function createGoogleEmailAccount(input: {
  userId: string;
  email: string;
  googleAccountId: string;
}): Promise<EmailAccount> {
  const supabase = await createServiceClient();

  const { data, error } = await supabase
    .from("email_accounts")
    .insert({
      user_id: input.userId,
      provider: "google",
      label: `Gmail - ${input.email}`,
      email: input.email,
      google_account_id: input.googleAccountId,
      verified: true,
    })
    .select("*")
    .single();

  if (error) {
    throw new Error(`Error al crear cuenta de email Google: ${error.message}`);
  }

  return mapEmailAccount(data as DbEmailAccount);
}

// ─────────────────────────────────────────────────────────────────────────────
// Actualizar cuenta IMAP/SMTP
// ─────────────────────────────────────────────────────────────────────────────
export type UpdateImapSmtpAccountInput = Partial<{
  label: string;
  email: string;
  smtpHost: string;
  smtpPort: number;
  smtpSecure: boolean;
  imapHost: string;
  imapPort: number;
  imapSecure: boolean;
  imapSmtpUser: string;
  imapSmtpPassword: string;
}>;

export async function updateImapSmtpAccount(
  id: string,
  input: UpdateImapSmtpAccountInput
): Promise<EmailAccount> {
  const supabase = await createServiceClient();

  const updateData: Record<string, unknown> = {};

  if (input.label !== undefined) updateData.label = input.label;
  if (input.email !== undefined) updateData.email = input.email;
  if (input.smtpHost !== undefined) updateData.smtp_host = input.smtpHost;
  if (input.smtpPort !== undefined) updateData.smtp_port = input.smtpPort;
  if (input.smtpSecure !== undefined) updateData.smtp_secure = input.smtpSecure;
  if (input.imapHost !== undefined) updateData.imap_host = input.imapHost;
  if (input.imapPort !== undefined) updateData.imap_port = input.imapPort;
  if (input.imapSecure !== undefined) updateData.imap_secure = input.imapSecure;
  if (input.imapSmtpUser !== undefined) updateData.imap_smtp_user = input.imapSmtpUser;
  if (input.imapSmtpPassword !== undefined) {
    updateData.imap_smtp_password_encrypted = encryptCredential(input.imapSmtpPassword);
  }

  // If credentials changed, mark as unverified
  const credentialFields = ["smtpHost", "smtpPort", "smtpSecure", "imapHost", "imapPort", "imapSecure", "imapSmtpUser", "imapSmtpPassword"];
  const credentialChanged = credentialFields.some((f) => input[f as keyof UpdateImapSmtpAccountInput] !== undefined);
  if (credentialChanged) {
    updateData.verified = false;
    updateData.last_verified_at = null;
  }

  const { data, error } = await supabase
    .from("email_accounts")
    .update(updateData)
    .eq("id", id)
    .select("*")
    .single();

  if (error) {
    throw new Error(`Error al actualizar cuenta de email: ${error.message}`);
  }

  return mapEmailAccount(data as DbEmailAccount);
}

// ─────────────────────────────────────────────────────────────────────────────
// Eliminar cuenta
// ─────────────────────────────────────────────────────────────────────────────
export async function deleteEmailAccount(id: string): Promise<void> {
  const supabase = await createServiceClient();

  const { error } = await supabase
    .from("email_accounts")
    .delete()
    .eq("id", id);

  if (error) {
    throw new Error(`Error al eliminar cuenta de email: ${error.message}`);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Marcar como verificada
// ─────────────────────────────────────────────────────────────────────────────
export async function markEmailAccountVerified(id: string): Promise<void> {
  const supabase = await createServiceClient();

  const { error } = await supabase
    .from("email_accounts")
    .update({
      verified: true,
      last_verified_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (error) {
    throw new Error(`Error al marcar cuenta como verificada: ${error.message}`);
  }
}
