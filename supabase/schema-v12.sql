-- ============================================================================
-- BNNY Briefing System — schema-v12.sql
-- Fase B do plano mestre (3d original): identidade do estúdio editável.
--
-- Contexto:
--   Hoje, telefone, e-mail e nome do estúdio estão hardcoded no código
--   (ex: app/p/[slug]/page.tsx linha 122 tem "+55 47 98844 8858" e
--   linha 130 tem "gustavo@bnnylabs.com"). Mudar qualquer um desses
--   valores exige alterar código e fazer redeploy. Não escala —
--   muda telefone uma vez, eu já me embaralho com onde mexer.
--
--   Esta migration cria uma tabela singleton (1 row apenas) com todos
--   os dados editáveis do estúdio, e a aba "Estúdio" no Centro de
--   Configurações vai ser o lugar único pra editar tudo isso.
--
--   A página pública /p/[slug] vai ler dessa tabela e renderizar o
--   footer dinamicamente. Outros lugares que tinham hardcoded vão
--   migrar gradualmente (PDFs de briefing, emails, etc) — esta
--   migration só cobre o necessário pra v0.10.74.
--
-- Por que é singleton:
--   Bnny é um único estúdio. Se um dia virar plataforma multi-tenant,
--   isso vira tabela com FK pro tenant. Por enquanto, 1 row é suficiente
--   e simplifica todo o resto do código (não precisa SELECT WHERE id =
--   <algum>; é sempre o mesmo SELECT).
--
-- Idempotência:
--   - CREATE TABLE IF NOT EXISTS: rodar 2x não dá erro
--   - INSERT ON CONFLICT DO NOTHING: se a row já existe, não sobrescreve
--   - ENABLE ROW LEVEL SECURITY: idempotente
--
-- Pra rodar:
--   1. Supabase Dashboard → SQL Editor → New query
--   2. Cole este arquivo inteiro
--   3. Run
--   4. Avise o Claude que rodou — ele vai pushar v0.10.74 com o código
-- ============================================================================

CREATE TABLE IF NOT EXISTS studio_identity (
  -- Singleton PK. Vamos sempre usar 'default' como id. Se um dia precisarmos
  -- de múltiplos, basta dropar a CHECK constraint e adicionar novos rows.
  id TEXT PRIMARY KEY DEFAULT 'default' CHECK (id = 'default'),

  -- Nome principal exibido em headers, footers, emails. Ex: "Bnny Labs".
  studio_name TEXT NOT NULL DEFAULT 'Bnny Labs',

  -- Tagline curta (1 linha) opcional. Ex: "Estúdio criativo de Blumenau".
  tagline TEXT,

  -- Contato principal — vai pro footer da página pública e pra emails.
  email_contact TEXT NOT NULL DEFAULT 'gustavo@bnnylabs.com',
  phone_contact TEXT,
  whatsapp_contact TEXT,  -- separado do telefone (link wa.me/ pode diferir)

  -- Site público do estúdio (pra logo clicável, etc).
  website TEXT DEFAULT 'https://bnnylabs.com',

  -- Endereço (opcional — vai pro footer formatado se preenchido).
  address TEXT,
  city TEXT,
  state TEXT,
  country TEXT DEFAULT 'Brasil',

  -- Documento fiscal (opcional — relevante pra propostas formais).
  cnpj TEXT,

  -- Social links como JSONB. Estrutura esperada:
  --   { "instagram": "https://...", "linkedin": "https://...", ... }
  -- Mantido flexível pra adicionar/remover redes sem schema novo.
  social_links JSONB DEFAULT '{}'::jsonb,

  -- Texto livre pra footer da proposta pública (markdown). Permite frases
  -- tipo "Este orçamento é uma estimativa baseada no escopo discutido. Mudanças
  -- podem afetar valor e prazo." Owner pode editar quando quiser.
  footer_disclaimer TEXT,

  -- Voz/manifesto do estúdio — texto que vai pro contexto da IA quando
  -- ela personalizar propostas. Diferente do anti-cliché (que é genérico
  -- pra Bnny); aqui é o que TORNA Bnny diferente. Ex: "Cobramos por
  -- valor entregue, não por hora trabalhada. Recusamos projetos que não
  -- entendemos. Falamos direto, sem inflar."
  voice_manifesto TEXT,

  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Habilitar RLS (consistente com schema-v11). Service role bypassa.
ALTER TABLE studio_identity ENABLE ROW LEVEL SECURITY;

-- Insere a única row se ainda não existe. Usa DEFAULTs definidos acima
-- — os valores reais ("Bnny Labs", "gustavo@bnnylabs.com", etc) preservam
-- a aparência atual da app até o owner editar via UI.
INSERT INTO studio_identity (id) VALUES ('default')
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- Sanity check (rode separadamente se quiser confirmar):
--
--   SELECT id, studio_name, email_contact, phone_contact
--   FROM studio_identity;
--
-- Deve retornar 1 row com os valores default ou os que foram salvos.
-- ============================================================================
