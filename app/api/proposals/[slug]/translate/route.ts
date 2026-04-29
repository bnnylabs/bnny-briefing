import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'
import { getProposalBySlug, listBlocks, logProposalActivity } from '@/lib/proposals'
import {
  computeContentHash,
  translateBlock,
  translateProposalScalars,
  type Lang,
  type ProposalScalars,
  type TranslateBlockResult,
  type TranslationsByLang,
  type TranslationsMetaByLang,
} from '@/lib/translate'
import type { ProposalBlock, ProposalBlockContent } from '@/lib/proposal-types'

/**
 * POST /api/proposals/[slug]/translate
 *
 * Traduz uma proposta INTEIRA pra outro idioma — todos os blocks visíveis
 * + scalars top-level (title + payment_terms da proposta). Esse é o
 * endpoint que o botão master "Traduzir tudo" do editor vai chamar.
 *
 * Body:
 *   { targetLang: 'pt-BR' | 'en-US', force?: boolean }
 *
 * Comportamento:
 *   - Blocks que já estão fresh são pulados (a menos que force=true)
 *   - Blocks invisíveis são pulados sempre (não vão pra recipient view,
 *     então não vale o token gasto)
 *   - Tradução dos blocks roda em PARALELO via Promise.allSettled —
 *     reportamos parciais em vez de abortar tudo se um bloco falhar
 *   - Persistência é por bloco (UPDATE individual) + um UPDATE final na
 *     proposta com os scalars. Ordem: blocks primeiro, scalars depois.
 *   - Registra evento 'translated' em proposal_activity com o resumo
 *
 * Response 200:
 *   {
 *     ok: true,
 *     summary: {
 *       targetLang,
 *       sourceLang,
 *       blocks: { translated: N, skipped_fresh: N, skipped_invisible: N, failed: N },
 *       scalars: 'translated' | 'skipped_fresh' | 'failed'
 *     },
 *     errors?: [{ blockId?, message }]   // presente quando há falhas parciais
 *   }
 */

export const maxDuration = 60

interface Ctx {
  params: Promise<{ slug: string }>
}

const VALID_LANGS: Lang[] = ['pt-BR', 'en-US']

interface BlockRow extends ProposalBlock {
  translations: TranslationsByLang<ProposalBlockContent>
  translations_meta: TranslationsMetaByLang
}

