-- BNNY LABS - Schema completo v2.3
-- Idempotente — seguro re-executar
--
-- Snapshot do estado real aplicado em produção. Inclui as colunas e
-- tabelas que foram acumulando ao longo das v2.x (editing_hours,
-- language em briefings, editing_locked/expires_at/update_count,
-- contacts JSONB em clients, activity_log) — consolidadas aqui pra
-- que rodar este arquivo do zero deixe o banco no mesmo estado da
-- produção atual.

-- Configurações do admin
CREATE TABLE IF NOT EXISTS settings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  key TEXT UNIQUE NOT NULL,
  value TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO settings (key, value) VALUES
  ('notification_email', 'gucoelho@me.com'),
  ('notification_whatsapp', ''),
  ('briefing_expiry_days', '30'),
  ('reminder_days', '3'),
  ('admin_password', 'BnnyLabs@2024'),
  ('editing_hours', '48')
ON CONFLICT (key) DO NOTHING;

-- Colunas nos briefings
ALTER TABLE briefings ADD COLUMN IF NOT EXISTS internal_notes TEXT;
ALTER TABLE briefings ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;
ALTER TABLE briefings ADD COLUMN IF NOT EXISTS reminder_sent_at TIMESTAMPTZ;
ALTER TABLE briefings ADD COLUMN IF NOT EXISTS language TEXT DEFAULT 'pt-BR';

-- Novas colunas v2.3
ALTER TABLE briefings ADD COLUMN IF NOT EXISTS editing_locked BOOLEAN DEFAULT false;
ALTER TABLE briefings ADD COLUMN IF NOT EXISTS editing_expires_at TIMESTAMPTZ;
ALTER TABLE briefings ADD COLUMN IF NOT EXISTS update_count INT DEFAULT 0;

-- Contatos múltiplos por cliente
ALTER TABLE clients ADD COLUMN IF NOT EXISTS contacts JSONB DEFAULT '[]';

-- Log de notificações
CREATE TABLE IF NOT EXISTS notifications (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  briefing_id UUID REFERENCES briefings(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'sent',
  sent_at TIMESTAMPTZ DEFAULT NOW(),
  details JSONB
);

-- Log de atividades
CREATE TABLE IF NOT EXISTS activity_log (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  action TEXT NOT NULL,
  details JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Desabilitar RLS
ALTER TABLE settings DISABLE ROW LEVEL SECURITY;
ALTER TABLE notifications DISABLE ROW LEVEL SECURITY;
ALTER TABLE activity_log DISABLE ROW LEVEL SECURITY;
