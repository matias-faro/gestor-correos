-- ============================================
-- Migración: Cuentas de email agnósticas de proveedor
-- Soporta Google (Gmail API) y IMAP/SMTP (Hostinger, etc.)
-- ============================================

-- Enum para tipo de proveedor
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'email_provider_type') THEN
    CREATE TYPE email_provider_type AS ENUM ('google', 'imap_smtp');
  END IF;
END $$;

-- ============================================
-- TABLA: email_accounts
-- Cuentas de email genéricas (Gmail, Hostinger, etc.)
-- ============================================

CREATE TABLE IF NOT EXISTS email_accounts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
  provider email_provider_type NOT NULL,
  label TEXT NOT NULL,
  email TEXT NOT NULL,

  -- Campos para IMAP/SMTP (NULL para provider='google')
  smtp_host TEXT,
  smtp_port INTEGER,
  smtp_secure BOOLEAN DEFAULT TRUE,
  imap_host TEXT,
  imap_port INTEGER,
  imap_secure BOOLEAN DEFAULT TRUE,
  imap_smtp_user TEXT,
  imap_smtp_password_encrypted TEXT,

  -- Referencia a google_accounts (NULL para provider='imap_smtp')
  google_account_id UUID REFERENCES google_accounts(id) ON DELETE SET NULL,

  -- Estado de verificación
  verified BOOLEAN NOT NULL DEFAULT FALSE,
  last_verified_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_email_accounts_user_id ON email_accounts(user_id);
CREATE INDEX IF NOT EXISTS idx_email_accounts_google_account_id ON email_accounts(google_account_id);

-- Trigger para updated_at
CREATE TRIGGER update_email_accounts_updated_at
  BEFORE UPDATE ON email_accounts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- Migrar datos existentes de google_accounts → email_accounts
-- ============================================

INSERT INTO email_accounts (user_id, provider, label, email, google_account_id, verified, created_at, updated_at)
SELECT
  ga.user_id,
  'google'::email_provider_type,
  'Gmail - ' || ga.email,
  ga.email,
  ga.id,
  TRUE,
  ga.created_at,
  ga.updated_at
FROM google_accounts ga
WHERE NOT EXISTS (
  SELECT 1 FROM email_accounts ea WHERE ea.google_account_id = ga.id
);

-- ============================================
-- Agregar email_account_id a campaigns
-- ============================================

ALTER TABLE campaigns
ADD COLUMN IF NOT EXISTS email_account_id UUID REFERENCES email_accounts(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_campaigns_email_account_id
ON campaigns(email_account_id);

-- Migrar datos: campaigns que tenían google_account_id → email_account_id
UPDATE campaigns c
SET email_account_id = ea.id
FROM email_accounts ea
WHERE ea.google_account_id = c.google_account_id
  AND c.google_account_id IS NOT NULL
  AND c.email_account_id IS NULL;

-- ============================================
-- RLS para email_accounts
-- ============================================

ALTER TABLE email_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own email accounts" ON email_accounts
  FOR SELECT TO authenticated USING (user_id = auth.uid());
