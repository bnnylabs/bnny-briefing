-- ─────────────────────────────────────────────────────────────────────────
-- seed-presets-v1.sql — Initial preset library for Bnny Labs
-- ─────────────────────────────────────────────────────────────────────────
--
-- Populates 9 presets across the 3 preset tables (payment, terms,
-- next-steps) with content tuned to Bnny Labs' real workflow:
--   - 3 payment options (Avulso 10% off / Mensalidade fixa / 30-40-30)
--   - 3 terms presets (Padrão Avulso / Identidade Visual / Retainer)
--   - 3 next-steps presets (Kickoff Padrão / Identidade Visual / Retainer)
--
-- Each category has ONE default (marked with is_default=true) chosen
-- to be the "most common case" — what new proposals auto-apply when
-- the template doesn't specify.
--
-- Idempotent via ON CONFLICT DO NOTHING on (LOWER(name)) — re-running
-- this script doesn't duplicate. To regenerate from scratch, DELETE
-- by name first.
--
-- ⚠️ All content is PT-BR by design. EN-US versions are produced
-- on-demand by the AI translator (Fase G). One source of truth, no
-- sync drift.

-- ═════════════════════════════════════════════════════════════════════════
-- PAYMENT PRESETS (3)
-- ═════════════════════════════════════════════════════════════════════════

-- Idempotency: skip if same name already exists. Owner edits don't get
-- clobbered on re-run.
INSERT INTO proposal_payment_presets (name, description, type, is_default, payment_terms)
SELECT 'Avulso Padrão', 'Pra projetos pontuais (logo, identidade, landing).', 'avulso', TRUE,
'[
  {
    "type": "text",
    "label": "À vista",
    "description": "Pagamento integral no início do projeto, antes do kickoff. 10% de desconto sobre o valor total.",
    "discount_percent": 10
  },
  {
    "type": "text",
    "label": "Parcelado em 2x",
    "description": "50% no kickoff e 50% na entrega final aprovada. Sem juros."
  }
]'::jsonb
WHERE NOT EXISTS (
  SELECT 1 FROM proposal_payment_presets WHERE LOWER(name) = LOWER('Avulso Padrão')
);

INSERT INTO proposal_payment_presets (name, description, type, is_default, payment_terms)
SELECT 'Mensalidade Recorrente', 'Pra retainers de social media, design contínuo ou suporte.', 'mensal', FALSE,
'[
  {
    "type": "text",
    "label": "Mensalidade fixa",
    "description": "Pagamento mensal recorrente, todo dia 5. Cobrança via Pix ou boleto. Reajuste anual pelo IPCA."
  },
  {
    "type": "text",
    "label": "Anual antecipado",
    "description": "12 meses pagos no início, à vista. Garante o preço atual sem reajuste durante o ciclo.",
    "discount_percent": 15
  }
]'::jsonb
WHERE NOT EXISTS (
  SELECT 1 FROM proposal_payment_presets WHERE LOWER(name) = LOWER('Mensalidade Recorrente')
);

INSERT INTO proposal_payment_presets (name, description, type, is_default, payment_terms)
SELECT 'Por Marcos (30/40/30)', 'Pra projetos médios em 3 fases (briefing/conceito/entrega).', 'avulso', FALSE,
'[
  {
    "type": "text",
    "label": "30% no kickoff",
    "description": "Pagamento de 30% para iniciar o briefing e a fase de descoberta."
  },
  {
    "type": "text",
    "label": "40% na aprovação do conceito",
    "description": "Pagamento de 40% após aprovação do conceito visual e início do refinamento."
  },
  {
    "type": "text",
    "label": "30% na entrega final",
    "description": "Pagamento de 30% na entrega dos arquivos finais e do manual de identidade."
  }
]'::jsonb
WHERE NOT EXISTS (
  SELECT 1 FROM proposal_payment_presets WHERE LOWER(name) = LOWER('Por Marcos (30/40/30)')
);

-- ═════════════════════════════════════════════════════════════════════════
-- TERMS PRESETS (3)
-- ═════════════════════════════════════════════════════════════════════════

INSERT INTO proposal_terms_presets (name, description, type, is_default, body_markdown)
SELECT 'Padrão Avulso', 'Termos pra projetos pontuais com escopo fechado.', 'avulso', TRUE,
'## Vigência

Esta proposta é válida por 30 dias a partir da data de envio. Após esse prazo, o escopo e os valores podem ser revisados.

## Propriedade intelectual

Os direitos de uso comercial dos entregáveis finais são transferidos ao cliente após o pagamento integral. Arquivos editáveis (em formato nativo) são entregues junto. A Bnny Labs mantém o direito de incluir o projeto em portfólio e materiais promocionais, com aviso prévio quando se tratar de lançamento ainda não público.

## Revisões

O escopo inclui até 2 rodadas de revisão por etapa. Revisões adicionais são cobradas separadamente, conforme tabela vigente, com orçamento aprovado antes da execução.

## Cancelamento

Em caso de cancelamento por parte do cliente após o início do projeto, o valor pago não é reembolsado. Trabalhos em andamento são finalizados até o ponto pago e entregues no estado em que se encontram.

## Prazos

Os prazos indicados nas fases consideram dias úteis e são contados a partir do recebimento dos materiais e aprovações necessárias do cliente. Atrasos por parte do cliente impactam o cronograma proporcionalmente.'
WHERE NOT EXISTS (
  SELECT 1 FROM proposal_terms_presets WHERE LOWER(name) = LOWER('Padrão Avulso')
);

INSERT INTO proposal_terms_presets (name, description, type, is_default, body_markdown)
SELECT 'Identidade Visual', 'Termos específicos pra projetos de marca e identidade.', 'identidade', FALSE,
'## Vigência

