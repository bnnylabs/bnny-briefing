-- BNNY LABS — Schema v10
-- Adiciona o bloco de investimento nos 4 templates padrão.
--
-- Idempotente: só adiciona se o template ainda não tiver um bloco
-- do tipo 'investment' em default_blocks. Seguro re-executar.
--
-- Aplica payment_terms específicas por tipo de serviço:
--   Identidade Visual / Logo → à vista 10% | parcelado 50+50
--   Website                  → à vista 10% | parcelado 30+30+40
--   Social Media             → mensalidade  | trimestral 10%

-- ─── Identidade Visual ────────────────────────────────────────────────────

UPDATE proposal_templates
SET default_blocks = default_blocks || '[
  {
    "type": "investment",
    "position": 3072,
    "visible": true,
    "content": {
      "intro": "",
      "total_amount": 0,
      "currency": "BRL",
      "payment_terms": [
        {
          "type": "text",
          "label": "Pagamento à vista",
          "description": "10% de desconto no valor total.",
          "discount_percent": 10
        },
        {
          "type": "text",
          "label": "Parcelado",
          "description": "50% de entrada para iniciar o projeto e 50% na entrega final."
        }
      ]
    }
  }
]'::jsonb
WHERE name = 'Identidade Visual'
  AND NOT EXISTS (
    SELECT 1 FROM jsonb_array_elements(default_blocks) AS b
    WHERE b->>'type' = 'investment'
  );

-- ─── Logo ─────────────────────────────────────────────────────────────────

UPDATE proposal_templates
SET default_blocks = default_blocks || '[
  {
    "type": "investment",
    "position": 3072,
    "visible": true,
    "content": {
      "intro": "",
      "total_amount": 0,
      "currency": "BRL",
      "payment_terms": [
        {
          "type": "text",
          "label": "Pagamento à vista",
          "description": "10% de desconto no valor total.",
          "discount_percent": 10
        },
        {
          "type": "text",
          "label": "Parcelado",
          "description": "50% de entrada para iniciar o projeto e 50% na entrega final."
        }
      ]
    }
  }
]'::jsonb
WHERE name = 'Logo'
  AND NOT EXISTS (
    SELECT 1 FROM jsonb_array_elements(default_blocks) AS b
    WHERE b->>'type' = 'investment'
  );

-- ─── Website ──────────────────────────────────────────────────────────────

UPDATE proposal_templates
SET default_blocks = default_blocks || '[
  {
    "type": "investment",
    "position": 3072,
    "visible": true,
    "content": {
      "intro": "",
      "total_amount": 0,
      "currency": "BRL",
      "payment_terms": [
        {
          "type": "text",
          "label": "Pagamento à vista",
          "description": "10% de desconto no valor total.",
          "discount_percent": 10
        },
        {
          "type": "text",
          "label": "Parcelado",
          "description": "30% de entrada, 30% na aprovação do design e 40% na entrega final."
        }
      ]
    }
  }
]'::jsonb
WHERE name = 'Website'
  AND NOT EXISTS (
    SELECT 1 FROM jsonb_array_elements(default_blocks) AS b
    WHERE b->>'type' = 'investment'
  );

-- ─── Social Media ─────────────────────────────────────────────────────────

UPDATE proposal_templates
SET default_blocks = default_blocks || '[
  {
    "type": "investment",
    "position": 3072,
    "visible": true,
    "content": {
      "intro": "",
      "total_amount": 0,
      "currency": "BRL",
      "payment_terms": [
        {
          "type": "text",
          "label": "Mensalidade",
          "description": "Pagamento mensal recorrente, todo dia 5."
        },
        {
          "type": "text",
          "label": "Trimestral",
          "description": "10% de desconto no pagamento de 3 meses adiantados.",
          "discount_percent": 10
        }
      ]
    }
  }
]'::jsonb
WHERE name = 'Social Media'
  AND NOT EXISTS (
    SELECT 1 FROM jsonb_array_elements(default_blocks) AS b
    WHERE b->>'type' = 'investment'
  );
