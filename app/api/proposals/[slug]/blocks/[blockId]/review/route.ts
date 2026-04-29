import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'
import { getProposalBySlug, logProposalActivity } from '@/lib/proposals'
import { reviewBlock, type ReviewFoco } from '@/lib/review'
import type { ProposalBlock } from '@/lib/proposal-types'

/**
 * POST /api/proposals/[slug]/blocks/[blockId]/review
 *
 * Revisão de UM bloco com IA. NÃO troca idioma (isso é translate.ts) —
 * apenas melhora o texto: clareza, concisão, tom, anti-cliché em PT-BR.
 *
 * Body:
 *   {
 *     foco?: 'all' | 'concisao' | 'clareza' | 'tom',
 *     instruction?: string  // opcional, ex: "deixa mais formal"
 *   }
 *
 * Response 200:
 *   {
 *     ok: true,
 *     original: ProposalBlockContent,
 *     revised: ProposalBlockContent,
 *     changedCount: number,
 *     totalCount: number,
 *   }
 *
 * NÃO persiste. O cliente recebe a sugestão, mostra diff, e o operador
 * decide aplicar via PATCH /api/proposals/[slug]/blocks/[blockId] normal.
 *
 * Erros:
 *   401 — não autenticado
 *   400 — body inválido
 *   404 — proposta ou bloco não existem
 *   502 — IA falhou
 *   500 — erro de banco
 */

export const maxDuration = 60

const VALID_FOCO: ReviewFoco[] = ['all', 'concisao', 'clareza', 'tom']

interface Ctx {
  params: Promise<{ slug: string; blockId: string }>
}

interface PostBody {
  foco?: string
  instruction?: string
}

export async function POST(req: NextRequest, { params }: Ctx) {
  const unauthorized = requireAuth(req)
  if (unauthorized) return unauthorized

  const { slug, blockId } = await params

  let body: PostBody
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const foco = (body.foco ?? 'all') as ReviewFoco
  if (!VALID_FOCO.includes(foco)) {
    return NextResponse.json(
      { error: `foco inválido. Use um de: ${VALID_FOCO.join(', ')}` },
      { status: 400 },
    )
  }

  const instruction = body.instruction?.trim()
  if (instruction && instruction.length > 1000) {
    return NextResponse.json(
      { error: 'instruction acima de 1000 chars' },
      { status: 400 },
    )
  }

  const proposal = await getProposalBySlug(slug)
  if (!proposal) {
    return NextResponse.json({ error: 'Proposal not found' }, { status: 404 })
  }

  // Valida que o bloco pertence a esta proposta — mesmo padrão do POST
  // de tradução. Não vazamos blocos alheios via slug+blockId mismatch.
  const { data: blockRow, error: blockErr } = await supabaseAdmin
    .from('proposal_blocks')
    .select('*')
    .eq('id', blockId)
    .eq('proposal_id', proposal.id)
    .maybeSingle()

  if (blockErr) {
    return NextResponse.json({ error: blockErr.message }, { status: 500 })
  }
  if (!blockRow) {
    return NextResponse.json({ error: 'Block not found' }, { status: 404 })
  }
  const block = blockRow as ProposalBlock

  let result
  try {
    result = await reviewBlock(
      { type: block.type, content: block.content },
      proposal.language,
      { foco, instruction },
    )
  } catch (e) {
    const message = e instanceof Error ? e.message : 'AI review failed'
    return NextResponse.json({ error: message }, { status: 502 })
  }

  // Activity log — 'reviewed' não é tão hot quanto 'translated', mas
  // ajuda quando o operador quer rastrear o que a IA andou mexendo.
  // Não bloqueia a resposta.
  try {
    await logProposalActivity(proposal.id, 'block_reviewed', 'admin', {
      block_id: blockId,
      block_type: block.type,
      foco,
      changed_count: result.changedCount,
      total_count: result.totalCount,
      with_instruction: Boolean(instruction),
    })
  } catch {
    // ignore — log é nice-to-have
  }

  return NextResponse.json({
    ok: true,
    original: result.original,
    revised: result.revised,
    changedCount: result.changedCount,
    totalCount: result.totalCount,
  })
}