Esta proposta é válida por 30 dias a partir da data de envio.

## Propriedade intelectual

Os direitos de uso comercial da identidade visual final (logo, paleta, tipografia, aplicações entregues) são transferidos ao cliente após o pagamento integral. O Manual de Identidade Visual em PDF e os arquivos editáveis (.ai, .svg, .pdf) são entregues junto.

A Bnny Labs mantém o direito de exibir o projeto em portfólio. Em caso de lançamento ainda não anunciado publicamente, o cliente é notificado antes da divulgação.

## Conceitos

Apresentamos 2 conceitos visuais distintos na fase de Primeiras Ideias. O cliente escolhe 1 para seguir adiante. O conceito não escolhido não é refinado nem entregue.

## Revisões

A fase de Entrega Final inclui até 3 rodadas de refinamento sobre o conceito aprovado. Mudanças que extrapolem o conceito original (mudança de direção criativa) são tratadas como novo escopo.

## Cancelamento

Cancelamento após o pagamento inicial não é reembolsável. Trabalhos em andamento são entregues até o ponto pago.

## Prazos

Os prazos consideram dias úteis e dependem do retorno do cliente em cada checkpoint. Atrasos no feedback impactam o cronograma proporcionalmente.'
WHERE NOT EXISTS (
  SELECT 1 FROM proposal_terms_presets WHERE LOWER(name) = LOWER('Identidade Visual')
);

INSERT INTO proposal_terms_presets (name, description, type, is_default, body_markdown)
SELECT 'Retainer Mensal', 'Termos pra contratos de design recorrente.', 'retainer', FALSE,
'## Vigência

Este contrato tem vigência mínima de 3 meses. Após esse período, segue por prazo indeterminado e pode ser encerrado por qualquer parte com aviso prévio de 30 dias.

## Escopo mensal

A mensalidade cobre o volume de trabalho descrito na proposta (ex: número de peças, horas de design, projetos por mês). Trabalhos que excedam o escopo são tratados como projetos avulsos e orçados à parte, com aprovação prévia.

## Banco de horas

Horas não utilizadas em um mês não acumulam para o mês seguinte, exceto quando acordado por escrito.

## Propriedade intelectual

Os direitos de uso comercial das peças produzidas são transferidos ao cliente conforme cada entrega é paga (no fechamento de cada ciclo mensal).

## Reajuste

O valor mensal é reajustado anualmente pelo IPCA acumulado dos últimos 12 meses, com aviso prévio de 30 dias.

## Cancelamento

Cancelamento antes do prazo mínimo de 3 meses gera multa proporcional aos meses restantes. Após o prazo mínimo, basta o aviso prévio de 30 dias.'
WHERE NOT EXISTS (
  SELECT 1 FROM proposal_terms_presets WHERE LOWER(name) = LOWER('Retainer Mensal')
);

-- ═════════════════════════════════════════════════════════════════════════
-- NEXT STEPS PRESETS (3)
-- ═════════════════════════════════════════════════════════════════════════

INSERT INTO proposal_next_steps_presets (name, description, type, is_default, items)
SELECT 'Kickoff Padrão', 'Onboarding genérico após aprovação.', 'avulso', TRUE,
'[
  "Reunião de kickoff em até 48h após aprovação, online via Google Meet",
  "Acesso ao Notion compartilhado do projeto, com cronograma e referências",
  "Primeira parcela cobrada via Pix ao kickoff",
  "Atualizações semanais por email às sextas, com prévia do que está em produção"
]'::jsonb
WHERE NOT EXISTS (
  SELECT 1 FROM proposal_next_steps_presets WHERE LOWER(name) = LOWER('Kickoff Padrão')
);

INSERT INTO proposal_next_steps_presets (name, description, type, is_default, items)
SELECT 'Identidade Visual', 'Pós-aprovação específico de projetos de marca.', 'identidade', FALSE,
'[
  "Reunião de kickoff em até 48h, com brand workshop guiado de 90min",
  "Envio do questionário de descoberta detalhado pelo Notion",
  "Primeira parcela (kickoff) cobrada via Pix",
  "Apresentação dos 2 primeiros conceitos em até 7 dias úteis após o briefing",
  "Entrega final do Manual de Identidade Visual + arquivos editáveis após aprovação do conceito"
]'::jsonb
WHERE NOT EXISTS (
  SELECT 1 FROM proposal_next_steps_presets WHERE LOWER(name) = LOWER('Identidade Visual')
);

INSERT INTO proposal_next_steps_presets (name, description, type, is_default, items)
SELECT 'Retainer Mensal', 'Onboarding pra contratos contínuos.', 'retainer', FALSE,
'[
  "Reunião de onboarding em até 48h, com mapeamento das demandas recorrentes",
  "Acesso ao Notion + canal direto no Slack/WhatsApp pra demandas do dia a dia",
  "Primeira mensalidade cobrada via Pix ou boleto até o dia 5",
  "Reunião de alinhamento mensal na primeira semana de cada mês",
  "Relatório de entregas + horas consumidas no fechamento de cada ciclo"
]'::jsonb
WHERE NOT EXISTS (
  SELECT 1 FROM proposal_next_steps_presets WHERE LOWER(name) = LOWER('Retainer Mensal')
);

-- ═════════════════════════════════════════════════════════════════════════
-- Verification (optional — run separately to audit)
-- ═════════════════════════════════════════════════════════════════════════
-- SELECT 'payment' AS kind, name, is_default FROM proposal_payment_presets ORDER BY is_default DESC, name
-- UNION ALL
-- SELECT 'terms', name, is_default FROM proposal_terms_presets ORDER BY is_default DESC, name
-- UNION ALL
-- SELECT 'next_steps', name, is_default FROM proposal_next_steps_presets ORDER BY is_default DESC, name;
