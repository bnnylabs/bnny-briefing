import { NextRequest, NextResponse } from 'next/server'
import { isAuthed } from '@/lib/auth'
import { anthropic } from '@/lib/anthropic'
import {
  STUDIO_IDENTITY_PT,
  SECTION_DIVIDER,
} from '@/lib/ai-style-rules'

/**
 * POST /api/proposal-next-steps-presets/build
 *
 * IA builder for next-steps presets. Takes a description and returns
 * a draft with name + items[] (3-5 short post-approval steps).
 *
 * Same tool_use pattern as the other preset builders.
 */

const TOOL_SCHEMA = {
  name: 'build_next_steps_preset',
  description:
    'Constrói um preset de próximos passos da Bnny Labs com base na descrição do owner.',
  input_schema: {
    type: 'object' as const,
    properties: {
      name: {
        type: 'string',
        description:
          'Nome curto do preset (2-4 palavras). Ex: "Padrão", "Identidade Visual", "Retainer Mensal".',
      },
      description: {
        type: 'string',
        description:
          '1 frase explicando quando usar. Ex: "Pós aprovação de projetos pontuais."',
      },
      type: {
        type: 'string',
        description:
          'Etiqueta livre minúscula sem acento. Ex: "padrao", "identidade", "retainer".',
      },
      items: {
        type: 'array',
        description:
          '3 a 5 passos curtos pós-aprovação, em ordem cronológica. Cada item é uma string concreta.',
        items: { type: 'string' },
      },
    },
    required: ['name', 'description', 'type', 'items'],
  },
}

interface ToolInput {
  name: string
  description: string
  type: string
  items: string[]
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

Sua tarefa é montar um PRESET de próximos passos pós-aprovação — lista reutilizável que o estúdio aplica em vários templates e propostas.

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

ITEMS: 3 a 5 passos curtos em ordem cronológica. Cada um deve ser CONCRETO e ACIONÁVEL — diga o que ACONTECE, não vagueza. Exemplos bons: "Reunião de kickoff em até 48h após aprovação", "Acesso ao Notion compartilhado do projeto", "Calendário de entregas semanais por email", "Primeira parcela cobrada ao kickoff", "Apresentação do conceito em até 7 dias úteis". Evite items genéricos tipo "Alinhamento" ou "Comunicação contínua".

Agora chama a tool build_next_steps_preset com a estrutura completa.`

  try {
    const msg = await anthropic.messages.create({
      model: 'claude-haiku-4-5',
      max_tokens: 1024,
      tools: [TOOL_SCHEMA],
      tool_choice: { type: 'tool', name: 'build_next_steps_preset' },
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
    const items = (out.items ?? []).map((s) => s.trim()).filter(Boolean)

    return NextResponse.json({
      preset: {
        name: out.name,
        description: out.description,
        type: out.type,
        items,
      },
    })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'AI builder failed'
    console.error('[next-steps-presets/build] failed:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
