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
