-- BNNY LABS — Schema v8 (Fase 1 da v0.10 — Propostas: fundação)
-- Idempotente — seguro re-executar.
--
-- O que muda:
--   • 5 tabelas novas: proposals, proposal_blocks, proposal_items,
--     proposal_templates, proposal_activity
--   • Sequence global incremental para numeração #001, #002…
--   • Índices de suporte aos filtros e à página pública por slug
--
-- O que NÃO muda nesta migration:
--   • Nenhuma tabela existente é alterada
--   • settings/brand não recebe seeds novos (deixa pra Fase 5)
--
-- Aplicar: cole tudo abaixo no Supabase SQL Editor (projeto iljwzwwebzoevmxjfqbi).

-- ─── Sequence para numeração #001 global ──────────────────────────────────
-- Postgres garante atomicidade: dois INSERTs simultâneos pegam números
-- diferentes sem race. O formato (#001, #002…) é aplicado em código.

CREATE SEQUENCE IF NOT EXISTS proposal_number_seq START WITH 1 INCREMENT BY 1;

-- ─── proposals — entidade mãe ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS proposals (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug            TEXT UNIQUE NOT NULL,

  -- Numeração: inteiro puro (1, 2, 3…). Formato "#001" é responsabilidade do código.
  -- Default usa nextval pra garantir incremento atômico.
  number          INTEGER NOT NULL DEFAULT nextval('proposal_number_seq'),

  -- Versionamento pós-aprovação: NULL = primeira versão, "A","B","C" = revisões.
  -- Combinado com `number`, gera "#001-A" etc.
  version_suffix  TEXT,

  -- Vínculos
  client_id       UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  briefing_id     UUID REFERENCES briefings(id) ON DELETE SET NULL,
  template_id     UUID,  -- FK adicionada depois de proposal_templates ser criada

  -- Conteúdo top-level
  title           TEXT NOT NULL,
  language        TEXT NOT NULL DEFAULT 'pt-BR'
                    CHECK (language IN ('pt-BR','en-US')),

  -- Ciclo de vida
  status          TEXT NOT NULL DEFAULT 'draft'
                    CHECK (status IN ('draft','sent','viewed','approved','rejected','expired','revised')),

  -- Datas relevantes
  valid_until     DATE,
  sent_at         TIMESTAMPTZ,
  viewed_at       TIMESTAMPTZ,
  approved_at     TIMESTAMPTZ,
  rejected_at     TIMESTAMPTZ,

  -- Aprovação digital — quem aprovou, com qual email, IP, timestamp
  -- Estrutura: { name, email, ip, user_agent, timestamp }
  approval_data   JSONB,
  rejection_reason TEXT,

  -- Financeiro
  total_amount    NUMERIC(12,2) NOT NULL DEFAULT 0,
  currency        TEXT NOT NULL DEFAULT 'BRL',

  -- Pagamento — lista plugável de opções. Estrutura inicial:
  --   [{ "type": "text", "label": "...", "description": "...", "discount_percent": 10 }]
  -- Tipos futuros: "pix" (com qr_code_url), "stripe" (com link), "boleto"
  payment_terms   JSONB NOT NULL DEFAULT '[]',

  -- Configuração da página pública (cores customizadas, etc — Fase 3+)
  public_settings JSONB NOT NULL DEFAULT '{}',

  -- Anotações privadas do owner — não vão pra vista pública
  internal_notes  TEXT,

  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE proposals DISABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_proposals_slug      ON proposals(slug);
CREATE INDEX IF NOT EXISTS idx_proposals_client_id ON proposals(client_id);
CREATE INDEX IF NOT EXISTS idx_proposals_status    ON proposals(status);
CREATE INDEX IF NOT EXISTS idx_proposals_number    ON proposals(number);

-- ─── proposal_templates — modelos reutilizáveis ───────────────────────────

CREATE TABLE IF NOT EXISTS proposal_templates (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name           TEXT NOT NULL,
  description    TEXT,
  -- Ex: "identidade", "social", "site" — não engessado no schema, livre por enquanto
  type           TEXT,
  -- Estrutura padrão de blocos que será copiada ao criar proposta a partir deste template.
  -- Estrutura: [{ type, content, order, visible }, ...] mesmo formato de proposal_blocks
  default_blocks JSONB NOT NULL DEFAULT '[]',
  -- Termos de pagamento padrão (mesmo formato de proposals.payment_terms)
  default_payment_terms JSONB NOT NULL DEFAULT '[]',
  is_default     BOOLEAN NOT NULL DEFAULT FALSE,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE proposal_templates DISABLE ROW LEVEL SECURITY;

-- Adiciona FK de proposals.template_id agora que a tabela existe.
-- Idempotente: se já existir, ignora.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'proposals_template_id_fkey'
  ) THEN
    ALTER TABLE proposals
      ADD CONSTRAINT proposals_template_id_fkey
      FOREIGN KEY (template_id) REFERENCES proposal_templates(id) ON DELETE SET NULL;
  END IF;
END $$;

-- ─── proposal_blocks — conteúdo modular por proposta ──────────────────────
-- Cada proposta é uma sequência ordenada de blocos. Tipos suportados na v0.10:
--   header        → texto de abertura ("Foi um prazer conversar com…")
--   phases        → fases numeradas (escopo + cronograma unificados, igual ao PDF da Horus)
--                   content: { phases: [{ number, title, duration, description }] }
--   investment    → bloco de investimento. Se proposta tem proposal_items, renderiza tabela.
--                   Senão renderiza só o total. content: { intro?: string }
--   terms         → termos e condições. content: { body_markdown: string }
--   next_steps    → próximos passos. content: { items: string[] }
--   attachments   → anexos. content: { files: [{ name, url }] }
--   custom        → bloco livre. content: { title: string, body_markdown: string }

CREATE TABLE IF NOT EXISTS proposal_blocks (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  proposal_id  UUID NOT NULL REFERENCES proposals(id) ON DELETE CASCADE,
  type         TEXT NOT NULL
                 CHECK (type IN ('header','phases','investment','terms','next_steps','attachments','custom')),
  position     INTEGER NOT NULL,
  content      JSONB NOT NULL DEFAULT '{}',
  visible      BOOLEAN NOT NULL DEFAULT TRUE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE proposal_blocks DISABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_proposal_blocks_proposal_id
  ON proposal_blocks(proposal_id);
CREATE INDEX IF NOT EXISTS idx_proposal_blocks_proposal_position
  ON proposal_blocks(proposal_id, position);

-- ─── proposal_items — linhas com preço (opcional) ─────────────────────────
-- Quando a proposta usa o modelo itemizado (em vez de total fixo), cada
-- linha vira uma row aqui. O bloco "investment" detecta a presença de items
-- e renderiza tabela. Se não houver items, mostra só total_amount.

CREATE TABLE IF NOT EXISTS proposal_items (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  proposal_id  UUID NOT NULL REFERENCES proposals(id) ON DELETE CASCADE,
  description  TEXT NOT NULL,
  quantity     NUMERIC(10,2) NOT NULL DEFAULT 1,
  unit_price   NUMERIC(12,2) NOT NULL DEFAULT 0,
  total        NUMERIC(12,2) NOT NULL DEFAULT 0,
  position     INTEGER NOT NULL DEFAULT 0,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE proposal_items DISABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_proposal_items_proposal_id
  ON proposal_items(proposal_id);

-- ─── proposal_activity — log de eventos por proposta ──────────────────────
-- Estrutura espelhando notifications, mas dedicada a propostas.
-- Eventos esperados (livre, validação no código):
--   created, sent, email_client, email_admin, link_opened,
--   approved, rejected, expired, revised, resend, manual_note

CREATE TABLE IF NOT EXISTS proposal_activity (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  proposal_id  UUID NOT NULL REFERENCES proposals(id) ON DELETE CASCADE,
  event        TEXT NOT NULL,
  -- 'system' = automatizado; 'admin' = ação do owner; 'client' = ação do destinatário
  actor_type   TEXT NOT NULL DEFAULT 'system'
                 CHECK (actor_type IN ('system','admin','client')),
  details      JSONB NOT NULL DEFAULT '{}',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE proposal_activity DISABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_proposal_activity_proposal_id
  ON proposal_activity(proposal_id);
CREATE INDEX IF NOT EXISTS idx_proposal_activity_created_at
  ON proposal_activity(created_at DESC);

-- ─── Trigger: updated_at automático em proposals ──────────────────────────

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS proposals_set_updated_at ON proposals;
CREATE TRIGGER proposals_set_updated_at
  BEFORE UPDATE ON proposals
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS proposal_templates_set_updated_at ON proposal_templates;
CREATE TRIGGER proposal_templates_set_updated_at
  BEFORE UPDATE ON proposal_templates
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
