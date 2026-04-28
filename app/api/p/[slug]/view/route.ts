import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { sendProposalViewedToAdmin } from '@/lib/email'
import { formatProposalNumber } from '@/lib/proposal-types'

/**
 * POST /api/p/[slug]/view
 *
 * Public endpoint hit by the proposal view tracker on first paint of the
 * client-facing page. Marks the proposal as viewed AND emails the owner
 * (best-effort) so they get a heads-up that the client opened the
 * document.
 *
 * Status upgrade is intentionally narrow: only 'sent' → 'viewed'. A
 * client who views, then approves, then revisits would NOT downgrade
 * back to 'viewed'. Same for 'rejected', 'expired', 'revised'.
 *
 * 'draft' is never visible to the client side anyway (the public page
 * 404s in that state), so it's also excluded from the upgrade path.
 *
 * Email side-effect: only fires on the FIRST view (status === 'sent').
 * Re-visits where status is already 'viewed' don't re-notify the owner —
 * that would be noisy.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params

  // Lookup current state — we only update from 'sent', never from anything
  // else. Single round-trip + we need client info anyway for the email.
  const { data: existing, error: fetchErr } = await supabaseAdmin
    .from('proposals')
    .select(
      `
      id, slug, status, viewed_at, title, number, version_suffix, language,
      clients ( name, company )
    `,
    )
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

  // Best-effort: notify the owner. Failures here are swallowed — the
  // status update already succeeded and that's the canonical signal.
  // We pull settings inline (not via email.ts cache) so a stale cache
  // can't suppress the notification on a freshly-edited address.
  try {
    const { data: settingsData } = await supabaseAdmin.from('settings').select('key, value')
    const settings: Record<string, string> = {}
    settingsData?.forEach((s: { key: string; value: string }) => {
      settings[s.key] = s.value
    })
    const adminEmail = settings.notification_email || process.env.NOTIFICATION_EMAIL || ''

    if (adminEmail) {
      // Supabase's typed select gives clients as an array even for a
      // single foreign key; we accept either shape defensively.
      const clientsField = (existing as unknown as { clients: unknown }).clients
      const clientRow = Array.isArray(clientsField) ? clientsField[0] : clientsField
      const client = (clientRow ?? {}) as { name?: string; company?: string }

      const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || `https://${req.headers.get('host')}`

      await sendProposalViewedToAdmin({
        adminEmail,
        clientName: client.name || 'Cliente',
        company: client.company || '',
        proposalTitle: existing.title,
        proposalNumber: formatProposalNumber(existing.number, existing.version_suffix),
        baseUrl,
        language: existing.language === 'en-US' ? 'en-US' : 'pt-BR',
      })

      // Best-effort activity log too.
      await supabaseAdmin.from('proposal_activity').insert({
        proposal_id: existing.id,
        actor_type: 'system',
        event: 'link_opened',
        details: { notified: adminEmail },
      })
    }
  } catch (e) {
    // Notifications never break the public-facing tracker.
    console.error('proposal viewed admin notification failed:', e)
  }

  return NextResponse.json({ ok: true })
}
