import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { isAuthed } from '@/lib/auth'

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!isAuthed(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params

  const [clientRes, briefingsRes, contactsRes, notesRes] = await Promise.all([
    supabaseAdmin.from('clients').select('*').eq('id', id).single(),
    supabaseAdmin
      .from('briefings')
      .select('id, slug, type, type_label, status, language, created_at, completed_at, internal_notes, editing_locked, update_count, recipients')
      .eq('client_id', id)
      .order('created_at', { ascending: false }),
    supabaseAdmin
      .from('client_contacts')
      .select('*')
      .eq('client_id', id)
      .order('is_primary', { ascending: false })
      .order('created_at', { ascending: true }),
    supabaseAdmin
      .from('client_notes')
      .select('*')
      .eq('client_id', id)
      .order('is_pinned', { ascending: false })
      .order('created_at', { ascending: false }),
  ])

  if (clientRes.error) return NextResponse.json({ error: clientRes.error.message }, { status: 500 })

  return NextResponse.json({
    client: clientRes.data,
    briefings: briefingsRes.data ?? [],
    contacts: contactsRes.data ?? [],
    notes: notesRes.data ?? [],
  })
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!isAuthed(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params
  const body = await req.json()

  // Always update last_activity_at on any client mutation
  const payload = { ...body, last_activity_at: new Date().toISOString() }

  const { error } = await supabaseAdmin.from('clients').update(payload).eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!isAuthed(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params

  // Soft delete — set archived_at instead of hard deleting.
  // Hard delete is available via ?force=true for irreversible cleanup.
  const url = new URL(req.url)
  const force = url.searchParams.get('force') === 'true'

  if (!force) {
    const { error } = await supabaseAdmin
      .from('clients')
      .update({ archived_at: new Date().toISOString(), status: 'archived' })
      .eq('id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true, archived: true })
  }

  // Hard delete path (force=true): cascade manually then delete
  const { data: briefings } = await supabaseAdmin.from('briefings').select('id').eq('client_id', id)
  const bids = (briefings ?? []).map((b) => b.id)
  if (bids.length > 0) {
    await supabaseAdmin.from('notifications').delete().in('briefing_id', bids)
    await supabaseAdmin.from('responses').delete().in('briefing_id', bids)
    await supabaseAdmin.from('briefings').delete().in('id', bids)
  }
  await supabaseAdmin.from('client_contacts').delete().eq('client_id', id)
  await supabaseAdmin.from('client_notes').delete().eq('client_id', id)

  const { error } = await supabaseAdmin.from('clients').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, archived: false })
}
