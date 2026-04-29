import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getProposalBySlug, listBlocks, getLatestDecision } from '@/lib/proposals'
import { formatProposalNumber } from '@/lib/proposal-types'
import { supabaseAdmin } from '@/lib/supabase'
import { ProposalEditor } from '@/components/admin/proposals/ProposalEditor'
import { UnrecognizedActorAlert } from '@/components/admin/proposals/UnrecognizedActorAlert'

/**
 * Proposal editor — Phase 2a, with unrecognized-actor alert (v0.10.78).
 *
 * Server component fetches the proposal + its blocks. When the proposal
 * is in a terminal state (approved/rejected), it ALSO fetches the
 * latest decision activity and the client's contact list to detect
 * whether the actor is already a known contact. If not, an alert
 * banner offers to add them with one click.
 */

interface PageProps {
  params: Promise<{ slug: string }>
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params
  const proposal = await getProposalBySlug(slug)
  if (!proposal) return { title: 'Proposta' }
  const num = formatProposalNumber(proposal.number, proposal.version_suffix)
  return {
    title: `${num} · ${proposal.title}`,
  }
}

export default async function ProposalEditorPage({ params }: PageProps) {
  const { slug } = await params
  const proposal = await getProposalBySlug(slug)
  if (!proposal) notFound()

  // Pull blocks unconditionally — needed by the editor.
  // Pull decision + contact list only when the proposal is in a
  // terminal state, where the alert can possibly fire. Saves a couple
  // of round-trips on the hot path (drafts, sent, viewed).
  const isDecided = proposal.status === 'approved' || proposal.status === 'rejected'
  const [blocks, decision, contactsRows] = await Promise.all([
    listBlocks(proposal.id),
    isDecided ? getLatestDecision(proposal.id) : Promise.resolve(null),
    isDecided
      ? supabaseAdmin
          .from('client_contacts')
          .select('email')
          .eq('client_id', proposal.client_id)
          .then((r) => (r.data ?? []) as { email: string | null }[])
      : Promise.resolve([] as { email: string | null }[]),
  ])

  // Decide whether to show the alert. Three conditions:
  //   1. Proposal is decided
  //   2. Activity row has actor email + name
  //   3. Email doesn't match any existing contact (case-insensitive)
  let showAlert = false
  if (isDecided && decision?.actor_email && decision?.actor_name) {
    const normalized = decision.actor_email.toLowerCase()
    const known = contactsRows.some(
      (c) => (c.email || '').toLowerCase() === normalized,
    )
    showAlert = !known
  }

  return (
    <>
      {showAlert && decision && (
        <div className="mx-auto max-w-7xl px-4 pt-4 sm:px-6">
          <UnrecognizedActorAlert
            clientId={proposal.client_id}
            actorName={decision.actor_name!}
            actorEmail={decision.actor_email!}
            actorLang={decision.lang}
            decisionEvent={decision.event}
          />
        </div>
      )}
      <ProposalEditor initialProposal={proposal} initialBlocks={blocks} />
    </>
  )
}
