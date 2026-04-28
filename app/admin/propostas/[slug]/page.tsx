import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getProposalBySlug, listBlocks } from '@/lib/proposals'
import { formatProposalNumber } from '@/lib/proposal-types'
import { ProposalEditor } from '@/components/admin/proposals/ProposalEditor'

/**
 * Proposal editor — Phase 2a.
 *
 * Server component fetches the proposal + its blocks, then hands off to the
 * client `ProposalEditor` for the actual editing UI. We render server-side
 * to avoid loading-flicker on the editable header.
 */

interface PageProps {
  params: Promise<{ slug: string }>
}

/**
 * Browser tab title — '#008 · Identidade Visual · Bnny Labs'.
 *
 * Reuses getProposalBySlug; Next.js dedupes overlapping data fetches in
 * the same request via React's cache, so this is effectively free
 * relative to the page's own fetch.
 */
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

  const blocks = await listBlocks(proposal.id)

  return <ProposalEditor initialProposal={proposal} initialBlocks={blocks} />
}
