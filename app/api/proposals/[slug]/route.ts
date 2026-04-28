import { NextRequest, NextResponse } from 'next/server'
import { getProposalBySlug, updateProposal, type UpdateProposalPatch } from '@/lib/proposals'
import { isAuthed } from '@/lib/auth'

interface Ctx {
  params: Promise<{ slug: string }>
}

/** Fetch a single proposal — useful for refreshes after editor saves. */
export async function GET(req: NextRequest, { params }: Ctx) {
  if (!isAuthed(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const { slug } = await params
  try {
    const proposal = await getProposalBySlug(slug)
    if (!proposal) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json({ proposal })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

/**
 * PATCH — update top-level proposal meta. Only fields in UpdateProposalPatch
 * are accepted; anything else is ignored. The editor uses this for
 * title/validity/total/etc auto-save.
 */
export async function PATCH(req: NextRequest, { params }: Ctx) {
  if (!isAuthed(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const { slug } = await params

  let body: Partial<UpdateProposalPatch>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  try {
    const proposal = await getProposalBySlug(slug)
    if (!proposal) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    // Whitelist of accepted fields — protects from clients sending
    // server-managed columns like id, slug, number, created_at.
    const patch: UpdateProposalPatch = {}
    if ('title' in body) patch.title = body.title
    if ('language' in body) patch.language = body.language
    if ('status' in body) patch.status = body.status
    if ('valid_until' in body) patch.valid_until = body.valid_until
    if ('total_amount' in body) patch.total_amount = body.total_amount
    if ('currency' in body) patch.currency = body.currency
    if ('payment_terms' in body) patch.payment_terms = body.payment_terms
    if ('internal_notes' in body) patch.internal_notes = body.internal_notes
    if ('public_settings' in body) patch.public_settings = body.public_settings
    // Advanced edits — used by the 'Trocar cliente / Trocar modelo' menu
    // in the editor. Distinct path from regular meta auto-save.
    if ('client_id' in body) patch.client_id = body.client_id
    if ('template_id' in body) patch.template_id = body.template_id

    // Auto-stamp sent_at on the first draft → sent transition.
    // The client trusts the server's clock — never honor a sent_at
    // sent by the request body.
    if (patch.status === 'sent' && proposal.status === 'draft' && !proposal.sent_at) {
      patch.sent_at = new Date().toISOString()
    }

    await updateProposal(proposal.id, patch)

    // Re-fetch with the client join — keeps the editor's local state in
    // sync after edits that change relations (client_id, template_id).
    // For meta-only edits this is one extra query, but it keeps the
    // response shape consistent across all PATCH paths.
    const refreshed = await getProposalBySlug(slug)
    return NextResponse.json({ proposal: refreshed })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
