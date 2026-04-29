-- ─────────────────────────────────────────────────────────────────────────
-- schema-v14.sql — Terms presets library
-- ─────────────────────────────────────────────────────────────────────────
--
-- Adds a reusable library of "termos e condições" (terms & conditions)
-- presets, mirroring the proposal_payment_presets pattern from v13.
-- Owner builds 3-5 standard contracts (e.g. "Padrão B2B", "Identidade
-- Visual", "Retainer Mensal") and applies them with one click on
-- templates or proposals.
--
-- Why a separate table from payment presets: the content shape is
-- different (markdown body vs PaymentTerm[] array), the UIs differ
-- (markdown editor vs structured term list), and the lifecycle is
-- naturally distinct. Unifying would be premature abstraction.

CREATE TABLE IF NOT EXISTS proposal_terms_presets (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Display
  name            TEXT NOT NULL,
  description     TEXT,
  type            TEXT,

  -- Default flag — picked automatically when creating new proposals
  -- whose template has no terms block content. App enforces max one
  -- default at a time (no partial unique index — same approach as
  -- proposal_payment_presets).
  is_default      BOOLEAN NOT NULL DEFAULT FALSE,

  -- The actual terms content. Markdown — same shape as
  -- BlockContentTerms.body_markdown in lib/proposal-types.ts.
  body_markdown   TEXT NOT NULL DEFAULT '',

  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_proposal_terms_presets_name
  ON proposal_terms_presets (LOWER(name));

CREATE OR REPLACE FUNCTION update_proposal_terms_presets_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_proposal_terms_presets_updated_at
  ON proposal_terms_presets;

CREATE TRIGGER trg_proposal_terms_presets_updated_at
  BEFORE UPDATE ON proposal_terms_presets
  FOR EACH ROW
  EXECUTE FUNCTION update_proposal_terms_presets_updated_at();

-- Same RLS posture as v13: DISABLED. Service-role-only access via API.
ALTER TABLE proposal_terms_presets DISABLE ROW LEVEL SECURITY;
