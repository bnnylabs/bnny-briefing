/**
 * Server-side proposal helpers — Phase 1 of v0.10.
 *
 * Use only from server contexts (API routes, server components). Imports
 * supabaseAdmin which holds the service key.
 */

import { supabaseAdmin } from '@/lib/supabase'
import {
  generateProposalSlug,
  type PaymentTerm,
  type Proposal,
  type ProposalActivityActor,
  type ProposalBlock,
  type ProposalBlockContent,
  type ProposalBlockType,
  type ProposalLanguage,
  type ProposalStatus,
  type ProposalTemplate,
  type ProposalWithClient,
} from '@/lib/proposal-types'

/**
 * Position step used when appending blocks. We use LEXORANK-style fractional
 * ordering: instead of 0,1,2… we use 1024,2048,3072… so reordering by
 * dropping a block between two others can pick the midpoint without
 * renumbering every row. See positionBetween() below.
 */
const POSITION_STEP = 1024

// ─── Read ────────────────────────────────────────────────────────────────

/** List all proposals, newest first, joined with client basic fields. */
export async function listProposals(): Promise<ProposalWithClient[]> {
  const { data, error } = await supabaseAdmin
    .from('proposals')
    .select(
      `
      *,
      clients (
        id, name, company, email, avatar_url
      )
    `,
    )
    .order('number', { ascending: false })

  if (error) throw new Error(error.message)
  return (data ?? []) as ProposalWithClient[]
}

/** Fetch a single proposal by slug, joined with client. Returns null if missing. */
export async function getProposalBySlug(
  slug: string,
): Promise<ProposalWithClient | null> {
  const { data, error } = await supabaseAdmin
    .from('proposals')
    .select(
      `
      *,
      clients (
        id, name, company, email, avatar_url
      )
    `,
    )
    .eq('slug', slug)
    .maybeSingle()

  if (error) throw new Error(error.message)
  return (data as ProposalWithClient) ?? null
}

// ─── Create ──────────────────────────────────────────────────────────────

export interface CreateProposalInput {
  client_id: string
  title: string
  language?: ProposalLanguage
  valid_until?: string | null // ISO date "YYYY-MM-DD"
  briefing_id?: string | null
  template_id?: string | null
}

/**
 * Create a draft proposal. The `number` is assigned atomically by the
 * Postgres sequence — no risk of duplicates under concurrent inserts.
 *
 * If `template_id` is provided, the proposal is hydrated:
 *   - default_blocks → inserted into proposal_blocks (positions preserved)
 *   - default_payment_terms → set on proposals.payment_terms
 *
 * Hydration failures don't fail the proposal — the proposal still gets
 * created and the owner can add blocks manually. We log the failure to
 * proposal_activity for visibility.
 */
export async function createProposal(
  input: CreateProposalInput,
): Promise<Proposal> {
  // Look up the template first so we can apply its payment_terms on the
  // initial INSERT (avoids a follow-up UPDATE).
  let template: ProposalTemplate | null = null
  if (input.template_id) {
    template = await getTemplateById(input.template_id)
    // If template_id was provided but missing, treat as blank — don't fail.
    // The proposal is more important than the template link.
  }

  const slug = generateProposalSlug(input.title)

  const { data, error } = await supabaseAdmin
    .from('proposals')
    .insert({
      slug,
      client_id: input.client_id,
      title: input.title.trim(),
      language: input.language ?? 'pt-BR',
      valid_until: input.valid_until ?? null,
      briefing_id: input.briefing_id ?? null,
      template_id: template?.id ?? null,
      status: 'draft',
      payment_terms: template?.default_payment_terms ?? [],
    })
    .select()
    .single()

  if (error) throw new Error(error.message)
  const proposal = data as Proposal

  // Hydrate blocks from template if present.
  if (template && Array.isArray(template.default_blocks) && template.default_blocks.length > 0) {
    const rows = template.default_blocks.map((b, i) => ({
      proposal_id: proposal.id,
      type: b.type,
      // Fall back to LEXORANK-style positions if the template didn't include them.
      position: typeof b.position === 'number' ? b.position : (i + 1) * 1024,
      content: b.content ?? {},
      visible: b.visible ?? true,
    }))
    const { error: blocksErr } = await supabaseAdmin.from('proposal_blocks').insert(rows)
    if (blocksErr) {
      console.error('Failed to hydrate template blocks:', blocksErr)
    }
  }

  await logProposalActivity(proposal.id, 'created', 'admin', {
    title: input.title,
    template_id: template?.id ?? null,
    template_name: template?.name ?? null,
  }).catch((e) => console.error('proposal_activity log failed:', e))

  return proposal
}

// ─── Templates ───────────────────────────────────────────────────────────

/** List all templates, defaults first, then alphabetical. */
export async function listTemplates(): Promise<ProposalTemplate[]> {
  const { data, error } = await supabaseAdmin
    .from('proposal_templates')
    .select('*')
    .order('is_default', { ascending: false })
    .order('name', { ascending: true })

  if (error) throw new Error(error.message)
  return (data ?? []) as ProposalTemplate[]
}

