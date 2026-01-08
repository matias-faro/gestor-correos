-- ============================================
-- Gestor de Correos - Schema Inicial
-- ============================================

-- Extensiones necesarias
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- ENUMS
-- ============================================

CREATE TYPE subscription_status AS ENUM ('active', 'unsubscribed');
CREATE TYPE suppression_status AS ENUM ('none', 'bounced');
CREATE TYPE tag_kind AS ENUM ('tipo', 'rubro');
CREATE TYPE campaign_status AS ENUM ('draft', 'ready', 'sending', 'paused', 'completed', 'cancelled');
CREATE TYPE draft_item_state AS ENUM ('pending', 'sent', 'failed', 'excluded');
CREATE TYPE send_run_status AS ENUM ('running', 'paused', 'completed', 'cancelled');
CREATE TYPE send_event_status AS ENUM ('sent', 'failed');

-- ============================================
-- TABLA: settings
-- Configuración global del sistema (singleton, id=1)
-- ============================================

CREATE TABLE settings (
  id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  timezone TEXT NOT NULL DEFAULT 'America/Argentina/Buenos_Aires',
  daily_quota INTEGER NOT NULL DEFAULT 1490,
  min_delay_seconds INTEGER NOT NULL DEFAULT 30,
  send_windows JSONB NOT NULL DEFAULT '{
    "monday": [{"start": "09:00", "end": "20:00"}],
    "tuesday": [{"start": "09:00", "end": "20:00"}],
    "wednesday": [{"start": "09:00", "end": "20:00"}],
    "thursday": [{"start": "09:00", "end": "20:00"}],
    "friday": [{"start": "09:00", "end": "20:00"}],
    "saturday": [{"start": "09:00", "end": "13:00"}],
    "sunday": [{"start": "09:00", "end": "13:00"}]
  }'::jsonb,
  signature_default_html TEXT,
  allowlist_emails TEXT[] DEFAULT '{}',
  allowlist_domains TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Insertar configuración por defecto
INSERT INTO settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

-- ============================================
-- TABLA: profiles
-- Perfil de usuario vinculado a auth.users
-- ============================================

CREATE TABLE profiles (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  display_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================
-- TABLA: google_accounts
-- Tokens de Gmail por usuario
-- ============================================

CREATE TABLE google_accounts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
  google_sub TEXT,
  email TEXT NOT NULL,
  access_token TEXT,
  refresh_token TEXT NOT NULL,
  token_expiry TIMESTAMPTZ,
  scopes TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_google_accounts_user_id ON google_accounts(user_id);

-- ============================================
-- TABLA: contacts
-- Contactos con campos y estados
-- ============================================

CREATE TABLE contacts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email TEXT NOT NULL UNIQUE,
  first_name TEXT,
  last_name TEXT,
  company TEXT,
  position TEXT,
  extra JSONB DEFAULT '{}',
  subscription_status subscription_status NOT NULL DEFAULT 'active',
  suppression_status suppression_status NOT NULL DEFAULT 'none',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_contacts_email ON contacts(email);
CREATE INDEX idx_contacts_subscription_status ON contacts(subscription_status);
CREATE INDEX idx_contacts_suppression_status ON contacts(suppression_status);
CREATE INDEX idx_contacts_company ON contacts(company);

-- ============================================
-- TABLA: tags
-- Tags libres (tipo/rubro)
-- ============================================

CREATE TABLE tags (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  kind tag_kind NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(kind, name)
);

CREATE INDEX idx_tags_kind ON tags(kind);

-- ============================================
-- TABLA: contact_tags
-- Relación N:M entre contactos y tags
-- ============================================

CREATE TABLE contact_tags (
  contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  tag_id UUID NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  PRIMARY KEY (contact_id, tag_id)
);

CREATE INDEX idx_contact_tags_tag_id ON contact_tags(tag_id);

-- ============================================
-- TABLA: templates
-- Plantillas HTML para campañas
-- ============================================

CREATE TABLE templates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL UNIQUE,
  subject_tpl TEXT NOT NULL,
  html_tpl TEXT NOT NULL,
  created_by UUID REFERENCES profiles(user_id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================
-- TABLA: segments (opcional)
-- Segmentos guardados con filtros
-- ============================================

CREATE TABLE segments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  filters JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================
-- TABLA: campaigns
-- Campañas de email
-- ============================================

CREATE TABLE campaigns (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  status campaign_status NOT NULL DEFAULT 'draft',
  template_id UUID REFERENCES templates(id) ON DELETE SET NULL,
  filters_snapshot JSONB DEFAULT '{}',
  from_alias TEXT,
  signature_html_override TEXT,
  created_by UUID REFERENCES profiles(user_id) ON DELETE SET NULL,
  active_lock BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_campaigns_status ON campaigns(status);
CREATE INDEX idx_campaigns_active_lock ON campaigns(active_lock) WHERE active_lock = TRUE;

-- ============================================
-- TABLA: draft_items
-- Snapshot de emails a enviar por campaña
-- ============================================

CREATE TABLE draft_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
  to_email TEXT NOT NULL,
  rendered_subject TEXT NOT NULL,
  rendered_html TEXT NOT NULL,
  state draft_item_state NOT NULL DEFAULT 'pending',
  included_manually BOOLEAN NOT NULL DEFAULT FALSE,
  excluded_manually BOOLEAN NOT NULL DEFAULT FALSE,
  error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_draft_items_campaign_id ON draft_items(campaign_id);
CREATE INDEX idx_draft_items_state ON draft_items(state);
CREATE INDEX idx_draft_items_pending ON draft_items(campaign_id, state) WHERE state = 'pending';

-- ============================================
-- TABLA: send_runs
-- Ejecuciones de envío de campañas
-- ============================================

CREATE TABLE send_runs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ended_at TIMESTAMPTZ,
  status send_run_status NOT NULL DEFAULT 'running',
  next_tick_at TIMESTAMPTZ
);

CREATE INDEX idx_send_runs_campaign_id ON send_runs(campaign_id);
CREATE INDEX idx_send_runs_status ON send_runs(status);

-- ============================================
-- TABLA: send_events
-- Log de envíos individuales
-- ============================================

CREATE TABLE send_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  draft_item_id UUID NOT NULL REFERENCES draft_items(id) ON DELETE CASCADE,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  gmail_message_id TEXT,
  gmail_thread_id TEXT,
  gmail_permalink TEXT,
  status send_event_status NOT NULL,
  error TEXT
);

CREATE INDEX idx_send_events_campaign_id ON send_events(campaign_id);
CREATE INDEX idx_send_events_sent_at ON send_events(sent_at);

-- ============================================
-- TABLA: bounce_events
-- Rebotes detectados
-- ============================================

CREATE TABLE bounce_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  detected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  google_account_id UUID REFERENCES google_accounts(id) ON DELETE SET NULL,
  bounced_email TEXT NOT NULL,
  reason TEXT,
  gmail_message_id TEXT,
  gmail_permalink TEXT
);

