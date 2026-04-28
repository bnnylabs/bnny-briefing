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

  const prompt = `Você é redator de uma agência criativa chamada Bnny Labs. Escreve propostas comerciais em português brasileiro com tom profissional, direto e humano. NÃO escreve como IA: nada de inflação corporativa, nada de palavras-da-moda, nada de "jornada transformadora".

CLIENTE: ${client_company ?? 'o cliente'}
${client_contact_name ? `CONTATO PRINCIPAL: ${client_contact_name}` : ''}

CONTEXTO DO PROJETO:
${contextBlock}

TEMPLATE BASE (estrutura para adaptar):

Abertura base:
"${baseHeader}"

Fases:
${basePhases.map((p) => `${p.number} — ${p.title} (${p.duration}): ${p.description}`).join('\n')}

═══════════════════════════════════════════════════════════
REGRAS DE ESCRITA (IMPORTANTÍSSIMAS — texto sai sem isto)
═══════════════════════════════════════════════════════════

PROIBIDO usar (palavras de IA em PT-BR):
- robusto, alavancar, potencializar, engajamento, empoderar, disruptivo, sinergia, holístico, ecossistema, jornada, imersivo, transformador, estratégico, escalável, inovador, destravar, desbloquear
- "elevar a outro patamar", "agregar valor", "entregar valor", "gerar valor", "outro nível"
- excelência, inovação, transformação, soluções
- vibrante, pulsante, "rico em", encanta, deslumbrante

PROIBIDO usar (conectores expositivos automáticos):
- "Vale ressaltar que", "É importante destacar que", "Cabe ressaltar"
- "Nesse sentido", "Nesse contexto", "Diante disso"
- "Em suma", "Em última análise", "Posto isso"
- "No fim das contas", "A verdade é que", "O que realmente importa"

PROIBIDO usar (inflação de significância):
- "marca um momento crucial"
- "consolida-se como referência"
- "desempenha papel fundamental/essencial"
- "representa um marco"
- "abre caminho para"

PROIBIDO usar (perífrases formais):
- "no que tange a" → use "sobre"
- "tendo em vista que" → use "como"
- "com o intuito de" / "a fim de" → use "para"
- "haja vista" → use "já que"
- "faz-se necessário" → use "é preciso"

PROIBIDO usar (gerúndios analíticos pendurados no fim de frase):
- "destacando-se", "evidenciando", "demonstrando", "consolidando"
- "agregando valor", "contribuindo para", "promovendo", "fomentando"

PROIBIDO usar (servilismo):
- "Foi um prazer", "Excelente!", "Com certeza!", "Espero ter ajudado"
- (a saudação inicial é a única exceção, vide regra abaixo)

PROIBIDO (estrutura):
- Listas de 3 adjetivos seguidos ("rápido, eficaz e moderno")
- Frases com colchetes de "X: Y" para anunciar o que vem ("A solução é simples: X")
- Mesóclise artificial ("dar-se-á", "far-se-á")
- Conclusões otimistas genéricas ("o futuro é promissor")

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
