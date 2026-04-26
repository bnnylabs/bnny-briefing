import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

function isAuthed(req: NextRequest) {
  const cookie = req.cookies.get('bnny_auth')
  return cookie?.value === (process.env.ADMIN_PASSWORD || 'bnny2024')
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!isAuthed(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params
  const { data: client, error } = await supabaseAdmin.from('clients').select('*').eq('id', id).single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  const { data: briefings } = await supabaseAdmin
    .from('briefings').select('id, slug, type, type_label, status, created_at, completed_at, internal_notes')
    .eq('client_id', id).order('created_at', { ascending: false })
  return NextResponse.json({ client, briefings: briefings || [] })
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!isAuthed(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params
  const body = await req.json()
  const { error } = await supabaseAdmin.from('clients').update(body).eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!isAuthed(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params

  // Cascade delete briefings
  const { data: briefings } = await supabaseAdmin.from('briefings').select('id').eq('client_id', id)
  const bids = (briefings || []).map(b => b.id)
  if (bids.length > 0) {
    await supabaseAdmin.from('notifications').delete().in('briefing_id', bids)
    await supabaseAdmin.from('responses').delete().in('briefing_id', bids)
    await supabaseAdmin.from('briefings').delete().in('id', bids)
  }

  const { error } = await supabaseAdmin.from('clients').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
