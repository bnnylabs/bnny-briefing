-- BNNY LABS - Schema Update v3 (Phase 2.1)
-- Adds the users table — foundation for Phase 2.1's per-user profile pill
-- and the eventual multi-user RBAC (Phase 4).
--
-- Apply this in the Supabase SQL Editor.
-- Idempotent: safe to re-run.

CREATE TABLE IF NOT EXISTS users (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email       TEXT UNIQUE NOT NULL,
  name        TEXT NOT NULL,
  -- Roles for the future RBAC. The whole app is admin-only today;
  -- new accounts will start as 'viewer' once Phase 4 ships login.
  role        TEXT NOT NULL DEFAULT 'viewer'
              CHECK (role IN ('admin', 'editor', 'viewer')),
  photo_url   TEXT,
  job_title   TEXT,                       -- "Admin", "Designer", etc — display only
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Seed the founding admin account
INSERT INTO users (email, name, role, job_title)
VALUES ('gucoelho@me.com', 'Gustavo Coelho', 'admin', 'Admin')
ON CONFLICT (email) DO NOTHING;

ALTER TABLE users DISABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_users_email ON users (email);
