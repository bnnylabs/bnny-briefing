import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function POST(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const body = await req.json()
  const { answers } = body

  const { data: briefing, error: briefingError } = await supabaseAdmin
    .from('briefings')
    .select(`*, clients(*)`)
    .eq('slug', slug)
    .single()

  if (briefingError || !briefing) {
    return NextResponse.json({ error: 'Briefing não encontrado' }, { status: 404 })
  }

  const { error: responseError } = await supabaseAdmin
    .from('responses')
    .insert({
      briefing_id: briefing.id,
      answers,
      responsible_name: answers.responsible_name,
      responsible_email: answers.responsible_email,
      responsible_phone: answers.responsible_phone,
    })

  if (responseError) return NextResponse.json({ error: responseError.message }, { status: 500 })

  await supabaseAdmin
    .from('briefings')
    .update({ status: 'concluido', completed_at: new Date().toISOString() })
    .eq('id', briefing.id)

  return NextResponse.json({ ok: true })
}
