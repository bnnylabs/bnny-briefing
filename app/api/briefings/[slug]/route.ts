import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params

  const { data: briefing, error } = await supabaseAdmin
    .from('briefings')
    .select(`*, clients(*)`)
    .eq('slug', slug)
    .single()

  if (error || !briefing) {
    return NextResponse.json({ error: 'Briefing não encontrado' }, { status: 404 })
  }

  if (briefing.status === 'enviado') {
    await supabaseAdmin
      .from('briefings')
      .update({ status: 'visualizado', viewed_at: new Date().toISOString() })
      .eq('id', briefing.id)
  }

  return NextResponse.json({ briefing })
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const body = await req.json()

  const { error } = await supabaseAdmin
    .from('briefings')
    .update(body)
    .eq('slug', slug)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params

  // Verify auth via cookie
  const cookie = req.cookies.get('bnny_auth')
  const isAuthed = cookie?.value === (process.env.ADMIN_PASSWORD || 'bnny2024')
  if (!isAuthed) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Get briefing first for logging
  const { data: briefing } = await supabaseAdmin
    .from('briefings').select('*, clients(*)').eq('slug', slug).single()

  if (!briefing) return NextResponse.json({ error: 'Briefing não encontrado' }, { status: 404 })

  // Delete related records first
  await supabaseAdmin.from('notifications').delete().eq('briefing_id', briefing.id)
  await supabaseAdmin.from('responses').delete().eq('briefing_id', briefing.id)

  // Delete the briefing
  const { error } = await supabaseAdmin.from('briefings').delete().eq('slug', slug)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Log the deletion
  try {
    await supabaseAdmin.from('activity_log').insert({
      action: 'delete_briefing',
      details: {
        slug,
        company: briefing.clients?.company,
        type_label: briefing.type_label,
        status: briefing.status,
        created_at: briefing.created_at,
      }
    })
  } catch (_e) {}

  return NextResponse.json({ ok: true })
}