CREATE INDEX idx_bounce_events_bounced_email ON bounce_events(bounced_email);

-- ============================================
-- TABLA: unsubscribe_events
-- Eventos de baja de suscripción
-- ============================================

CREATE TABLE unsubscribe_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  campaign_id UUID REFERENCES campaigns(id) ON DELETE SET NULL,
  token_hash TEXT NOT NULL
);

CREATE INDEX idx_unsubscribe_events_contact_id ON unsubscribe_events(contact_id);

-- ============================================
-- TRIGGERS: updated_at automático
-- ============================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_settings_updated_at
  BEFORE UPDATE ON settings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_google_accounts_updated_at
  BEFORE UPDATE ON google_accounts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_contacts_updated_at
  BEFORE UPDATE ON contacts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_templates_updated_at
  BEFORE UPDATE ON templates
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_segments_updated_at
  BEFORE UPDATE ON segments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_campaigns_updated_at
  BEFORE UPDATE ON campaigns
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_draft_items_updated_at
  BEFORE UPDATE ON draft_items
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- RLS (Row Level Security)
-- Nota: En single-tenant, el Service Role bypasea RLS.
-- Estas políticas son para seguridad adicional.
-- ============================================

ALTER TABLE settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE google_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE contact_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE segments ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE draft_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE send_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE send_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE bounce_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE unsubscribe_events ENABLE ROW LEVEL SECURITY;

-- Políticas básicas para usuarios autenticados (lectura)
-- El Service Role tiene acceso total, estas son para el cliente

CREATE POLICY "Users can view settings" ON settings
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Users can view own profile" ON profiles
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users can view own google accounts" ON google_accounts
  FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE POLICY "Users can view contacts" ON contacts
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Users can view tags" ON tags
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Users can view contact_tags" ON contact_tags
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Users can view templates" ON templates
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Users can view segments" ON segments
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Users can view campaigns" ON campaigns
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Users can view draft_items" ON draft_items
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Users can view send_runs" ON send_runs
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Users can view send_events" ON send_events
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Users can view bounce_events" ON bounce_events
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Users can view unsubscribe_events" ON unsubscribe_events
  FOR SELECT TO authenticated USING (true);
