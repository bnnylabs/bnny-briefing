-- BNNY LABS - Briefing System Schema
-- Execute este SQL no Supabase SQL Editor

-- Tabela de clientes
CREATE TABLE IF NOT EXISTS clients (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  company TEXT NOT NULL,
  website TEXT,
  email TEXT NOT NULL,
  phone TEXT,
  analysis JSONB, -- análise gerada pelo Claude
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabela de briefings
CREATE TABLE IF NOT EXISTS briefings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
  slug TEXT UNIQUE NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('identidade', 'social', 'site', 'logo')),
  type_label TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'enviado' CHECK (status IN ('enviado', 'visualizado', 'em_andamento', 'concluido')),
  prefilled_data JSONB DEFAULT '{}', -- dados pré-preenchidos pelo Claude
  created_at TIMESTAMPTZ DEFAULT NOW(),
  viewed_at TIMESTAMPTZ,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ
);

-- Tabela de respostas
CREATE TABLE IF NOT EXISTS responses (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  briefing_id UUID REFERENCES briefings(id) ON DELETE CASCADE,
  answers JSONB NOT NULL DEFAULT '{}',
  responsible_name TEXT,
  responsible_email TEXT,
  responsible_phone TEXT,
  submitted_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_briefings_slug ON briefings(slug);
CREATE INDEX IF NOT EXISTS idx_briefings_client_id ON briefings(client_id);
CREATE INDEX IF NOT EXISTS idx_briefings_status ON briefings(status);

-- Row Level Security (desabilitar para simplificar - usaremos service key no servidor)
ALTER TABLE clients DISABLE ROW LEVEL SECURITY;
ALTER TABLE briefings DISABLE ROW LEVEL SECURITY;
ALTER TABLE responses DISABLE ROW LEVEL SECURITY;
