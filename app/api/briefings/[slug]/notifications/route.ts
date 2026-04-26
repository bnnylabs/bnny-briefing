import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const { data: briefing } = await supabaseAdmin.from('briefings').select('id').eq('slug', slug).single()
  if (!briefing) return NextResponse.json({ notifications: [] })
  const { data } = await supabaseAdmin.from('notifications').select('*').eq('briefing_id', briefing.id).order('sent_at', { ascending: false })
  return NextResponse.json({ notifications: data || [] })
}
