import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

function isAuthed(req: NextRequest) {
  const cookie = req.cookies.get('bnny_auth')
  return cookie?.value === (process.env.ADMIN_PASSWORD || 'bnny2024')
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const { data: briefing, error } = await supabaseAdmin
    .from('briefings').select('*, clients(*)').eq('slug', slug).single()
  if (error || !briefing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Check if editing is allowed
  const now = new Date()
  const editingExpired = briefing.editing_expires_at && new Date(briefing.editing_expires_at) < now
  const canEdit = !briefing.editing_locked && !editingExpired

  return NextResponse.json({ briefing: { ...briefing, canEdit } })
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const body = await req.json()

  // Admin-only fields require auth
  const adminFields = ['editing_locked', 'internal_notes', 'status']
  const hasAdminField = adminFields.some(f => f in body)
  if (hasAdminField && !isAuthed(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { error } = await supabaseAdmin.from('briefings').update(body).eq('slug', slug)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  if (!isAuthed(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { slug } = await params
  const { data: briefing } = await supabaseAdmin.from('briefings').select('id').eq('slug', slug).single()
  if (!briefing) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  await supabaseAdmin.from('notifications').delete().eq('briefing_id', briefing.id)
  await supabaseAdmin.from('responses').delete().eq('briefing_id', briefing.id)
  await supabaseAdmin.from('briefings').delete().eq('id', briefing.id)
  return NextResponse.json({ ok: true })
}
