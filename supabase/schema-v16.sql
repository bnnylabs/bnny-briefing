-- ─────────────────────────────────────────────────────────────────────────
-- schema-v16.sql — Block-level translations (Fase G — IA Ambiental)
-- ─────────────────────────────────────────────────────────────────────────
--
-- Resolve o bug em que `?l=en` na recipient view apenas troca a UI mas
-- mantém o conteúdo dos blocos no idioma-fonte. A partir desta migration
-- cada bloco/proposta/template pode armazenar versões paralelas em outros
-- idiomas, geradas via IA (claude-haiku-4-5) ou inseridas manualmente.
--
-- Filosofia:
--   • O `content` original é canônico e nunca substituído.
--   • Traduções vivem ao lado, em colunas JSONB paralelas.
--   • Hash do conteúdo-fonte é guardado junto da tradução pra detectar
--     "stale" (fonte editada após a tradução). UI sinaliza, decisão de
--     retraduzir é do operador.
--   • Mesmo padrão em três tabelas pra simplificar libs de leitura.
--
-- Shape esperado:
--   proposal_blocks.translations =
--     { "en-US": { ...mesmo shape de content... } }
--   proposals.translations =
--     { "en-US": { "title": "...", "payment_terms": [...] } }
--   proposal_templates.translations =
--     { "en-US": { "default_blocks": [...], "default_payment_terms": [...] } }
--
--   *.translations_meta =
--     { "en-US": {
--         "source_hash": "sha256-hex",
--         "translated_at": "2026-04-29T...",
--         "translated_by": "ai" | "manual",
--         "model": "claude-haiku-4-5"
--     } }
--
-- A coluna `proposals.language` continua sendo o idioma-fonte da proposta;
-- não se confunde com `?l=en` da recipient view (que é override de display).
-- Templates ganham `source_lang` análoga.

-- ─── proposal_blocks ──────────────────────────────────────────────────────

ALTER TABLE proposal_blocks
  ADD COLUMN IF NOT EXISTS translations JSONB NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE proposal_blocks
  ADD COLUMN IF NOT EXISTS translations_meta JSONB NOT NULL DEFAULT '{}'::jsonb;

-- GIN index pra futuras queries por idioma disponível
-- (ex: "quantas propostas têm tradução EN?"). Barato em writes JSONB pequenos.
CREATE INDEX IF NOT EXISTS idx_proposal_blocks_translations
  ON proposal_blocks USING GIN (translations);


-- ─── proposals ────────────────────────────────────────────────────────────

ALTER TABLE proposals
  ADD COLUMN IF NOT EXISTS translations JSONB NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE proposals
  ADD COLUMN IF NOT EXISTS translations_meta JSONB NOT NULL DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS idx_proposals_translations
  ON proposals USING GIN (translations);


-- ─── proposal_templates ───────────────────────────────────────────────────
-- Templates não tinham coluna de idioma-fonte. Adiciona agora pra paridade
-- com proposals.language e pra que a lib de tradução saiba o que é "from"
-- e o que é "to" sem heurística.

ALTER TABLE proposal_templates
  ADD COLUMN IF NOT EXISTS source_lang TEXT NOT NULL DEFAULT 'pt-BR'
    CHECK (source_lang IN ('pt-BR','en-US'));

ALTER TABLE proposal_templates
  ADD COLUMN IF NOT EXISTS translations JSONB NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE proposal_templates
  ADD COLUMN IF NOT EXISTS translations_meta JSONB NOT NULL DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS idx_proposal_templates_translations
  ON proposal_templates USING GIN (translations);


-- ─── Sanity checks ────────────────────────────────────────────────────────
-- Nenhum dado migra automaticamente. Linhas existentes ficam com
-- translations='{}' e translations_meta='{}'. A recipient view com `?l=en`
-- continua funcionando exatamente como antes (fallback pro source) até que
-- o operador clique "Traduzir com IA" no editor.

COMMENT ON COLUMN proposal_blocks.translations IS
  'Versões traduzidas do content. Shape: { "en-US": {...mesmo shape de content...} }. Source nunca é substituído.';
COMMENT ON COLUMN proposal_blocks.translations_meta IS
  'Metadata por idioma: { "en-US": { source_hash, translated_at, translated_by, model } }. source_hash detecta stale.';

COMMENT ON COLUMN proposals.translations IS
  'Versões traduzidas dos campos top-level (title, payment_terms). Shape: { "en-US": { title, payment_terms } }.';
COMMENT ON COLUMN proposals.translations_meta IS
  'Metadata por idioma: { "en-US": { source_hash, translated_at, translated_by, model } }.';

COMMENT ON COLUMN proposal_templates.source_lang IS
  'Idioma canônico do template. Default pt-BR. Espelha proposals.language pra paridade.';
COMMENT ON COLUMN proposal_templates.translations IS
  'Versões traduzidas. Shape: { "en-US": { default_blocks, default_payment_terms } }.';
COMMENT ON COLUMN proposal_templates.translations_meta IS
  'Metadata por idioma: { "en-US": { source_hash, translated_at, translated_by, model } }.';
