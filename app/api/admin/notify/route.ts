import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { sendReminderToClient, sendWhatsApp } from '@/lib/email'

function isAuthed(req: NextRequest) {
  const cookie = req.cookies.get('bnny_auth')
  return cookie?.value === (process.env.ADMIN_PASSWORD || 'bnny2024')
}

function getBaseUrl(req: NextRequest) {
  if (process.env.NEXT_PUBLIC_BASE_URL) return process.env.NEXT_PUBLIC_BASE_URL
  const host = req.headers.get('host') || 'localhost:3000'
  const proto = host.includes('localhost') ? 'http' : 'https'
  return `${proto}://${host}`
}

export async function POST(req: NextRequest) {
  if (!isAuthed(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { slug, type } = await req.json()

  const { data: briefing } = await supabaseAdmin
    .from('briefings').select('*, clients(*)').eq('slug', slug).single()

  if (!briefing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const baseUrl = getBaseUrl(req)
  const link = `${baseUrl}/${slug}`
  let emailSent = false

  if (type === 'reminder' && briefing.clients?.email) {
    const result = await sendReminderToClient({
      clientName: briefing.clients.name,
      clientEmail: briefing.clients.email,
      company: briefing.clients.company,
      typeLabel: briefing.type_label,
      link,
    })
    emailSent = result.ok

    await sendWhatsApp(`🔔 Lembrete enviado para ${briefing.clients.company} (${briefing.clients.email})`)
  }

  if (type === 'resend' && briefing.clients?.email) {
    const { sendBriefingToClient } = await import('@/lib/email')
    const result = await sendBriefingToClient({
      clientName: briefing.clients.name,
      clientEmail: briefing.clients.email,
      company: briefing.clients.company,
      typeLabel: briefing.type_label,
      link,
    })
    emailSent = result.ok
  }

  try { await supabaseAdmin.from('notifications').insert({
    briefing_id: briefing.id,
    type,
    status: emailSent ? 'sent' : 'failed',
    details: { to: briefing.clients?.email, link, manual: true }
  }) } catch(_e) {}

  return NextResponse.json({ ok: true, emailSent })
}
