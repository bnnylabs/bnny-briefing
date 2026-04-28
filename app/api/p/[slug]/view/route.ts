import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

/**
 * POST /api/p/[slug]/view
 *
 * Public endpoint hit by the proposal view tracker on first paint of the
 * client-facing page. Marks the proposal as viewed:
 *   - sets viewed_at to NOW() (only the first time — preserves first-view
 *     timestamp on subsequent visits)
 *   - upgrades status from 'sent' to 'viewed' only
 *
 * The status upgrade is intentionally narrow. A client who views, then
 * approves (status='approved'), then revisits the page would NOT downgrade
 * back to 'viewed'. Same for 'rejected', 'expired', 'revised'.
 *
 * 'draft' is never visible to the client side anyway (the page returns
 * 404 in that state), so it's also excluded from the upgrade path here.
 */
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params

  // Lookup current state — we only update from 'sent', never from anything
  // else. This single round-trip is necessary because Supabase doesn't
  // give us "update where status IN (...)" with a returning that confirms
  // a no-op cleanly.
  const { data: existing, error: fetchErr } = await supabaseAdmin
    .from('proposals')
    .select('id, status, viewed_at')
    .eq('slug', slug)
    .maybeSingle()

  if (fetchErr) {
    return NextResponse.json({ error: fetchErr.message }, { status: 500 })
  }
  if (!existing) {
    // Don't leak existence — return 200 even on miss, the tracker doesn't
    // care and we don't want this endpoint to be a slug enumeration oracle.
    return NextResponse.json({ ok: true })
  }

  // Status guard: only upgrade from 'sent'. 'viewed' would just refresh
  // viewed_at — we deliberately don't, because the first-view timestamp
  // is the more useful signal for the owner.
  if (existing.status !== 'sent') {
    return NextResponse.json({ ok: true, skipped: true })
  }

  const update: Record<string, unknown> = {
    status: 'viewed',
    updated_at: new Date().toISOString(),
  }
  if (!existing.viewed_at) {
    update.viewed_at = new Date().toISOString()
  }

  const { error: updErr } = await supabaseAdmin
    .from('proposals')
    .update(update)
    .eq('id', existing.id)

  if (updErr) {
    return NextResponse.json({ error: updErr.message }, { status: 500 })
  }

  // TODO (Fase 3b): dispatch sendProposalViewedToAdmin(...) here so the
  // owner gets a heads-up email. For now we just update state.

  return NextResponse.json({ ok: true })
}
