-- schema-v6.sql
-- Adds avatar_url to clients (company logo) and client_contacts (personal photo).
-- Run in Supabase SQL editor after schema-v5.sql has been applied.
-- Safe to run multiple times (uses ADD COLUMN IF NOT EXISTS).

ALTER TABLE clients
  ADD COLUMN IF NOT EXISTS avatar_url TEXT;

ALTER TABLE client_contacts
  ADD COLUMN IF NOT EXISTS avatar_url TEXT;
