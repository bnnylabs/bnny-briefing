-- ============================================================================
-- BNNY Briefing System — schema-v11.sql
-- Fase 4 (segurança) - parte 5/5: habilitar Row Level Security.
--
-- Contexto:
--   A app foi construída com RLS desabilitada em todas as tabelas porque
--   100% das queries vão pelo supabaseAdmin client (service key). Funcionou
--   na prática, mas deixou um buraco: a NEXT_PUBLIC_SUPABASE_ANON_KEY é
--   entregue ao browser (é o que NEXT_PUBLIC_* significa). Sem RLS,
--   qualquer um que extraia a anon key do bundle JS pode ler todo o banco
--   direto, inclusive client_contacts (e-mails de clientes), proposals
--   (valores de orçamentos) e responses (respostas de briefing privadas).
--
--   Esta migration habilita RLS em todas as tabelas SEM criar policies pra
--   anon. Resultado: anon role passa a não conseguir fazer NADA. Service
--   role bypassa RLS automaticamente (é como o Postgres trata service_role
--   no PostgREST do Supabase), então supabaseAdmin continua funcionando
--   normalmente.
--
-- Idempotência:
--   ENABLE ROW LEVEL SECURITY é idempotente — rodar 2x não dá erro nem
--   tem efeito colateral. Pode ser rodado com confiança em produção.
--
-- Pra rodar:
--   1. Supabase Dashboard → seu projeto → SQL Editor → New query
--   2. Cole este arquivo inteiro
--   3. Run
--   4. Avise o Claude que rodou — ele vai pushar v0.10.69 com a remoção
--      do anon client export em lib/supabase.ts
--
-- Reverter (se algo quebrar inesperadamente):
--   ALTER TABLE <nome> DISABLE ROW LEVEL SECURITY;
--   pra cada tabela. App volta ao comportamento anterior imediatamente.
-- ============================================================================

-- Lock RLS on every application table. Order doesn't matter — these are
-- independent operations and the service role bypasses all of them.

ALTER TABLE activity_log         ENABLE ROW LEVEL SECURITY;
ALTER TABLE briefings            ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_contacts      ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_notes         ENABLE ROW LEVEL SECURITY;
ALTER TABLE clients              ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_templates      ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications        ENABLE ROW LEVEL SECURITY;
ALTER TABLE proposal_activity    ENABLE ROW LEVEL SECURITY;
ALTER TABLE proposal_blocks      ENABLE ROW LEVEL SECURITY;
ALTER TABLE proposal_items       ENABLE ROW LEVEL SECURITY;
ALTER TABLE proposal_templates   ENABLE ROW LEVEL SECURITY;
ALTER TABLE proposals            ENABLE ROW LEVEL SECURITY;
ALTER TABLE responses            ENABLE ROW LEVEL SECURITY;
ALTER TABLE settings             ENABLE ROW LEVEL SECURITY;
ALTER TABLE users                ENABLE ROW LEVEL SECURITY;

-- Sanity check: list all tables with RLS status. The query below should
-- show rowsecurity=true for every row in the result. Useful to copy into
-- the SQL Editor as a follow-up to confirm the migration took effect.
--
-- SELECT tablename, rowsecurity
-- FROM pg_tables
-- WHERE schemaname = 'public'
-- ORDER BY tablename;
