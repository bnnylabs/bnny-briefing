import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { supabaseAdmin } from '@/lib/supabase'
import type { ProposalTemplate } from '@/lib/proposal-types'

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

function isAuthed(req: NextRequest) {
  const cookie = req.cookies.get('bnny_auth')
  return cookie?.value === (process.env.ADMIN_PASSWORD || 'bnny2024')
}

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

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
    client_company?: string
    client_contact_name?: string | null
    context?: string
    url?: string
  }
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { template_id, client_company, client_contact_name, context, url } = body
  if (!context?.trim() && !url?.trim()) {
    return NextResponse.json({ error: 'context or url is required' }, { status: 400 })
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

  // Optionally enrich context with URL content
  let urlContent = ''
  if (url?.trim()) {
    const fetched = await fetchUrlText(url.trim())
    if (fetched) urlContent = `\n\nConteúdo do site/rede social do cliente:\n${fetched}`
  }

  const contextBlock = [context?.trim(), urlContent].filter(Boolean).join('\n')

  // Determine how to address the client contact
  const addressee = client_contact_name?.trim()
    ? `você, ${client_contact_name.trim()}`
    : 'você'

  const prompt = `Você é redator de uma agência criativa chamada Bnny Labs. Escreve propostas comerciais em português brasileiro com tom profissional, direto e humano — sem clichês corporativos.

CLIENTE: ${client_company ?? 'o cliente'}
${client_contact_name ? `CONTATO PRINCIPAL: ${client_contact_name}` : ''}

CONTEXTO DO PROJETO:
${contextBlock}

TEMPLATE BASE (adaptar para este cliente específico):

Abertura base:
"${baseHeader}"

Fases:
${basePhases.map((p) => `${p.number} — ${p.title} (${p.duration}): ${p.description}`).join('\n')}

INSTRUÇÕES DE ESCRITA:
1. Reescreva a ABERTURA com máximo de 2-3 frases. Comece com "Foi um prazer conversar com ${addressee}." e adicione UMA frase específica sobre o negócio do cliente (use detalhes concretos do contexto, não generalidades). Termine com o objetivo principal do projeto.
2. Evite: "excelência", "inovação", "transformação", "soluções", listas de 3 adjetivos, linguagem corporativa genérica.
3. Reescreva as DESCRIÇÕES das fases tornando-as concretas para este cliente. Mantenha títulos, números e durações EXATAMENTE iguais.
4. Retorne APENAS JSON válido, sem markdown.

JSON:
{
  "header": { "body": "abertura personalizada" },
  "phases": {
    "phases": [
      { "number": "1.0", "title": "igual ao template", "duration": "igual ao template", "description": "descrição personalizada e concreta" }
    ]
  }
}`

  try {
    const msg = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
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
