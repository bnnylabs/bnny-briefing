-- BNNY LABS - Schema Update v2
-- Execute no Supabase SQL Editor

-- Tabela de configurações do admin
CREATE TABLE IF NOT EXISTS settings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  key TEXT UNIQUE NOT NULL,
  value TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Inserir configurações padrão
INSERT INTO settings (key, value) VALUES
  ('notification_email', 'gucoelho@me.com'),
  ('notification_whatsapp', ''),
  ('briefing_expiry_days', '30'),
  ('reminder_days', '3'),
  ('admin_password', 'BnnyLabs@2024')
ON CONFLICT (key) DO NOTHING;

-- Coluna de anotações internas nos briefings
ALTER TABLE briefings ADD COLUMN IF NOT EXISTS internal_notes TEXT;

-- Coluna de prazo de validade
ALTER TABLE briefings ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;

-- Coluna de lembrete enviado
ALTER TABLE briefings ADD COLUMN IF NOT EXISTS reminder_sent_at TIMESTAMPTZ;

-- Tabela de log de notificações
CREATE TABLE IF NOT EXISTS notifications (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  briefing_id UUID REFERENCES briefings(id) ON DELETE CASCADE,
  type TEXT NOT NULL, -- 'email_client', 'email_admin', 'whatsapp_admin', 'reminder'
  status TEXT NOT NULL DEFAULT 'sent',
  sent_at TIMESTAMPTZ DEFAULT NOW(),
  details JSONB
);

ALTER TABLE settings DISABLE ROW LEVEL SECURITY;
ALTER TABLE notifications DISABLE ROW LEVEL SECURITY;
