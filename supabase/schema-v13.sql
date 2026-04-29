-- ─────────────────────────────────────────────────────────────────────────
-- schema-v13.sql — Payment presets library
-- ─────────────────────────────────────────────────────────────────────────
--
-- Adds a reusable library of payment conditions ("presets") that the owner
-- can build once and apply to any template or proposal in one click. Solves
-- the v0.10.83 friction where `payment_terms` lived inline inside each
-- template's `default_payment_terms` JSONB — copying conditions across
-- templates required manual JSON editing.
--
-- Design choices:
--   - Singleton-style ownership: there's no `studio_id` because Bnny
--     Briefing is single-tenant by design. Adding multi-tenancy later
--     means adding a column here + RLS, not restructuring.
--   - `payment_terms` stored as JSONB array using the same shape as
--     proposal_templates.default_payment_terms (PaymentTerm union).
--     Reuses the existing TS types (lib/proposal-types.ts) verbatim.
--   - `is_default` flag (max one true at a time, enforced in app code
--     similar to proposal_templates) — picked automatically when creating
--     a new proposal that doesn't specify presets explicitly.
--   - Soft delete? No. Presets are template-like; if the owner deletes
--     one, the proposals that already applied it keep their inline copy
--     (we'll snapshot at apply-time, not link). That makes deletion
--     low-stakes and removes the need for `archived_at` plumbing.

CREATE TABLE IF NOT EXISTS proposal_payment_presets (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Display
  name            TEXT NOT NULL,
  description     TEXT,

  -- Optional categorization (e.g. "Avulso", "Mensal", "Anual"). Free
  -- text — no FK or enum because the categories evolve over time.
  type            TEXT,

  -- Picked automatically when creating new proposals if true. App code
  -- enforces max one default; SQL doesn't (would need a partial unique
  -- index, more brittle than a transactional update in the API).
  is_default      BOOLEAN NOT NULL DEFAULT FALSE,

  -- The actual payment terms. Same JSONB shape as
  -- proposal_templates.default_payment_terms — TS type PaymentTerm[]
  -- as defined in lib/proposal-types.ts.
  payment_terms   JSONB NOT NULL DEFAULT '[]'::jsonb,

  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- We list presets ordered by name for the UI. Index supports that path
-- without a sort scan, even though the table will likely be small (<50
-- rows for any single studio).
CREATE INDEX IF NOT EXISTS idx_proposal_payment_presets_name
  ON proposal_payment_presets (LOWER(name));

-- updated_at trigger — match the pattern from other tables that already
-- have it (clients.updated_at, etc.). Updates whenever any column is
-- modified, including JSONB content of payment_terms.
CREATE OR REPLACE FUNCTION update_proposal_payment_presets_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_proposal_payment_presets_updated_at
  ON proposal_payment_presets;

CREATE TRIGGER trg_proposal_payment_presets_updated_at
  BEFORE UPDATE ON proposal_payment_presets
  FOR EACH ROW
  EXECUTE FUNCTION update_proposal_payment_presets_updated_at();

-- RLS posture: same as the other admin tables — DISABLE ROW LEVEL
-- SECURITY because the API mediates access via Supabase's service-role
-- key + our auth gate (lib/auth.ts). Public anon key cannot reach this
-- table because the service role bypasses RLS and anon doesn't have
-- INSERT/UPDATE grants on it.
ALTER TABLE proposal_payment_presets DISABLE ROW LEVEL SECURITY;

-- Cleanup note: no seed data. The owner creates their own presets via
-- the UI (or via the AI builder when v0.10.85 ships).
