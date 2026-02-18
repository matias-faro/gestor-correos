-- ============================================
-- Migración: keywords de exclusión para snapshot
-- Fecha: 2026-02-18
-- ============================================

ALTER TABLE settings
ADD COLUMN IF NOT EXISTS exclude_keywords TEXT[] NOT NULL DEFAULT '{}';
