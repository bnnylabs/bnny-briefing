import { NextRequest, NextResponse } from 'next/server'
import { isAuthed } from '@/lib/auth'
import { anthropic } from '@/lib/anthropic'
import {
  STUDIO_IDENTITY_PT,
  SECTION_DIVIDER,
  ANTI_CLICHE_RULES_PT,
} from '@/lib/ai-style-rules'

/**
 * POST /api/proposal-terms-presets/build
 *
 * IA builder for terms-and-conditions presets. Takes a description in
 * plain language (ex: "Termos pra projetos de identidade visual com
 * 3 rodadas de revisão e propriedade após pagamento integral") and
 * returns a draft preset (name + description + body_markdown).
 *
 * Same tool_use pattern as payment-presets/build and templates/build.
 *
 * Body:
 *   { description: string, name?: string }
 * Response 200:
 *   { preset: { name, description, type, body_markdown } }
 */

const TOOL_SCHEMA = {
  name: 'build_terms_preset',
  description:
    'Constrói um preset de termos e condições da Bnny Labs com base na descrição do owner.',
  input_schema: {
    type: 'object' as const,
    properties: {
      name: {
        type: 'string',
        description:
          'Nome curto do preset (2-4 palavras). Ex: "Padrão B2B", "Identidade Visual", "Retainer Mensal".',
      },
      description: {
        type: 'string',
        description:
          '1 frase explicando quando usar esse preset. Ex: "Termos padrão pra projetos pontuais com 3 rodadas de revisão."',
      },
      type: {
        type: 'string',
        description:
          'Etiqueta livre minúscula sem acento. Ex: "padrao", "identidade", "retainer", "ecommerce".',
      },
      body_markdown: {
        type: 'string',
        description:
          'Termos e condições completos em markdown. Use ## como subtítulos. Cobre tipicamente: vigência da proposta, propriedade intelectual, processo de revisões (quantas rodadas), cancelamento. Genérico mas concreto. NÃO use placeholders como [Cliente] ou [Studio] — escreva texto real.',
      },
    },
    required: ['name', 'description', 'type', 'body_markdown'],
  },
}

interface ToolInput {
  name: string
  description: string
  type: string
  body_markdown: string
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

Sua tarefa é montar um PRESET de termos e condições — texto reutilizável que o estúdio aplica em vários templates e propostas.

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

TYPE: 1 palavra minúscula sem acento.

BODY_MARKDOWN: termos e condições completos em markdown.
- Use ## como subtítulos curtos (ex: "Vigência", "Propriedade", "Revisões", "Cancelamento")
- Cobre tipicamente: vigência da proposta (30 dias é padrão), propriedade intelectual (transferida ao cliente após pagamento integral), processo de revisões (quantas rodadas inclusas — 2 ou 3 é padrão pra pontuais), cancelamento.
- Frases curtas e diretas. Evite jargão jurídico desnecessário.
- NÃO use placeholders como [Cliente], [Studio], [Date]. Escreva texto real.
- Tom profissional mas humano.
- ${ANTI_CLICHE_RULES_PT.split('\n').slice(0, 8).join('\n')}

Agora chama a tool build_terms_preset com a estrutura completa.`

  try {
    const msg = await anthropic.messages.create({
      model: 'claude-haiku-4-5',
      max_tokens: 2048,
      tools: [TOOL_SCHEMA],
      tool_choice: { type: 'tool', name: 'build_terms_preset' },
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

    return NextResponse.json({
      preset: {
        name: out.name,
        description: out.description,
        type: out.type,
        body_markdown: out.body_markdown,
      },
    })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'AI builder failed'
    console.error('[terms-presets/build] failed:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
