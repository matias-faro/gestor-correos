-- Migración: asociar campañas a una cuenta de Gmail específica
-- Permite multi-usuario sin depender de "primera cuenta" en google_accounts

ALTER TABLE campaigns
ADD COLUMN IF NOT EXISTS google_account_id UUID REFERENCES google_accounts(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_campaigns_google_account_id
ON campaigns(google_account_id);

