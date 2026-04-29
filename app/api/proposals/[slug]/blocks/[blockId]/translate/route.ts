import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'
import { getProposalBySlug, logProposalActivity } from '@/lib/proposals'
import {
  computeContentHash,
  translateBlock,
  type Lang,
  type TranslationMeta,
  type TranslationsByLang,
  type TranslationsMetaByLang,
} from '@/lib/translate'
import type { ProposalBlock, ProposalBlockContent } from '@/lib/proposal-types'

/**
 * POST /api/proposals/[slug]/blocks/[blockId]/translate
 *
 * Traduz UM bloco específico pra outro idioma. Útil quando:
 *   - O operador editou só esse bloco e a tradução ficou stale
 *   - Quer retraduzir só uma fase pontual sem mexer no resto
 *
 * Body:
 *   { targetLang: 'pt-BR' | 'en-US', force?: boolean }
 *
 * Comportamento:
 *   - 404 se a proposta ou o bloco não existirem
 *   - 400 se targetLang === source da proposta
 *   - Se já há tradução fresh e force !== true, devolve 200 sem chamar a IA
 *   - Persiste o resultado em proposal_blocks.translations[targetLang]
 *     + proposal_blocks.translations_meta[targetLang]
 *   - Registra evento 'block_translated' em proposal_activity
 */

// Vercel: dá tempo pra IA responder com folga
export const maxDuration = 60

interface Ctx {
  params: Promise<{ slug: string; blockId: string }>
}

const VALID_LANGS: Lang[] = ['pt-BR', 'en-US']

export async function POST(req: NextRequest, { params }: Ctx) {
  const unauthorized = requireAuth(req)
  if (unauthorized) return unauthorized

  const { slug, blockId } = await params

  let body: { targetLang?: string; force?: boolean }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const targetLang = body.targetLang as Lang | undefined
  if (!targetLang || !VALID_LANGS.includes(targetLang)) {
    return NextResponse.json(
      { error: `targetLang must be one of: ${VALID_LANGS.join(', ')}` },
      { status: 400 },
    )
  }

  const proposal = await getProposalBySlug(slug)
  if (!proposal) {
    return NextResponse.json({ error: 'Proposal not found' }, { status: 404 })
  }

  if (targetLang === proposal.language) {
    return NextResponse.json(
      { error: 'targetLang equals source language — nothing to translate' },
      { status: 400 },
    )
  }

  // Busca o bloco e valida que pertence à proposta. Se a UI passar um
  // blockId estranho (ou de outra proposta), 404 — não vazamos blocos
  // alheios via slug+blockId mismatch.
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
  const block = blockRow as ProposalBlock & {
    translations: TranslationsByLang<ProposalBlockContent>
    translations_meta: TranslationsMetaByLang
  }

  // Caminho rápido: já existe tradução fresh e o caller não pediu force
  // → economia de tokens. Devolve 200 com flag explicando.
  if (!body.force) {
    const existing = block.translations?.[targetLang]
    const existingMeta = block.translations_meta?.[targetLang]
    if (
      existing &&
      existingMeta &&
      computeContentHash(block.content) === existingMeta.source_hash
    ) {
      return NextResponse.json({
        ok: true,
        skipped: 'fresh',
        block,
      })
    }
  }

  let translated: ProposalBlockContent
  let meta: TranslationMeta
  try {
    const result = await translateBlock(
      { type: block.type, content: block.content },
      proposal.language,
      targetLang,
    )
    translated = result.translated
    meta = result.meta
  } catch (e) {
    const message = e instanceof Error ? e.message : 'AI translation failed'
    return NextResponse.json({ error: message }, { status: 502 })
  }

  // Merge — preserva traduções de outros idiomas que possam existir.
  const newTranslations: TranslationsByLang<ProposalBlockContent> = {
    ...(block.translations ?? {}),
    [targetLang]: translated,
  }
  const newMeta: TranslationsMetaByLang = {
    ...(block.translations_meta ?? {}),
    [targetLang]: meta,
  }

  const { data: updated, error: updErr } = await supabaseAdmin
    .from('proposal_blocks')
    .update({
      translations: newTranslations,
      translations_meta: newMeta,
    })
    .eq('id', blockId)
    .select('*')
    .maybeSingle()

  if (updErr || !updated) {
    return NextResponse.json(
      { error: updErr?.message ?? 'Update failed' },
      { status: 500 },
    )
  }

  // Activity log — não bloqueia a resposta se falhar
  try {
    await logProposalActivity(proposal.id, 'block_translated', 'admin', {
      block_id: blockId,
      block_type: block.type,
      target_lang: targetLang,
      source_lang: proposal.language,
      model: meta.model,
      forced: body.force === true,
    })
  } catch {
    // ignore — log de atividade é nice-to-have
  }

  return NextResponse.json({ ok: true, block: updated })
}
