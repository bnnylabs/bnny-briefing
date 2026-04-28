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
    client_name?: string
    context?: string
    url?: string
  }
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { template_id, client_company, context, url } = body
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

  const prompt = `Você é um assistente de uma agência criativa chamada Bnny Labs, especializada em identidade visual, design digital e gestão de redes sociais. Você auxilia na criação de propostas comerciais profissionais em português brasileiro.

Personalize os textos desta proposta para o cliente "${client_company ?? 'o cliente'}".

CONTEXTO FORNECIDO PELO OWNER:
${contextBlock}

TEXTOS BASE DO TEMPLATE (adaptar para este cliente):

Texto de abertura base:
"${baseHeader}"

Fases base:
${basePhases.map((p) => `${p.number} — ${p.title} (${p.duration}): ${p.description}`).join('\n')}

INSTRUÇÕES:
1. Reescreva o texto de abertura usando detalhes específicos do contexto. Mantenha o tom profissional e caloroso. Máximo de 3 frases. Comece mencionando o cliente pelo nome.
2. Reescreva as DESCRIÇÕES das fases tornando-as mais específicas para este projeto. Mantenha os títulos, números e durações EXATAMENTE iguais ao template — mude só a descrição.
3. Retorne APENAS JSON válido, sem markdown, sem texto adicional.

JSON esperado:
{
  "header": { "body": "texto personalizado de abertura" },
  "phases": {
    "phases": [
      { "number": "1.0", "title": "igual ao template", "duration": "igual ao template", "description": "descrição personalizada" }
    ]
  }
}`

  try {
    const msg = await anthropic.messages.create({
      model: 'claude-haiku-4-5',
      max_tokens: 1500,
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
