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

  // Only transition forward — don't regress a completed briefing
  if (['concluido', 'em_andamento'].includes(briefing.status) && event === 'link_opened') {
    return NextResponse.json({ ok: true, skipped: true })
  }
  if (briefing.status === 'concluido' && event === 'form_started') {
    return NextResponse.json({ ok: true, skipped: true })
  }
  if (briefing.status === 'em_andamento' && event === 'form_started') {
    return NextResponse.json({ ok: true, skipped: true }) // already in this state
  }

  const now = new Date().toISOString()
  const newStatus = EVENT_STATUS[event]
  const timestampField = event === 'link_opened' ? 'viewed_at' : 'started_at'

  // Update briefing status
  await supabaseAdmin
    .from('briefings')
    .update({ status: newStatus, [timestampField]: now })
    .eq('id', briefing.id)

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
