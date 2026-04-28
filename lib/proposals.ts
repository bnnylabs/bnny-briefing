/**
 * Server-side proposal helpers — Phase 1 of v0.10.
 *
 * Use only from server contexts (API routes, server components). Imports
 * supabaseAdmin which holds the service key.
 */

import { supabaseAdmin } from '@/lib/supabase'
import {
  generateProposalSlug,
  type Proposal,
  type ProposalActivityActor,
  type ProposalLanguage,
  type ProposalWithClient,
} from '@/lib/proposal-types'

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
 * Returns the created row. Does NOT seed default blocks — that's done by
 * the editor (Phase 2) or by template hydration (Phase 4).
 */
export async function createProposal(
  input: CreateProposalInput,
): Promise<Proposal> {
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
      template_id: input.template_id ?? null,
      status: 'draft',
    })
    .select()
    .single()

  if (error) throw new Error(error.message)

  // Fire-and-forget activity log. Failure here shouldn't block creation.
  await logProposalActivity(data.id, 'created', 'admin', { title: input.title }).catch(
    (e) => console.error('proposal_activity log failed:', e),
  )

  return data as Proposal
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