export async function getTemplateById(
  id: string,
): Promise<ProposalTemplate | null> {
  const { data, error } = await supabaseAdmin
    .from('proposal_templates')
    .select('*')
    .eq('id', id)
    .maybeSingle()

  if (error) throw new Error(error.message)
  return (data as ProposalTemplate) ?? null
}

// ─── Activity ────────────────────────────────────────────────────────────

export async function logProposalActivity(
  proposalId: string,
  event: string,
  actorType: ProposalActivityActor = 'system',
  details: Record<string, unknown> = {},
): Promise<void> {
  const { error } = await supabaseAdmin.from('proposal_activity').insert({
    proposal_id: proposalId,
    event,
    actor_type: actorType,
    details,
  })
  if (error) throw new Error(error.message)
}

// ─── Update proposal meta ────────────────────────────────────────────────

/** Patch shape — only top-level proposal fields the editor mutates. */
export interface UpdateProposalPatch {
  title?: string
  language?: ProposalLanguage
  status?: ProposalStatus
  valid_until?: string | null
  total_amount?: number
  currency?: string
  payment_terms?: PaymentTerm[]
  internal_notes?: string | null
  public_settings?: Record<string, unknown>
}

/**
 * Update a proposal's meta. The DB trigger updates `updated_at` automatically.
 * Returns the updated row, or throws on error.
 */
export async function updateProposal(
  id: string,
  patch: UpdateProposalPatch,
): Promise<Proposal> {
  // Strip undefined keys so we don't accidentally null columns
  const clean: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(patch)) {
    if (v !== undefined) clean[k] = v
  }

  const { data, error } = await supabaseAdmin
    .from('proposals')
    .update(clean)
    .eq('id', id)
    .select()
    .single()

  if (error) throw new Error(error.message)
  return data as Proposal
}

// ─── Block helpers ────────────────────────────────────────────────────────

export async function listBlocks(proposalId: string): Promise<ProposalBlock[]> {
  const { data, error } = await supabaseAdmin
    .from('proposal_blocks')
    .select('*')
    .eq('proposal_id', proposalId)
    .order('position', { ascending: true })

  if (error) throw new Error(error.message)
  return (data ?? []) as ProposalBlock[]
}

/**
 * Compute next position when appending a block. Returns POSITION_STEP if no
 * blocks exist, else max(position) + POSITION_STEP.
 */
async function nextAppendPosition(proposalId: string): Promise<number> {
  const { data, error } = await supabaseAdmin
    .from('proposal_blocks')
    .select('position')
    .eq('proposal_id', proposalId)
    .order('position', { ascending: false })
    .limit(1)

  if (error) throw new Error(error.message)
  const max = data?.[0]?.position ?? 0
  return max + POSITION_STEP
}

/** Compute the midpoint between two positions for inserting between them. */
export function positionBetween(before: number, after: number): number {
  return Math.floor((before + after) / 2)
}

export interface CreateBlockInput {
  proposal_id: string
  type: ProposalBlockType
  content?: ProposalBlockContent
  /** If omitted, appends to end. If given, used verbatim (caller computed via positionBetween). */
  position?: number
  visible?: boolean
}

export async function createBlock(input: CreateBlockInput): Promise<ProposalBlock> {
  const position = input.position ?? (await nextAppendPosition(input.proposal_id))

  const { data, error } = await supabaseAdmin
    .from('proposal_blocks')
    .insert({
      proposal_id: input.proposal_id,
      type: input.type,
      position,
      content: input.content ?? defaultContentForType(input.type),
      visible: input.visible ?? true,
    })
    .select()
    .single()

  if (error) throw new Error(error.message)
  return data as ProposalBlock
}

export interface UpdateBlockPatch {
  content?: ProposalBlockContent
  position?: number
  visible?: boolean
}

export async function updateBlock(
  blockId: string,
  patch: UpdateBlockPatch,
): Promise<ProposalBlock> {
  const clean: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(patch)) {
    if (v !== undefined) clean[k] = v
  }

  const { data, error } = await supabaseAdmin
    .from('proposal_blocks')
    .update(clean)
    .eq('id', blockId)
    .select()
    .single()

  if (error) throw new Error(error.message)
  return data as ProposalBlock
}

export async function deleteBlock(blockId: string): Promise<void> {
  const { error } = await supabaseAdmin
    .from('proposal_blocks')
    .delete()
    .eq('id', blockId)
  if (error) throw new Error(error.message)
}

/**
 * Default content shape for each block type — used when the editor adds a
 * fresh block. Keeps a single source of truth for "what does an empty
 * block look like".
 */
export function defaultContentForType(type: ProposalBlockType): ProposalBlockContent {
  switch (type) {
    case 'header':
      return { body: '' }
    case 'phases':
      return { phases: [] }
    case 'investment':
      return { intro: '' }
    case 'terms':
      return { body_markdown: '' }
    case 'next_steps':
      return { items: [] }
    case 'attachments':
      return { files: [] }
    case 'custom':
      return { title: '', body_markdown: '' }
  }
}
