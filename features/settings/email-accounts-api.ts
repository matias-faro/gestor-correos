// ─────────────────────────────────────────────────────────────────────────────
// API de cuentas de email (frontend)
// ─────────────────────────────────────────────────────────────────────────────

export type EmailAccountResponse = {
  id: string;
  provider: "google" | "imap_smtp";
  label: string;
  email: string;
  smtpHost: string | null;
  smtpPort: number | null;
  smtpSecure: boolean;
  imapHost: string | null;
  imapPort: number | null;
  imapSecure: boolean;
  imapSmtpUser: string | null;
  googleAccountId: string | null;
  verified: boolean;
  lastVerifiedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type CreateEmailAccountInput = {
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

export type VerifyConnectionResponse = {
  smtp: { success: boolean; error?: string };
  imap: { success: boolean; error?: string };
  verified: boolean;
};

export async function fetchEmailAccounts(): Promise<EmailAccountResponse[]> {
  const res = await fetch("/api/email-accounts");
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error ?? "Error al cargar cuentas de email");
  }
  const data = await res.json();
  return data.accounts;
}

export async function createEmailAccount(
  input: CreateEmailAccountInput
): Promise<EmailAccountResponse> {
  const res = await fetch("/api/email-accounts", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error ?? "Error al crear cuenta de email");
  }
  return res.json();
}

export async function updateEmailAccount(
  id: string,
  input: Partial<CreateEmailAccountInput>
): Promise<EmailAccountResponse> {
  const res = await fetch(`/api/email-accounts/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error ?? "Error al actualizar cuenta de email");
  }
  return res.json();
}

export async function deleteEmailAccount(id: string): Promise<void> {
  const res = await fetch(`/api/email-accounts/${id}`, {
    method: "DELETE",
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error ?? "Error al eliminar cuenta de email");
  }
}

export async function verifyEmailAccount(
  id: string
): Promise<VerifyConnectionResponse> {
  const res = await fetch(`/api/email-accounts/${id}/verify`, {
    method: "POST",
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error ?? "Error al verificar conexión");
  }
  return res.json();
}
