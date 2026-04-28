import { notFound } from 'next/navigation'
import { getProposalBySlug, listBlocks } from '@/lib/proposals'
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

export default async function ProposalEditorPage({ params }: PageProps) {
  const { slug } = await params
  const proposal = await getProposalBySlug(slug)
  if (!proposal) notFound()

  const blocks = await listBlocks(proposal.id)

  return <ProposalEditor initialProposal={proposal} initialBlocks={blocks} />
}
