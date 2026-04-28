-- BNNY LABS — Schema v9 (Fase 2b da v0.10 — Templates de propostas)
-- Idempotente — seguro re-executar.
--
-- O que muda:
--   • Insere 4 templates padrão em proposal_templates SE a tabela estiver vazia.
--     Identidade Visual, Logo, Website, Social Media — cada um com header
--     + fases adaptadas e termos de pagamento típicos do tipo de serviço.
--
-- Por que a guarda "WHERE NOT EXISTS":
--   Evita sobrescrever templates customizados que o owner tenha criado entre
--   migrations. Se quiser re-seedar do zero, é só DELETE FROM proposal_templates;
--   antes de rodar.
--
-- Aplicar: cole tudo abaixo no Supabase SQL Editor.

INSERT INTO proposal_templates (name, description, type, is_default, default_blocks, default_payment_terms)
SELECT * FROM (VALUES

  -- ─── Identidade Visual ──────────────────────────────────────────────
  (
    'Identidade Visual',
    'Criação completa de marca e identidade visual.',
    'identidade',
    TRUE,
    '[
      {
        "type": "header",
        "position": 1024,
        "visible": true,
        "content": {
          "body": "Foi um prazer conversar com você sobre o projeto. Este documento detalha o escopo, cronograma e investimento para a criação da marca e nova identidade visual. O objetivo é entregar um design clean, minimalista alinhado aos seus objetivos de negócio."
        }
      },
      {
        "type": "phases",
        "position": 2048,
        "visible": true,
        "content": {
          "phases": [
            {
              "number": "1.0",
              "title": "Briefing & Descoberta",
              "duration": "3 a 4 dias úteis",
              "description": "Envio de questionário estratégico para imersão no negócio, coleta de referências e alinhamento de expectativas do projeto."
            },
            {
              "number": "2.0",
              "title": "Primeiras Ideias",
              "duration": "7 dias úteis",
              "description": "Apresentação dos conceitos visuais iniciais e caminhos criativos estruturados a partir das respostas do briefing."
            },
            {
              "number": "3.0",
              "title": "Entrega Final",
              "duration": "7 dias úteis",
              "description": "Refinamento da ideia principal aprovada e entrega do Manual de Identidade Visual completo, com todas as aplicações."
            }
          ]
        }
      }
    ]'::jsonb,
    '[
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
    ]'::jsonb
  ),

  -- ─── Logo ────────────────────────────────────────────────────────────
  (
    'Logo',
    'Criação de logo (sem manual de marca completo).',
    'logo',
    TRUE,
    '[
      {
        "type": "header",
        "position": 1024,
        "visible": true,
        "content": {
          "body": "Foi um prazer conversar com você. Este documento detalha o escopo, cronograma e investimento para a criação do logo da sua marca. O foco é entregar um símbolo único, atemporal e alinhado ao posicionamento do negócio."
        }
      },
      {
        "type": "phases",
        "position": 2048,
        "visible": true,
        "content": {
          "phases": [
            {
              "number": "1.0",
              "title": "Briefing & Direção",
              "duration": "2 dias úteis",
              "description": "Questionário rápido para captar referências e direcionamento, seguido de alinhamento da rota criativa."
            },
            {
              "number": "2.0",
              "title": "Conceitos",
              "duration": "5 dias úteis",
              "description": "Apresentação de 2 a 3 caminhos visuais distintos para escolha da direção principal."
            },
            {
              "number": "3.0",
              "title": "Refinamento & Entrega",
              "duration": "4 dias úteis",
              "description": "Refinamento do conceito escolhido e entrega final do logo em todos os formatos necessários (vetor, PNG, mockups básicos)."
            }
          ]
        }
      }
    ]'::jsonb,
    '[
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
    ]'::jsonb
  ),

  -- ─── Website ─────────────────────────────────────────────────────────
  (
    'Website',
    'Design e desenvolvimento de site institucional.',
    'site',
    TRUE,
    '[
      {
        "type": "header",
        "position": 1024,
        "visible": true,
        "content": {
          "body": "Foi um prazer conversar com você sobre o projeto. Este documento detalha o escopo, cronograma e investimento para o design e desenvolvimento do seu novo site. O objetivo é entregar uma experiência digital clara, performática e alinhada à identidade da marca."
        }
      },
      {
        "type": "phases",
        "position": 2048,
        "visible": true,
        "content": {
          "phases": [
            {
              "number": "1.0",
              "title": "Briefing & Arquitetura",
              "duration": "3 a 4 dias úteis",
              "description": "Imersão no negócio, definição de objetivos do site e estruturação da arquitetura de informação (mapa de páginas e fluxo principal)."
            },
            {
              "number": "2.0",
              "title": "Wireframes",
              "duration": "5 dias úteis",
              "description": "Esqueleto visual de cada página, definindo hierarquia de conteúdo, fluxo de navegação e principais calls-to-action."
            },
            {
              "number": "3.0",
              "title": "Design Visual",
              "duration": "10 dias úteis",
              "description": "Aplicação da identidade visual aos wireframes — telas finais em alta fidelidade, prontas para desenvolvimento."
            },
            {
              "number": "4.0",
              "title": "Desenvolvimento",
              "duration": "15 dias úteis",
              "description": "Implementação técnica responsiva (mobile, tablet, desktop), integração com CMS e otimização de performance."
            },
            {
              "number": "5.0",
              "title": "Revisão & Publicação",
              "duration": "3 dias úteis",
              "description": "Ajustes finais, testes em diferentes navegadores e dispositivos, e publicação do site no domínio."
            }
          ]
        }
      }
    ]'::jsonb,
    '[
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
    ]'::jsonb
  ),

  -- ─── Social Media ────────────────────────────────────────────────────
  (
    'Social Media',
    'Gestão e produção de conteúdo recorrente para redes sociais.',
    'social',
    TRUE,
    '[
      {
        "type": "header",
        "position": 1024,
        "visible": true,
        "content": {
          "body": "Foi um prazer conversar com você. Este documento detalha o escopo, cronograma e investimento para a gestão e produção de conteúdo das suas redes sociais. O foco é construir presença digital consistente, alinhada ao posicionamento da marca."
        }
      },
      {
        "type": "phases",
        "position": 2048,
        "visible": true,
        "content": {
          "phases": [
            {
              "number": "1.0",
              "title": "Imersão & Posicionamento",
              "duration": "3 dias úteis",
              "description": "Análise da marca, concorrência e público-alvo. Definição de tom de voz, pilares de conteúdo e diretrizes visuais."
            },
            {
              "number": "2.0",
              "title": "Planejamento Mensal",
              "duration": "3 dias úteis",
              "description": "Calendário editorial com pauta dos posts do mês — formato, datas e objetivos de cada peça."
            },
            {
              "number": "3.0",
              "title": "Produção & Publicação",
              "duration": "fluxo contínuo",
              "description": "Criação dos posts (design + copy), aprovação do cliente e publicação nas datas definidas. Acompanhamento de métricas e ajustes mensais."
            }
          ]
        }
      }
    ]'::jsonb,
    '[
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
    ]'::jsonb
  )

) AS t(name, description, type, is_default, default_blocks, default_payment_terms)
WHERE NOT EXISTS (SELECT 1 FROM proposal_templates);
