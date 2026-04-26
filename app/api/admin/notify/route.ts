import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

function isAuthed(req: NextRequest) {
  const cookie = req.cookies.get('bnny_auth')
  return cookie?.value === (process.env.ADMIN_PASSWORD || 'bnny2024')
}

export async function POST(req: NextRequest) {
  if (!isAuthed(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { slug, type } = await req.json()

  const { data: briefing } = await supabaseAdmin
    .from('briefings').select('*, clients(*)').eq('slug', slug).single()

  if (!briefing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Log the notification
  await supabaseAdmin.from('notifications').insert({
    briefing_id: briefing.id,
    type,
    status: 'sent',
    details: { client: briefing.clients?.company, sent_by: 'admin' }
  })

  // Here you would send the actual email/whatsapp
  // For now we just log it - email integration comes in next phase
  console.log(`Lembrete enviado para: ${briefing.clients?.company} (${briefing.clients?.email})`)

  return NextResponse.json({ ok: true })
}
