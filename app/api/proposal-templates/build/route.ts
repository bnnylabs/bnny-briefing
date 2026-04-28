import { NextRequest, NextResponse } from 'next/server'
import type {
  PaymentTerm,
  ProposalBlockContent,
  ProposalBlockType,
  ProposalTemplate,
} from '@/lib/proposal-types'
import { isAuthed } from '@/lib/auth'
import { anthropic } from '@/lib/anthropic'

/**
 * POST /api/proposal-templates/build
 *
 * Recebe uma descrição livre do tipo de modelo desejado e usa a IA pra
 * montar a estrutura completa do template (nome, descrição, tipo, blocos,
 * condições de pagamento). NÃO persiste — devolve um draft que o caller
 * pode revisar e enviar pro endpoint POST /api/proposal-templates.
 *
 * Body:
 *   {
 *     description: string,        // descrição livre, obrigatória
 *     name?: string,              // se o owner já tem um nome em mente
 *   }
 *
 * Response 200:
 *   {
 *     template: {
 *       name, description, type,
 *       default_blocks, default_payment_terms,
 *     }
 *   }
 */

// ─── Tool schema — forces structured output ─────────────────────────────
//
// Em vez de pedir JSON e torcer, usamos tool_use. A IA é forçada a chamar
// a tool `build_template` com input no schema abaixo. Anthropic valida o
// shape antes de devolver.

const TOOL_SCHEMA = {
  name: 'build_template',
  description:
    'Constrói a estrutura completa de um modelo de proposta da Bnny Labs com base na descrição do owner.',
  input_schema: {
    type: 'object' as const,
    properties: {
      name: {
        type: 'string',
        description: 'Nome curto do modelo (2-4 palavras). Ex: "Identidade Visual", "Social Media Mensal".',
      },
      description: {
        type: 'string',
        description: 'Descrição de 1 frase explicando pra que tipo de projeto este modelo serve.',
      },
      type: {
        type: 'string',
        description:
          'Etiqueta livre minúscula sem acento — categoria. Ex: "identidade", "social", "site", "retainer".',
      },
      header_body: {
        type: 'string',
        description:
          'Texto de abertura genérico — 2 a 3 frases. Pode usar placeholder "[Cliente]" pra ser substituído. NUNCA use clichês de IA.',
      },
      phases: {
        type: 'array',
        description: 'Fases do projeto em ordem cronológica. 3 a 5 fases é o ideal.',
        items: {
          type: 'object',
          properties: {
            number: {
              type: 'string',
              description: 'Numeração curta. Ex: "1.0", "2.0", "3.0"',
            },
            title: {
              type: 'string',
              description: 'Título curto da fase. Ex: "Briefing & Descoberta"',
            },
            duration: {
              type: 'string',
              description: 'Duração estimada. Ex: "3 a 4 dias úteis", "1 semana", "1 mês"',
            },
            description: {
              type: 'string',
              description: 'Descrição concreta de 1 a 2 frases sobre o que ACONTECE nesta fase.',
            },
          },
          required: ['number', 'title', 'duration', 'description'],
        },
      },
      payment_terms: {
        type: 'array',
        description:
          'Opções de pagamento padrão pra esse tipo de projeto. 2 a 3 opções é o ideal (à vista com desconto + parcelado).',
        items: {
          type: 'object',
          properties: {
            label: {
              type: 'string',
              description: 'Nome curto da opção. Ex: "Pagamento à vista", "Parcelado", "Mensalidade".',
            },
            description: {
              type: 'string',
              description: 'Como funciona em 1 frase. Ex: "50% de entrada, 50% na entrega final."',
            },
            discount_percent: {
              type: 'number',
              description: 'Desconto percentual (1-50) se houver. Omita se não houver desconto.',
            },
          },
          required: ['label', 'description'],
        },
      },
      terms_markdown: {
        type: 'string',
        description:
          'Termos e condições em markdown — vigência, propriedade intelectual, cancelamento, revisões. Use ## pra subtítulos.',
      },
      next_steps: {
        type: 'array',
        description: 'Passos pós-aprovação em ordem. 3 a 5 passos curtos.',
        items: { type: 'string' },
      },
    },
    required: [
      'name',
      'description',
      'type',
      'header_body',
      'phases',
      'payment_terms',
      'terms_markdown',
      'next_steps',
    ],
  },
}

