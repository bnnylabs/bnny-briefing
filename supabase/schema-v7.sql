-- schema-v7.sql
-- Adds recipients JSONB to briefings to track exactly who received each send.
-- Stored as: [{ email, name, role: 'primary'|'cc' }]
-- Run in Supabase SQL editor after schema-v6.sql has been applied.

ALTER TABLE briefings
  ADD COLUMN IF NOT EXISTS recipients JSONB DEFAULT '[]';
