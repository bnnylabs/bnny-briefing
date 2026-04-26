import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params

  const { data: briefing } = await supabaseAdmin
    .from('briefings')
    .select('id')
    .eq('slug', slug)
    .single()

  if (!briefing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { data: response } = await supabaseAdmin
    .from('responses')
    .select('*')
    .eq('briefing_id', briefing.id)
    .order('submitted_at', { ascending: false })
    .limit(1)
    .single()

  return NextResponse.json({ answers: response?.answers || {} })
}
