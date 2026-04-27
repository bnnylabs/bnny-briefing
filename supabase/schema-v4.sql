-- BNNY LABS - Schema Update v4 (Phase 5a — editable email templates)
-- Apply this in the Supabase SQL Editor.
-- Idempotent: safe to re-run.
--
-- Stores admin-edited overrides for transactional email templates. A
-- missing row means "use the default", which lives in
-- lib/email-defaults.ts. This avoids duplicating seed copy between
-- SQL and TS, and lets the runtime work even before this migration
-- has been applied — the loader catches the missing-table error and
-- falls back to defaults.
--
-- The (type, language) pair is the natural key. We don't enforce the
-- enum at the DB level; the app-side TemplateType union is the source
-- of truth, and admins can't insert ad-hoc rows since the editor UI
-- only writes the known types.

CREATE TABLE IF NOT EXISTS email_templates (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type          TEXT NOT NULL,
  language      TEXT NOT NULL,
  subject       TEXT NOT NULL,
  preheader     TEXT NOT NULL DEFAULT '',
  title         TEXT NOT NULL,
  body_markdown TEXT NOT NULL,
  cta_text      TEXT NOT NULL DEFAULT '',
  enabled       BOOLEAN NOT NULL DEFAULT TRUE,
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (type, language)
);

ALTER TABLE email_templates DISABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_email_templates_lookup
  ON email_templates (type, language);
