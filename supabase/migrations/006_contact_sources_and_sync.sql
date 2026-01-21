-- ============================================
-- Migración: Fuentes de contactos (Google Sheets) + memberships
-- Fecha: 2026-01-20
-- ============================================

-- ============================================
-- TABLA: contact_sources
-- Fuente de contactos (spreadsheet + tab)
-- ============================================

CREATE TABLE IF NOT EXISTS contact_sources (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  spreadsheet_id TEXT NOT NULL,
  sheet_tab TEXT NOT NULL DEFAULT 'Base de datos',
  google_account_id UUID REFERENCES google_accounts(id) ON DELETE SET NULL,
  last_synced_at TIMESTAMPTZ,
  last_sync_status TEXT,
  last_sync_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_contact_sources_spreadsheet_id
ON contact_sources(spreadsheet_id);

CREATE INDEX IF NOT EXISTS idx_contact_sources_google_account_id
ON contact_sources(google_account_id);

-- ============================================
-- TABLA: contact_source_memberships
-- Relación N:M entre contactos y fuentes
-- ============================================

CREATE TABLE IF NOT EXISTS contact_source_memberships (
  source_id UUID NOT NULL REFERENCES contact_sources(id) ON DELETE CASCADE,
  contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (source_id, contact_id)
);

CREATE INDEX IF NOT EXISTS idx_contact_source_memberships_source_last_seen
ON contact_source_memberships(source_id, last_seen_at);

-- ============================================
-- SETTINGS: fuente activa
-- ============================================

ALTER TABLE settings
ADD COLUMN IF NOT EXISTS active_contact_source_id UUID
REFERENCES contact_sources(id) ON DELETE SET NULL;

-- ============================================
-- VIEW: contacts_in_source
-- ============================================

CREATE OR REPLACE VIEW contacts_in_source AS
SELECT
  c.*,
  m.source_id
FROM contacts c
JOIN contact_source_memberships m ON m.contact_id = c.id;

-- ============================================
-- TRIGGER: updated_at en contact_sources
-- ============================================

CREATE TRIGGER update_contact_sources_updated_at
  BEFORE UPDATE ON contact_sources
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- RLS
-- ============================================

ALTER TABLE contact_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE contact_source_memberships ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view contact sources" ON contact_sources
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Users can view contact source memberships" ON contact_source_memberships
  FOR SELECT TO authenticated USING (true);
