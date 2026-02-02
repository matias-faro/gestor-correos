-- Mejoras: deduplicar fuentes y ampliar estado de sync

-- ============================================
-- 1) Campos de observabilidad de sync
-- ============================================
ALTER TABLE contact_sources
ADD COLUMN IF NOT EXISTS last_sync_started_at TIMESTAMPTZ;

ALTER TABLE contact_sources
ADD COLUMN IF NOT EXISTS last_sync_processed INTEGER NOT NULL DEFAULT 0;

ALTER TABLE contact_sources
ADD COLUMN IF NOT EXISTS last_sync_skipped INTEGER NOT NULL DEFAULT 0;

ALTER TABLE contact_sources
ADD COLUMN IF NOT EXISTS last_sync_last_row INTEGER;

ALTER TABLE contact_sources
ADD COLUMN IF NOT EXISTS last_sync_removed_memberships INTEGER NOT NULL DEFAULT 0;

ALTER TABLE contact_sources
ADD COLUMN IF NOT EXISTS last_sync_deleted_contacts INTEGER NOT NULL DEFAULT 0;

-- ============================================
-- 2) Deduplicar fuentes existentes
-- ============================================
WITH ranked AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY spreadsheet_id, sheet_tab, google_account_id
      ORDER BY created_at DESC
    ) AS rn
  FROM contact_sources
)
DELETE FROM contact_sources
WHERE id IN (SELECT id FROM ranked WHERE rn > 1);

-- ============================================
-- 3) Evitar duplicados futuros
-- ============================================
CREATE UNIQUE INDEX IF NOT EXISTS ux_contact_sources_spreadsheet_tab_account
ON contact_sources (spreadsheet_id, sheet_tab, google_account_id);
