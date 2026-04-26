import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

function isAuthed(req: NextRequest) {
  const cookie = req.cookies.get('bnny_auth')
  return cookie?.value === (process.env.ADMIN_PASSWORD || 'bnny2024')
}

export async function POST(req: NextRequest) {
  if (!isAuthed(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { ids } = await req.json()
  if (!Array.isArray(ids) || ids.length === 0) return NextResponse.json({ error: 'Nenhum id fornecido' }, { status: 400 })

  // Get all briefing ids for these clients
  const { data: briefings } = await supabaseAdmin.from('briefings').select('id').in('client_id', ids)
  const briefingIds = (briefings || []).map(b => b.id)

  if (briefingIds.length > 0) {
    await supabaseAdmin.from('notifications').delete().in('briefing_id', briefingIds)
    await supabaseAdmin.from('responses').delete().in('briefing_id', briefingIds)
    await supabaseAdmin.from('briefings').delete().in('id', briefingIds)
  }

  const { error } = await supabaseAdmin.from('clients').delete().in('id', ids)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true, deleted: ids.length })
}
