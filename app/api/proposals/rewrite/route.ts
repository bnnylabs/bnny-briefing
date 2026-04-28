import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { supabaseAdmin } from '@/lib/supabase'

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

function isAuthed(req: NextRequest) {
  const cookie = req.cookies.get('bnny_auth')
  return cookie?.value === (process.env.ADMIN_PASSWORD || 'bnny2024')
}

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

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

  const prompt = `Você é redator da Bnny Labs. Reescreve o trecho abaixo em português brasileiro mantendo o sentido, mas com tom mais humano e profissional. NÃO escreve como IA.

═══════════════════════════════════════════════════════════
CONTEXTO DESTE CAMPO
═══════════════════════════════════════════════════════════
${KIND_INSTRUCTIONS[kind]}

${clientContext ? `═══════════════════════════════════════════════════════════
SOBRE O CLIENTE
═══════════════════════════════════════════════════════════
${clientContext}\n` : ''}${body.extra_context ? `═══════════════════════════════════════════════════════════
INSTRUÇÃO ADICIONAL DO OWNER
═══════════════════════════════════════════════════════════
${body.extra_context}\n` : ''}═══════════════════════════════════════════════════════════
PROIBIDO usar
═══════════════════════════════════════════════════════════
- Palavras de IA: robusto, alavancar, potencializar, engajamento, empoderar, disruptivo, sinergia, holístico, ecossistema, jornada, imersivo, transformador, estratégico, escalável, inovador, destravar, "agregar valor", "elevar a outro patamar", excelência, inovação, transformação, soluções
- Conectores expositivos: "Vale ressaltar", "É importante destacar", "Nesse sentido", "Diante disso", "Em suma", "No fim das contas", "A verdade é que"
- Inflação: "marca um momento crucial", "consolida-se como referência", "papel fundamental"
- Perífrases formais: "no que tange a", "tendo em vista que", "a fim de" (use "sobre", "como", "para")
- Gerúndios pendurados: "destacando-se", "evidenciando", "agregando valor", "contribuindo para"
- Listas de 3 adjetivos seguidos
- Mesóclise artificial ("dar-se-á", "far-se-á")
- Servilismo ("Excelente!", "Espero ter ajudado")

═══════════════════════════════════════════════════════════
TRECHO ORIGINAL
═══════════════════════════════════════════════════════════
${text}

═══════════════════════════════════════════════════════════
RESPONDA APENAS com o texto reescrito. Sem markdown, sem aspas envolventes, sem comentários, sem prefácio. Só o texto puro.
═══════════════════════════════════════════════════════════`

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
