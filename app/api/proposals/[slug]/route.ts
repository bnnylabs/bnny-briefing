import { NextRequest, NextResponse } from 'next/server'
import { getProposalBySlug, updateProposal, type UpdateProposalPatch } from '@/lib/proposals'

function isAuthed(req: NextRequest) {
  const cookie = req.cookies.get('bnny_auth')
  return cookie?.value === (process.env.ADMIN_PASSWORD || 'bnny2024')
}

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

    const updated = await updateProposal(proposal.id, patch)
    return NextResponse.json({ proposal: updated })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