export async function POST(req: NextRequest, { params }: Ctx) {
  const unauthorized = requireAuth(req)
  if (unauthorized) return unauthorized

  const { slug } = await params

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
  const force = body.force === true

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

  const sourceLang = proposal.language

  // ─── 1. Blocks ──────────────────────────────────────────────────────
  let blocks: BlockRow[]
  try {
    blocks = (await listBlocks(proposal.id)) as BlockRow[]
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Failed to list blocks'
    return NextResponse.json({ error: message }, { status: 500 })
  }

  // Decisão por bloco: skip / translate. Invisíveis pulam sempre.
  // Visíveis pulam se já fresh e !force.
  type BlockPlan =
    | { kind: 'skip-invisible'; block: BlockRow }
    | { kind: 'skip-fresh'; block: BlockRow }
    | { kind: 'translate'; block: BlockRow }

  const plans: BlockPlan[] = blocks.map((block) => {
    if (!block.visible) return { kind: 'skip-invisible', block }
    if (!force) {
      const existing = block.translations?.[targetLang]
      const existingMeta = block.translations_meta?.[targetLang]
      if (
        existing &&
        existingMeta &&
        computeContentHash(block.content) === existingMeta.source_hash
      ) {
        return { kind: 'skip-fresh', block }
      }
    }
    return { kind: 'translate', block }
  })

  // Tradução paralela. Promise.allSettled pra que uma falha não derrube
  // o conjunto — reportamos parciais. Cap implícito de paralelismo é o
  // número de blocks (tipicamente 5-8), confortável pra rate limit do Haiku.
  const toTranslate = plans.filter(
    (p): p is Extract<BlockPlan, { kind: 'translate' }> => p.kind === 'translate',
  )

  const translationResults = await Promise.allSettled(
    toTranslate.map((p) =>
      translateBlock(
        { type: p.block.type, content: p.block.content },
        sourceLang,
        targetLang,
      ),
    ),
  )

  // Persiste cada bloco que foi traduzido com sucesso. Updates rodam
  // sequencialmente — Supabase JS lib não tem batch, e fazer N updates
  // paralelos contra o mesmo schema é menos previsível que sequencial.
  const errors: Array<{ blockId?: string; message: string }> = []
  let translatedCount = 0

  for (let i = 0; i < toTranslate.length; i++) {
    const plan = toTranslate[i]
    const result = translationResults[i]

    if (result.status === 'rejected') {
      const message =
        result.reason instanceof Error ? result.reason.message : 'AI failure'
      errors.push({ blockId: plan.block.id, message })
      continue
    }

    const tr: TranslateBlockResult = result.value

    const newTranslations: TranslationsByLang<ProposalBlockContent> = {
      ...(plan.block.translations ?? {}),
      [targetLang]: tr.translated,
    }
    const newMeta: TranslationsMetaByLang = {
      ...(plan.block.translations_meta ?? {}),
      [targetLang]: tr.meta,
    }

    const { error: updErr } = await supabaseAdmin
      .from('proposal_blocks')
      .update({ translations: newTranslations, translations_meta: newMeta })
      .eq('id', plan.block.id)

    if (updErr) {
      errors.push({ blockId: plan.block.id, message: updErr.message })
      continue
    }

    translatedCount++
  }

  // ─── 2. Scalars top-level (title + payment_terms da proposta) ────────
  let scalarsStatus: 'translated' | 'skipped_fresh' | 'failed' = 'failed'

  const proposalScalars: ProposalScalars = {
    title: proposal.title,
    payment_terms: proposal.payment_terms ?? [],
  }

  // Read current translations columns from the raw proposals row —
  // getProposalBySlug returns ProposalWithClient, que pode não trazer
  // os campos translations*. Refetch enxuto.
  const { data: propRaw, error: propErr } = await supabaseAdmin
    .from('proposals')
    .select('translations, translations_meta')
    .eq('id', proposal.id)
    .maybeSingle()

  if (propErr || !propRaw) {
    errors.push({
      message: `Failed to read proposal translations: ${propErr?.message ?? 'not found'}`,
    })
  } else {
    const currentTranslations = (propRaw.translations ??
      {}) as TranslationsByLang<ProposalScalars>
    const currentMeta = (propRaw.translations_meta ?? {}) as TranslationsMetaByLang

    const existingMeta = currentMeta[targetLang]
    const isFresh =
      !force &&
      existingMeta &&
      computeContentHash(proposalScalars) === existingMeta.source_hash

    if (isFresh) {
      scalarsStatus = 'skipped_fresh'
    } else {
      try {
        const { translated, meta } = await translateProposalScalars(
          proposalScalars,
          sourceLang,
          targetLang,
        )
        const newTranslations: TranslationsByLang<ProposalScalars> = {
          ...currentTranslations,
          [targetLang]: translated,
        }
        const newMeta: TranslationsMetaByLang = {
          ...currentMeta,
          [targetLang]: meta,
        }
        const { error: updErr } = await supabaseAdmin
          .from('proposals')
          .update({ translations: newTranslations, translations_meta: newMeta })
          .eq('id', proposal.id)
        if (updErr) {
          errors.push({ message: `Scalars update failed: ${updErr.message}` })
        } else {
          scalarsStatus = 'translated'
        }
      } catch (e) {
        const message = e instanceof Error ? e.message : 'Scalars AI failure'
        errors.push({ message })
      }
    }
  }

  // ─── 3. Activity log ────────────────────────────────────────────────
  const summary = {
    targetLang,
    sourceLang,
    blocks: {
      translated: translatedCount,
      skipped_fresh: plans.filter((p) => p.kind === 'skip-fresh').length,
      skipped_invisible: plans.filter((p) => p.kind === 'skip-invisible').length,
      failed: errors.filter((e) => e.blockId).length,
    },
    scalars: scalarsStatus,
  }

  try {
    await logProposalActivity(proposal.id, 'translated', 'admin', {
      ...summary,
      forced: force,
    })
  } catch {
    // ignore
  }

  return NextResponse.json({
    ok: true,
    summary,
    ...(errors.length > 0 ? { errors } : {}),
  })
}
