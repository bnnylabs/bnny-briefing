import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

type TrackEvent = 'link_opened' | 'form_started'

const EVENT_STATUS: Record<TrackEvent, string> = {
  link_opened: 'visualizado',
  form_started: 'em_andamento',
}

const STATUS_FIELDS: Record<TrackEvent, Record<string, string>> = {
  link_opened: { viewed_at: new Date(0).toISOString() },  // placeholder, replaced below
  form_started: { started_at: new Date(0).toISOString() },
}

/**
 * POST /api/briefings/[slug]/track
 * Public — no auth required. Called by the client-facing briefing page
 * to record lifecycle events (link opened, form started).
 *
 * Idempotent: transitions only move forward, never backward.
 *   enviado → visualizado (link_opened)
 *   enviado|visualizado → em_andamento (form_started)
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params
  const { event } = await req.json() as { event: TrackEvent }

  if (!['link_opened', 'form_started'].includes(event)) {
    return NextResponse.json({ error: 'invalid_event' }, { status: 400 })
  }

  const { data: briefing } = await supabaseAdmin
    .from('briefings')
    .select('id, status, client_id')
    .eq('slug', slug)
    .single()

  if (!briefing) return NextResponse.json({ error: 'not_found' }, { status: 404 })

  // Compute the target status and whether this transition is allowed.
  // Forward-only — never regress.
  const allowedFromByEvent: Record<TrackEvent, string[]> = {
    link_opened: ['enviado'], // visualizado/em_andamento/concluido stay put
    form_started: ['enviado', 'visualizado'], // concluido/em_andamento stay put
  }

  if (!allowedFromByEvent[event].includes(briefing.status)) {
    return NextResponse.json({ ok: true, skipped: true })
  }

  const now = new Date().toISOString()
  const newStatus = EVENT_STATUS[event]
  const timestampField = event === 'link_opened' ? 'viewed_at' : 'started_at'

  // Atomic transition: only update if status is still in the allowed set.
  // A client opening the briefing in 2 tabs would otherwise fire two
  // identical events and double-insert into notifications.
  const { data: claimed, error: updErr } = await supabaseAdmin
    .from('briefings')
    .update({ status: newStatus, [timestampField]: now })
    .eq('id', briefing.id)
    .in('status', allowedFromByEvent[event]) // ← atomic guard
    .select('id')
    .maybeSingle()

  if (updErr) {
    return NextResponse.json({ error: updErr.message }, { status: 500 })
  }
  if (!claimed) {
    // Lost the race to a concurrent request, or status moved under us.
    // No work to do.
    return NextResponse.json({ ok: true, skipped: true })
  }

  // Log to activity timeline
  const eventLabels: Record<TrackEvent, string> = {
    link_opened: 'Link acessado pelo cliente',
    form_started: 'Preenchimento iniciado',
  }

  try {
    await supabaseAdmin.from('notifications').insert({
      briefing_id: briefing.id,
      type: event,
      status: 'sent',
      details: { event, timestamp: now, label: eventLabels[event] },
    })
  } catch (_e) {}

  return NextResponse.json({ ok: true, newStatus })
}
