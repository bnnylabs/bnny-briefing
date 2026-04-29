import { NextRequest, NextResponse } from 'next/server'
import { isAuthed } from '@/lib/auth'
import { anthropic } from '@/lib/anthropic'
import {
  STUDIO_IDENTITY_PT,
  SECTION_DIVIDER,
} from '@/lib/ai-style-rules'
import type { PaymentTerm } from '@/lib/proposal-types'

/**
 * POST /api/proposal-payment-presets/build
 *
 * IA builder for payment presets. Takes a free-form description (ex:
 * "12x sem juros, primeira parcela em 30 dias") and returns a draft
 * preset (name + description + payment_terms array) that the caller
 * can review and persist via POST /api/proposal-payment-presets.
 *
 * Same tool_use pattern as /api/proposal-templates/build — forces the
 * model to call our tool with a typed schema instead of returning JSON
 * we'd have to parse loosely.
 *
 * Body:
 *   { description: string, name?: string }
 * Response 200:
 *   { preset: { name, description, type, payment_terms[] } }
 */

const TOOL_SCHEMA = {
  name: 'build_payment_preset',
  description:
    'Constrói um preset de condições de pagamento da Bnny Labs com base na descrição do owner.',
  input_schema: {
    type: 'object' as const,
    properties: {
      name: {
        type: 'string',
        description:
          'Nome curto do preset (2-4 palavras). Ex: "Avulso", "Mensal 12x", "Pacote Trimestral".',
      },
      description: {
        type: 'string',
        description:
          '1 frase explicando quando usar esse preset. Ex: "Pra projetos pontuais como logo ou identidade visual."',
      },
      type: {
        type: 'string',
        description:
          'Etiqueta livre minúscula sem acento. Ex: "avulso", "mensal", "anual", "retainer".',
      },
      payment_terms: {
        type: 'array',
        description:
          '2 a 3 opções de pagamento. Tipicamente uma à vista (com desconto se fizer sentido) e uma parcelada.',
        items: {
          type: 'object',
          properties: {
            label: {
              type: 'string',
              description:
                'Nome curto da opção. Ex: "À vista", "Parcelado em 2x", "Mensalidade".',
            },
            description: {
              type: 'string',
              description:
                'Como funciona em 1 frase. Ex: "50% de entrada, 50% na entrega final."',
            },
            discount_percent: {
              type: 'number',
              description:
                'Desconto percentual (1-50) se houver. Omita se não houver desconto.',
            },
          },
          required: ['label', 'description'],
        },
      },
    },
    required: ['name', 'description', 'type', 'payment_terms'],
  },
}

interface ToolInput {
  name: string
  description: string
  type: string
  payment_terms: Array<{
    label: string
    description: string
    discount_percent?: number
  }>
}

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
    return NextResponse.json(
      { error: 'description is required' },
      { status: 400 },
    )
  }

  const ownerName = body.name?.trim()

  const prompt = `${STUDIO_IDENTITY_PT}

Sua tarefa é montar um PRESET de condições de pagamento — uma estrutura reutilizável que o estúdio aplica em vários templates e propostas.

${SECTION_DIVIDER}
DESCRIÇÃO DO PRESET (instrução do owner — siga à risca)
${SECTION_DIVIDER}
${description}
${ownerName ? `\nNome sugerido pelo owner: "${ownerName}" (use exatamente esse nome se fizer sentido).` : ''}

${SECTION_DIVIDER}
INSTRUÇÕES
${SECTION_DIVIDER}

NAME: 2 a 4 palavras. Use o sugerido se houver.

DESCRIPTION: 1 frase, máximo 12 palavras, sobre quando usar.

TYPE: 1 palavra minúscula sem acento. Ex: "avulso", "mensal", "trimestral", "anual", "retainer".

PAYMENT_TERMS: 2 a 3 opções. Cada uma tem label curto, description de 1 frase concreta, e discount_percent opcional só se houver desconto real (1-50). Para "à vista" use desconto se fizer sentido (ex: 5-10%). Para parcelado, descreva como divide (50/50, 3x, 12x etc).

Agora chama a tool build_payment_preset com a estrutura completa.`

  try {
    const msg = await anthropic.messages.create({
      model: 'claude-haiku-4-5',
      max_tokens: 1024,
      tools: [TOOL_SCHEMA],
      tool_choice: { type: 'tool', name: 'build_payment_preset' },
      messages: [{ role: 'user', content: prompt }],
    })

    const toolUse = msg.content.find((c) => c.type === 'tool_use')
    if (!toolUse || toolUse.type !== 'tool_use') {
      return NextResponse.json(
        { error: 'IA não retornou estrutura válida' },
        { status: 500 },
      )
    }

    const out = toolUse.input as ToolInput

    // Map AI shape into PaymentTerm[] (the 'text' variant — IA não tem
    // contexto pra ainda escolher pix/stripe/etc; o owner adapta depois
    // se quiser).
    const payment_terms: PaymentTerm[] = (out.payment_terms ?? []).map(
      (p) => ({
        type: 'text' as const,
        label: p.label ?? '',
        description: p.description ?? '',
        ...(typeof p.discount_percent === 'number' && p.discount_percent > 0
          ? { discount_percent: p.discount_percent }
          : {}),
      }),
    )

    return NextResponse.json({
      preset: {
        name: out.name,
        description: out.description,
        type: out.type,
        payment_terms,
      },
    })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'AI builder failed'
    console.error('[payment-presets/build] failed:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
