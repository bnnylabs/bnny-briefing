import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import type { ProposalTemplate } from '@/lib/proposal-types'
import { isAuthed } from '@/lib/auth'
import { anthropic } from '@/lib/anthropic'
import { ANTI_CLICHE_RULES_PT, buildSharedPreamble } from '@/lib/ai-style-rules'

/**
 * POST /api/proposals/generate
 *
 * Uses the Anthropic API to personalize a proposal's header and phase
 * descriptions based on meeting notes, transcript, or client context
 * provided by the owner.
 *
 * Returns content_overrides ready to be passed to POST /api/proposals.
 * Does NOT create the proposal — the client does that in a second call
 * so the owner always has a chance to review before the proposal exists.
 */

/**
 * Fetch the text content of a URL for use as additional context.
 * Strips HTML tags, limits to 3000 chars. Fails silently.
 */
async function fetchUrlText(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; BnnyBot/1.0)' },
      signal: AbortSignal.timeout(5000),
    })
    if (!res.ok) return null
    const html = await res.text()
    // Strip tags, collapse whitespace, limit length
    const text = html
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 3000)
    return text || null
  } catch {
    return null
  }
}

interface Phase {
  number: string
  title: string
  duration: string
  description: string
}

interface GenerateResponse {
  content_overrides: {
    header: { body: string }
    phases: { phases: Phase[] }
  }
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  if (!isAuthed(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: {
    template_id?: string
    client_id?: string
    /** Optional explicit override — if absent, derived from client_id. */
    client_company?: string
    /** Override the person addressed in the opening greeting. If null,
     *  resolves to the client's primary contact. Used by the IACard's
     *  "Para quem é a abertura?" field — handy when the proposal is
     *  going to a specific person who isn't (or shouldn't be) the
     *  primary contact. Doesn't persist; only affects this generation. */
    addressee_name?: string | null
    context?: string
  }
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { template_id, client_id, context } = body
  if (!context?.trim() && !client_id) {
    return NextResponse.json({ error: 'context or client_id is required' }, { status: 400 })
  }

  // ─── Load client data automatically ────────────────────────────────────
  // The client is already cadastrado with website, social handles, segments
  // and a saved AI profile (analysis). Pull all of that to build the prompt
  // without asking the user to paste URLs again.

  let clientCompany = body.client_company ?? ''
  let clientContactName = body.addressee_name?.trim() || null
  let autoContext = ''

  if (client_id) {
    const { data: clientRaw } = await supabaseAdmin
      .from('clients')
      .select(
        'company, website, tags, analysis, ' +
        'social_instagram, social_linkedin, social_facebook, social_youtube, ' +
        'social_tiktok, social_twitter, social_pinterest, social_other',
      )
      .eq('id', client_id)
      .maybeSingle()

    const client = clientRaw as {
      company: string | null
      website: string | null
      tags: string[] | null
      analysis: Record<string, unknown> | null
      social_instagram: string | null
      social_linkedin: string | null
      social_facebook: string | null
      social_youtube: string | null
      social_tiktok: string | null
      social_twitter: string | null
      social_pinterest: string | null
      social_other: string | null
    } | null

    if (client) {
      clientCompany = clientCompany || (client.company as string) || ''

      // Build auto-context from cadastrado client data
      const parts: string[] = []

      if (Array.isArray(client.tags) && client.tags.length > 0) {
        parts.push(`Segmentos/tags: ${(client.tags as string[]).join(', ')}`)
      }

      // The AI profile is the richest source — already curated by the owner.
      if (client.analysis && typeof client.analysis === 'object') {
        const analysisStr = JSON.stringify(client.analysis, null, 2)
        // Cap to keep prompt size sane
        parts.push(`Perfil de IA do cliente:\n${analysisStr.slice(0, 2000)}`)
      }

      // List social handles (just the URLs, no fetching — too noisy)
      const socials = [
        client.social_instagram && `Instagram: ${client.social_instagram}`,
        client.social_linkedin  && `LinkedIn: ${client.social_linkedin}`,
        client.social_twitter   && `X/Twitter: ${client.social_twitter}`,
        client.social_facebook  && `Facebook: ${client.social_facebook}`,
        client.social_youtube   && `YouTube: ${client.social_youtube}`,
        client.social_tiktok    && `TikTok: ${client.social_tiktok}`,
      ].filter(Boolean) as string[]
      if (socials.length > 0) {
        parts.push(`Redes sociais: ${socials.join(' · ')}`)
      }

      // Fetch the website text (1 fetch only — socials usually need auth)
      if (client.website) {
        const fetched = await fetchUrlText(client.website as string)
        if (fetched) parts.push(`Conteúdo do site (${client.website}):\n${fetched}`)
      }

      // Resolve primary contact from client_contacts if not explicitly provided
      if (!clientContactName) {
        const { data: primary } = await supabaseAdmin
          .from('client_contacts')
          .select('name')
          .eq('client_id', client_id)
          .eq('is_primary', true)
          .maybeSingle()
        if (primary?.name) clientContactName = primary.name as string
      }

      if (parts.length > 0) autoContext = parts.join('\n\n')
    }
  }

  // Owner notes (from the "Observações" field) get authoritative
  // weight in the prompt — see lib/ai-style-rules.ts. They go to a
  // dedicated <owner_directives> block at the top, NOT mixed into the
  // generic context. autoContext (transcript, client profile, briefing
  // answers) stays as factual backdrop for the model to work with.
  const ownerNotes = context?.trim() || ''

  // Fail safe: if absolutely nothing to work with, bail.
  if (!autoContext.trim() && !ownerNotes) {
    return NextResponse.json({ error: 'No context available for AI generation' }, { status: 400 })
  }

  // Load template to get the base structure for the AI to adapt
  let templateBlocks: ProposalTemplate['default_blocks'] = []
  if (template_id) {
    const { data } = await supabaseAdmin
      .from('proposal_templates')
      .select('default_blocks')
      .eq('id', template_id)
      .maybeSingle()
    if (data) templateBlocks = data.default_blocks ?? []
  }

  const headerBlock = templateBlocks.find((b) => b.type === 'header')
  const phasesBlock = templateBlocks.find((b) => b.type === 'phases')
  const baseHeader = (headerBlock?.content as { body?: string })?.body ?? ''
  const basePhases: Phase[] = (phasesBlock?.content as { phases?: Phase[] })?.phases ?? []

  // Determine how to address the client contact
  const addressee = clientContactName?.trim()
    ? `você, ${clientContactName.trim()}`
    : 'você'

  const prompt = `${buildSharedPreamble(ownerNotes)}

CLIENTE: ${clientCompany || 'o cliente'}
${clientContactName ? `CONTATO PRINCIPAL: ${clientContactName}` : ''}

CONTEXTO DO PROJETO (para referência factual):
${autoContext.trim() || '(nenhum contexto automatizado disponível — use apenas as instruções do owner acima)'}

TEMPLATE BASE (estrutura para adaptar):

Abertura base:
"${baseHeader}"

Fases:
${basePhases.map((p) => `${p.number} — ${p.title} (${p.duration}): ${p.description}`).join('\n')}

${ANTI_CLICHE_RULES_PT}

═══════════════════════════════════════════════════════════
COMO ESCREVER
═══════════════════════════════════════════════════════════

ABERTURA (header.body):
- Máximo 2 frases, no MÁXIMO 3
- Comece exatamente com: "Foi um prazer conversar com ${addressee}."
- Segunda frase: UM detalhe concreto do contexto do cliente (o que eles fazem, qual o desafio específico). NUNCA generalidade.
- Terceira frase (opcional): qual o objetivo claro deste projeto.
- Use frases curtas. Verbos simples (é, faz, tem). Sem floreios.

FASES (phases.phases):
- Mantenha número, título e duração EXATAMENTE como estão no template.
- Reescreva apenas a "description" de cada fase.
- Cada description: 1-2 frases. Concreta. Diga o que ACONTECE nesta fase para ESTE cliente.
- Sem gerúndios pendurados no fim. Sem "agregando valor".

═══════════════════════════════════════════════════════════
EXEMPLO DO QUE NÃO QUEREMOS (texto típico de IA — NÃO ESCREVA ASSIM):
═══════════════════════════════════════════════════════════
"Foi um prazer conversar com você sobre o projeto. Este documento detalha o escopo, cronograma e investimento para a criação de uma identidade visual estratégica e transformadora, alinhada ao posicionamento inovador da empresa no mercado. O objetivo é entregar uma marca robusta que comunique excelência, confiança e agregue valor ao ecossistema do cliente."

❌ "estratégica e transformadora", "posicionamento inovador", "robusta", "comunique excelência, confiança e agregue valor", "ecossistema" — tudo lixo de IA.

═══════════════════════════════════════════════════════════
EXEMPLO DO QUE QUEREMOS (texto humano):
═══════════════════════════════════════════════════════════
"Foi um prazer conversar com você, Rafael. A Lurie Labs cria produtos digitais para empresas B2B em fase de validação, e a marca atual ainda carrega ruído da fase anterior. Este orçamento cobre o redesenho completo da identidade visual."

✓ Concreto (B2B, fase de validação, ruído da fase anterior). ✓ Frases curtas. ✓ Sem palavras-de-IA.

═══════════════════════════════════════════════════════════
RESPOSTA: APENAS JSON válido, sem markdown, sem comentários.
═══════════════════════════════════════════════════════════
{
  "header": { "body": "abertura personalizada" },
  "phases": {
    "phases": [
      { "number": "igual ao template", "title": "igual ao template", "duration": "igual ao template", "description": "descrição concreta" }
    ]
  }
}`

  try {
    const msg = await anthropic.messages.create({
      model: 'claude-haiku-4-5',
      max_tokens: 2000,
      messages: [{ role: 'user', content: prompt }],
    })

    const raw = msg.content[0]
    if (raw.type !== 'text') throw new Error('unexpected response type')

    // Extract JSON — model should return only JSON but just in case
    const match = raw.text.match(/\{[\s\S]*\}/)
    if (!match) throw new Error('no JSON in response')

    const parsed = JSON.parse(match[0]) as GenerateResponse['content_overrides']

    // Validate shape loosely
    if (!parsed.header?.body || !Array.isArray(parsed.phases?.phases)) {
      throw new Error('invalid response shape')
    }

    return NextResponse.json({ content_overrides: parsed })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'AI generation failed'
    console.error('Proposal AI generation error:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
