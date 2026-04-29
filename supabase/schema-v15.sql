-- ─────────────────────────────────────────────────────────────────────────
-- schema-v15.sql — Next steps presets library
-- ─────────────────────────────────────────────────────────────────────────
--
-- Mirrors v13 (payment) and v14 (terms). Stores reusable lists of
-- post-approval next steps. items[] is JSONB array of strings,
-- matching BlockContentNextSteps.items in lib/proposal-types.ts.

CREATE TABLE IF NOT EXISTS proposal_next_steps_presets (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name            TEXT NOT NULL,
  description     TEXT,
  type            TEXT,
  is_default      BOOLEAN NOT NULL DEFAULT FALSE,
  items           JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_proposal_next_steps_presets_name
  ON proposal_next_steps_presets (LOWER(name));

CREATE OR REPLACE FUNCTION update_proposal_next_steps_presets_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_proposal_next_steps_presets_updated_at
  ON proposal_next_steps_presets;

CREATE TRIGGER trg_proposal_next_steps_presets_updated_at
  BEFORE UPDATE ON proposal_next_steps_presets
  FOR EACH ROW
  EXECUTE FUNCTION update_proposal_next_steps_presets_updated_at();

ALTER TABLE proposal_next_steps_presets DISABLE ROW LEVEL SECURITY;
