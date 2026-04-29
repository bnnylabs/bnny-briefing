import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { isAuthed } from '@/lib/auth'
import { anthropic } from '@/lib/anthropic'
import {
  ANTI_CLICHE_RULES_PT,
  SECTION_DIVIDER,
  buildSharedPreamble,
} from '@/lib/ai-style-rules'

/**
 * POST /api/proposals/rewrite
 *
 * Reescrita pontual de um único campo de texto. Diferente de
 * /api/proposals/generate (que monta abertura + fases inteiras a
 * partir de um template), este endpoint pega um trecho já existente
 * e devolve uma versão melhorada — mantendo o significado.
 *
 * Body:
 *   {
 *     text: string,                                       // texto original
 *     kind: 'header_body' | 'phase_description' | 'investment_intro' | 'generic',
 *     client_id?: string,                                  // opcional — adiciona perfil do cliente ao contexto
 *     extra_context?: string                               // opcional — instrução curta do owner
 *   }
 *
 * Response:
 *   { text: string }                                      // texto reescrito
 */


type RewriteKind = 'header_body' | 'phase_description' | 'investment_intro' | 'generic'

const KIND_INSTRUCTIONS: Record<RewriteKind, string> = {
  header_body:
    'É a ABERTURA da proposta — máximo 2-3 frases, profissional e direto. Pode começar com "Foi um prazer conversar com você" se já estiver assim. Cite UM detalhe concreto sobre o cliente (nunca generalidades).',
  phase_description:
    'É a DESCRIÇÃO de uma fase de projeto — 1-2 frases, concreta e específica para este cliente. Diga o que ACONTECE nesta fase, não o que ela "representa". Sem gerúndios pendurados.',
  investment_intro:
    'É a INTRODUÇÃO do bloco de investimento — 1-2 frases curtas que apresentam os valores. Direto, sem floreios comerciais.',
  generic:
    'Texto genérico — preserve o tipo e o tamanho aproximado, melhore só o tom.',
}

export async function POST(req: NextRequest) {
  if (!isAuthed(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: {
    text?: string
    kind?: RewriteKind
    client_id?: string
    extra_context?: string
  }
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const text = body.text?.trim()
  if (!text) {
    return NextResponse.json({ error: 'text is required' }, { status: 400 })
  }

  const kind: RewriteKind = body.kind ?? 'generic'

  // Pull a small client profile so the rewrite knows who the
  // proposal is for — same pattern as /generate, just lighter.
  let clientContext = ''
  if (body.client_id) {
    const { data: clientRaw } = await supabaseAdmin
      .from('clients')
      .select('company, tags, analysis')
      .eq('id', body.client_id)
      .maybeSingle()

    const client = clientRaw as {
      company: string | null
      tags: string[] | null
      analysis: Record<string, unknown> | null
    } | null

    if (client) {
      const parts: string[] = []
      if (client.company) parts.push(`Empresa: ${client.company}`)
      if (Array.isArray(client.tags) && client.tags.length > 0) {
        parts.push(`Segmentos: ${(client.tags as string[]).join(', ')}`)
      }
      if (client.analysis && typeof client.analysis === 'object') {
        const profileStr = JSON.stringify(client.analysis, null, 2)
        parts.push(`Perfil de IA do cliente:\n${profileStr.slice(0, 1500)}`)
      }
      if (parts.length > 0) clientContext = parts.join('\n\n')
    }
  }

  const prompt = `${buildSharedPreamble(body.extra_context)}

Reescreve o trecho abaixo em português brasileiro mantendo o sentido, mas com tom mais humano e profissional.

${SECTION_DIVIDER}
CONTEXTO DESTE CAMPO
${SECTION_DIVIDER}
${KIND_INSTRUCTIONS[kind]}

${clientContext ? `${SECTION_DIVIDER}
SOBRE O CLIENTE
${SECTION_DIVIDER}
${clientContext}\n` : ''}${ANTI_CLICHE_RULES_PT}

${SECTION_DIVIDER}
TRECHO ORIGINAL
${SECTION_DIVIDER}
${text}

${SECTION_DIVIDER}
RESPONDA APENAS com o texto reescrito. Sem markdown, sem aspas envolventes, sem comentários, sem prefácio. Só o texto puro.
${SECTION_DIVIDER}`

  try {
    const msg = await anthropic.messages.create({
      model: 'claude-haiku-4-5',
      max_tokens: 800,
      messages: [{ role: 'user', content: prompt }],
    })

    const raw = msg.content[0]
    if (raw.type !== 'text') {
      return NextResponse.json({ error: 'Resposta inesperada da IA' }, { status: 500 })
    }

    // Defensive cleanup — strip any surrounding quotes the model might
    // add, plus leading/trailing whitespace.
    const cleaned = raw.text
      .trim()
      .replace(/^["'`]+|["'`]+$/g, '')
      .trim()

    return NextResponse.json({ text: cleaned })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'IA indisponível'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
