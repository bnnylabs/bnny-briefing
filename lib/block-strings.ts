/**
 * Block content string extractors — shared between translate.ts and review.ts.
 *
 * The "extract → transform → reconstruct" pattern keeps AI-generated text
 * away from JSON shapes: we hand the model a flat array of strings, get
 * a flat array back, and stitch it into the original block structure
 * locally. Numbers, URLs, IDs, currency codes — all the non-prose data —
 * never leave Node, so the model can't accidentally break them.
 *
 * Originally lived inside lib/translate.ts. Pulled out to its own module
 * when lib/review.ts needed the same logic for AI proofreading. Both
 * features benefit from the same extractor surface — anything new is a
 * single switch case in extractBlockStrings rather than a fork.
 *
 * Extending to a new block type:
 *   1. Add an extractX function that returns { strings, reconstruct }
 *   2. Add a case to extractBlockStrings
 *   3. Done — translate + review pick it up automatically
 */

import type {
  BlockContentAttachments,
  BlockContentCustom,
  BlockContentHeader,
  BlockContentInvestment,
  BlockContentNextSteps,
  BlockContentPhases,
  BlockContentTerms,
  PaymentTerm,
  ProposalBlockContent,
  ProposalBlockType,
} from '@/lib/proposal-types'

export interface BlockStringExtractor<T extends ProposalBlockContent> {
  /** Translatable/reviewable strings in order — what gets sent to the AI. */
  strings: string[]
  /** Stitches a same-length array back into the original block shape. */
  reconstruct: (transformed: string[]) => T
}

function extractHeader(c: BlockContentHeader): BlockStringExtractor<BlockContentHeader> {
  return {
    strings: [c.body ?? ''],
    reconstruct: ([body]) => ({ body: body ?? '' }),
  }
}

function extractPhases(c: BlockContentPhases): BlockStringExtractor<BlockContentPhases> {
  const phases = Array.isArray(c.phases) ? c.phases : []
  // Cada fase contribui 3 strings: title, duration, description.
  // O `number` ("1.0", "2.0") fica intacto — não é texto de prosa.
  const strings: string[] = []
  for (const p of phases) {
    strings.push(p.title ?? '', p.duration ?? '', p.description ?? '')
  }
  return {
    strings,
    reconstruct: (t) => ({
      phases: phases.map((p, i) => ({
        number: p.number ?? '',
        title: t[i * 3] ?? '',
        duration: t[i * 3 + 1] ?? '',
        description: t[i * 3 + 2] ?? '',
        ...(p.visible !== undefined ? { visible: p.visible } : {}),
      })),
    }),
  }
}

function extractInvestment(
  c: BlockContentInvestment,
): BlockStringExtractor<BlockContentInvestment> {
  // Campos textuais: intro + cada payment_term.label e payment_term.description.
  // Números (total_amount, currency, discount_percent), URLs e tipo ficam intactos.
  const terms = Array.isArray(c.payment_terms) ? c.payment_terms : []
  const strings: string[] = [c.intro ?? '']
  for (const t of terms) {
    strings.push(t.label ?? '', (t as { description?: string }).description ?? '')
  }
  return {
    strings,
    reconstruct: (t) => ({
      intro: t[0] ?? '',
      total_amount: c.total_amount ?? 0,
      currency: c.currency ?? 'BRL',
      payment_terms: terms.map((term, i): PaymentTerm => {
        const newLabel = t[1 + i * 2] ?? term.label ?? ''
        const newDesc = t[1 + i * 2 + 1] ?? ''
        // Mantém todos os campos não-textuais do termo intactos
        return { ...term, label: newLabel, description: newDesc } as PaymentTerm
      }),
    }),
  }
}

function extractTerms(c: BlockContentTerms): BlockStringExtractor<BlockContentTerms> {
  return {
    strings: [c.body_markdown ?? ''],
    reconstruct: ([md]) => ({ body_markdown: md ?? '' }),
  }
}

function extractNextSteps(
  c: BlockContentNextSteps,
): BlockStringExtractor<BlockContentNextSteps> {
  const items = Array.isArray(c.items) ? c.items : []
  return {
    strings: [...items],
    reconstruct: (t) => ({ items: items.map((_, i) => t[i] ?? '') }),
  }
}

function extractAttachments(
  c: BlockContentAttachments,
): BlockStringExtractor<BlockContentAttachments> {
  // Anexos têm `name` (texto) e `url` (não-texto).
  const files = Array.isArray(c.files) ? c.files : []
  return {
    strings: files.map((f) => f.name ?? ''),
    reconstruct: (t) => ({
      files: files.map((f, i) => ({ name: t[i] ?? '', url: f.url ?? '' })),
    }),
  }
}

function extractCustom(c: BlockContentCustom): BlockStringExtractor<BlockContentCustom> {
  return {
    strings: [c.title ?? '', c.body_markdown ?? ''],
    reconstruct: ([title, md]) => ({
      title: title ?? '',
      body_markdown: md ?? '',
    }),
  }
}

/**
 * Dispatcher — pick the right extractor by block type.
 * Adding a new block type? Add the case here, plus the helper above.
 */
export function extractBlockStrings(
  type: ProposalBlockType,
  content: ProposalBlockContent,
): BlockStringExtractor<ProposalBlockContent> {
  switch (type) {
    case 'header':
      return extractHeader(content as BlockContentHeader) as BlockStringExtractor<ProposalBlockContent>
    case 'phases':
      return extractPhases(content as BlockContentPhases) as BlockStringExtractor<ProposalBlockContent>
    case 'investment':
      return extractInvestment(content as BlockContentInvestment) as BlockStringExtractor<ProposalBlockContent>
    case 'terms':
      return extractTerms(content as BlockContentTerms) as BlockStringExtractor<ProposalBlockContent>
    case 'next_steps':
      return extractNextSteps(content as BlockContentNextSteps) as BlockStringExtractor<ProposalBlockContent>
    case 'attachments':
      return extractAttachments(content as BlockContentAttachments) as BlockStringExtractor<ProposalBlockContent>
    case 'custom':
      return extractCustom(content as BlockContentCustom) as BlockStringExtractor<ProposalBlockContent>
  }
}