interface BuildToolOutput {
  name: string
  description: string
  type: string
  header_body: string
  phases: Array<{ number: string; title: string; duration: string; description: string }>
  payment_terms: Array<{ label: string; description: string; discount_percent?: number }>
  terms_markdown: string
  next_steps: string[]
}

// ─── Block positions match the editor's fixed slot order ────────────────
const BLOCK_POSITION: Record<ProposalBlockType, number> = {
  header: 1024,
  phases: 2048,
  investment: 3072,
  terms: 4096,
  next_steps: 5120,
  custom: 6144,
  attachments: 7168,
}

// ─── Route ──────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  if (!isAuthed(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: { description?: string; name?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const description = body.description?.trim()
  if (!description) {
    return NextResponse.json({ error: 'description is required' }, { status: 400 })
  }

  const ownerName = body.name?.trim()

  const prompt = `Você é redator da Bnny Labs, uma agência criativa que escreve propostas comerciais em português brasileiro com tom profissional, direto e humano. Sua tarefa é montar a estrutura completa de um MODELO de proposta — uma estrutura reutilizável que vai servir de base pra várias propostas reais futuras.

═══════════════════════════════════════════════════════════
DESCRIÇÃO DO MODELO QUE O OWNER QUER
═══════════════════════════════════════════════════════════
${description}
${ownerName ? `\nNome sugerido pelo owner: "${ownerName}" (use exatamente esse nome se fizer sentido).` : ''}

═══════════════════════════════════════════════════════════
COMO ESCREVER (REGRA DE OURO)
═══════════════════════════════════════════════════════════
Como é um MODELO genérico (não uma proposta personalizada pra cliente específico), os textos devem ser intencionalmente NEUTROS e GENÉRICOS — vai ser a IA depois que vai personalizar pra cada cliente real. Mas sem cair em vagueza corporativa.

PROIBIDO usar:
- Palavras de IA: robusto, alavancar, potencializar, engajamento, empoderar, disruptivo, sinergia, holístico, ecossistema, jornada, imersivo, transformador, estratégico, escalável, inovador, destravar, "agregar valor", "elevar a outro patamar", excelência, inovação, transformação, soluções
- Conectores expositivos: "Vale ressaltar", "É importante destacar", "Nesse sentido", "Diante disso", "Em suma"
- Inflação: "marca um momento crucial", "consolida-se como referência", "papel fundamental"
- Perífrases formais: "no que tange a", "tendo em vista que", "a fim de" (use "sobre", "como", "para")
- Gerúndios pendurados: "destacando-se", "evidenciando", "agregando valor", "contribuindo para"
- Listas de 3 adjetivos seguidos
- Servilismo

═══════════════════════════════════════════════════════════
INSTRUÇÕES POR CAMPO
═══════════════════════════════════════════════════════════

NAME: nome curto do modelo, 2 a 4 palavras. Use o nome sugerido pelo owner se houver e fizer sentido.

DESCRIPTION: 1 frase, máximo 12 palavras, explicando pra que tipo de projeto este modelo serve. Aparece no seletor de modelos.

TYPE: 1 palavra minúscula sem acento. Ex: "identidade", "social", "site", "retainer", "logo", "ecommerce". Categoria livre.

HEADER_BODY: texto de abertura genérico de 2 a 3 frases. Use o placeholder "[Cliente]" onde o nome do cliente entraria. Tom profissional, direto. Exemplo bom: "Foi um prazer conversar com [Cliente] sobre o projeto. Reunimos abaixo o escopo, cronograma e investimento que faz sentido pro que vocês estão construindo."

PHASES: 3 a 5 fases em ordem cronológica. Cada fase tem número (1.0, 2.0, 3.0), título curto, duração estimada e 1-2 frases concretas de descrição (o que ACONTECE — não o que "representa"). Exemplo bom de descrição: "Reuniões com a equipe pra entender o que vocês fazem, pra quem vendem e o que diferencia de mira no mercado."

PAYMENT_TERMS: 2 a 3 opções de pagamento adequadas pro tipo de projeto. Para projetos pontuais (logo, site), inclua opção à vista com desconto E parcelado. Para retainer/social, inclua mensalidade E pacote trimestral. discount_percent só quando houver desconto real.

TERMS_MARKDOWN: termos e condições em markdown. Cobre: vigência da proposta (30 dias), propriedade intelectual (transferida ao cliente após pagamento integral), processo de revisões (quantas rodadas inclusas), cancelamento. Use ## como subtítulos. Genérico mas concreto.

NEXT_STEPS: 3 a 5 passos curtos pós-aprovação. Ex: "Reunião de kickoff em até 48h após aprovação", "Acesso ao Notion compartilhado do projeto", "Calendário de entregas semanais por email".

Agora chama a tool build_template com a estrutura completa.`

  try {
    const msg = await anthropic.messages.create({
      model: 'claude-haiku-4-5',
      max_tokens: 4096,
      tools: [TOOL_SCHEMA],
      tool_choice: { type: 'tool', name: 'build_template' },
      messages: [{ role: 'user', content: prompt }],
    })

    // Tool use forçado — o primeiro content block deve ser tool_use
    const toolUse = msg.content.find((c) => c.type === 'tool_use')
    if (!toolUse || toolUse.type !== 'tool_use') {
      return NextResponse.json(
        { error: 'IA não retornou estrutura válida' },
        { status: 500 },
      )
    }

    const out = toolUse.input as BuildToolOutput

    // ─── Build the template payload ────────────────────────────────────
    const default_blocks: ProposalTemplate['default_blocks'] = []

    if (out.header_body) {
      default_blocks.push({
        type: 'header',
        position: BLOCK_POSITION.header,
        visible: true,
        content: { body: out.header_body } as ProposalBlockContent,
      })
    }

    if (Array.isArray(out.phases) && out.phases.length > 0) {
      default_blocks.push({
        type: 'phases',
        position: BLOCK_POSITION.phases,
        visible: true,
        content: {
          phases: out.phases.map((p) => ({
            number: p.number ?? '',
            title: p.title ?? '',
            duration: p.duration ?? '',
            description: p.description ?? '',
          })),
        } as ProposalBlockContent,
      })
    }

    // Investment block: total_amount fica zero (owner preenche caso a caso),
    // mas as condições de pagamento da IA viram default_payment_terms E
    // espelham no bloco investment pra ficar consistente.
    const default_payment_terms: PaymentTerm[] = (out.payment_terms ?? []).map((p) => ({
      type: 'text',
      label: p.label ?? '',
      description: p.description ?? '',
      ...(typeof p.discount_percent === 'number' && p.discount_percent > 0
        ? { discount_percent: p.discount_percent }
        : {}),
    }))

    default_blocks.push({
      type: 'investment',
      position: BLOCK_POSITION.investment,
      visible: true,
      content: {
        intro: '',
        total_amount: 0,
        currency: 'BRL',
        payment_terms: default_payment_terms,
      } as ProposalBlockContent,
    })

    if (out.terms_markdown?.trim()) {
      default_blocks.push({
        type: 'terms',
        position: BLOCK_POSITION.terms,
        visible: true,
        content: { body_markdown: out.terms_markdown } as ProposalBlockContent,
      })
    }

    if (Array.isArray(out.next_steps) && out.next_steps.length > 0) {
      default_blocks.push({
        type: 'next_steps',
        position: BLOCK_POSITION.next_steps,
        visible: true,
        content: { items: out.next_steps.filter(Boolean) } as ProposalBlockContent,
      })
    }

    return NextResponse.json({
      template: {
        name: out.name?.trim() || ownerName || 'Modelo gerado',
        description: out.description?.trim() || null,
        type: out.type?.trim().toLowerCase() || null,
        default_blocks,
        default_payment_terms,
        is_default: false,
      },
    })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'IA indisponível'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
