-- BNNY LABS - Schema v5 (Phase 7a — Clients 2.0 foundation)
-- Idempotente — seguro re-executar
--
-- O que muda:
--   • clients ganha: status, tags, is_starred, archived_at (soft delete),
--     portal_slug (reservado Fase 9), last_activity_at, preferred_channel,
--     e 8 colunas de redes sociais (populadas automaticamente pelo scraper de IA)
--   • Nova tabela client_contacts — substitui o campo único clients.email/phone
--     com suporte a N contatos por cliente, idioma por contato, cópias e portal
--   • Nova tabela client_notes — notas append-only com suporte a pinned
--   • Migration automática: clients existentes → client_contacts (is_primary=true)
--
-- ATENÇÃO: rodar este script cria os dados de migração automaticamente.
-- É seguro rodar em produção com dados existentes.

-- ─── clients — novas colunas ──────────────────────────────────────────────

ALTER TABLE clients ADD COLUMN IF NOT EXISTS
  status TEXT NOT NULL DEFAULT 'active'
  CHECK (status IN ('lead','active','recurring','paused','archived'));

ALTER TABLE clients ADD COLUMN IF NOT EXISTS tags TEXT[] DEFAULT '{}';
ALTER TABLE clients ADD COLUMN IF NOT EXISTS is_starred BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS portal_slug TEXT UNIQUE;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS last_activity_at TIMESTAMPTZ;

ALTER TABLE clients ADD COLUMN IF NOT EXISTS
  preferred_channel TEXT NOT NULL DEFAULT 'email'
  CHECK (preferred_channel IN ('email','whatsapp','both'));

-- Redes sociais da empresa (não do contato — essas ficam em client_contacts)
ALTER TABLE clients ADD COLUMN IF NOT EXISTS social_instagram TEXT;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS social_linkedin  TEXT;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS social_facebook  TEXT;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS social_youtube   TEXT;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS social_tiktok    TEXT;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS social_twitter   TEXT;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS social_pinterest TEXT;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS social_other     TEXT;

-- ─── client_contacts ──────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS client_contacts (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id      UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  name           TEXT NOT NULL,
  email          TEXT,
  role           TEXT,
  language       TEXT NOT NULL DEFAULT 'pt-BR'
                 CHECK (language IN ('pt-BR','en-US')),
  is_primary     BOOLEAN NOT NULL DEFAULT FALSE,
  receives_copies BOOLEAN NOT NULL DEFAULT FALSE,
  whatsapp       TEXT,
  linkedin_url   TEXT,
  -- Reservado para Fase 9 (portal do cliente): não expor na UI ainda
  portal_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE client_contacts DISABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_client_contacts_client_id ON client_contacts(client_id);
CREATE INDEX IF NOT EXISTS idx_client_contacts_email      ON client_contacts(email);

-- ─── client_notes ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS client_notes (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id     UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  body_markdown TEXT NOT NULL,
  is_pinned     BOOLEAN NOT NULL DEFAULT FALSE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE client_notes DISABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_client_notes_client_id ON client_notes(client_id);

-- ─── Índices de suporte aos novos filtros da lista ────────────────────────

CREATE INDEX IF NOT EXISTS idx_clients_status      ON clients(status);
CREATE INDEX IF NOT EXISTS idx_clients_is_starred  ON clients(is_starred);
CREATE INDEX IF NOT EXISTS idx_clients_archived_at ON clients(archived_at);

-- ─── Migration automática: contatos existentes → client_contacts ──────────
--
-- Cada cliente existente (com email) ganha um contact primário migrando
-- os campos name/email/phone que já existem em clients. Idempotente:
-- ON CONFLICT DO NOTHING garante que re-executar não duplica.
-- A constraint UNIQUE (client_id, email) abaixo torna isso seguro.

ALTER TABLE client_contacts
  ADD CONSTRAINT uq_client_contacts_client_email
  UNIQUE (client_id, email);

-- Cria o contato primário a partir dos dados legados
INSERT INTO client_contacts (client_id, name, email, whatsapp, is_primary, language)
SELECT
  id,
  name,
  email,
  phone,
  TRUE,
  'pt-BR'
FROM clients
WHERE email IS NOT NULL AND email <> ''
ON CONFLICT (client_id, email) DO NOTHING;
