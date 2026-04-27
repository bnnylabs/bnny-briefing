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

  // Fetch CC contacts for this client
  const { data: ccContacts } = await supabaseAdmin
    .from('client_contacts')
    .select('name, email, language')
    .eq('client_id', briefing.client_id)
    .eq('receives_copies', true)
  const ccList = (ccContacts ?? []).filter(c => c.email)

  if (type === 'reminder' && briefing.clients?.email) {
    const result = await sendReminderToClient({
      clientName: briefing.clients.name,
      clientEmail: briefing.clients.email,
      company: briefing.clients.company,
      typeLabel: briefing.type_label,
      link,
    })
    emailSent = result.ok

    try { await supabaseAdmin.from('notifications').insert({
      briefing_id: briefing.id, type,
      status: result.ok ? 'sent' : 'failed',
      details: { to: briefing.clients.email, name: briefing.clients.name, role: 'primary', link, manual: true }
    }) } catch(_e) {}

    // Send to CC contacts
    for (const cc of ccList) {
      const ccResult = await sendReminderToClient({
        clientName: cc.name,
        clientEmail: cc.email!,
        company: briefing.clients.company,
        typeLabel: briefing.type_label,
        link,
        language: cc.language || 'pt-BR',
      })
      try { await supabaseAdmin.from('notifications').insert({
        briefing_id: briefing.id, type,
        status: ccResult.ok ? 'sent' : 'failed',
        details: { to: cc.email, name: cc.name, role: 'cc', link, manual: true }
      }) } catch(_e) {}
    }

    await sendWhatsApp(`🔔 Lembrete enviado para ${briefing.clients.company}${ccList.length > 0 ? ` + ${ccList.length} CC` : ''}`)
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

    // Build/update recipients snapshot
    const recipients = [
      { email: briefing.clients.email, name: briefing.clients.name, role: 'primary' },
      ...ccList.map(cc => ({ email: cc.email!, name: cc.name, role: 'cc' }))
    ]

    try { await supabaseAdmin.from('notifications').insert({
      briefing_id: briefing.id, type,
      status: result.ok ? 'sent' : 'failed',
      details: { to: briefing.clients.email, name: briefing.clients.name, role: 'primary', link, manual: true }
    }) } catch(_e) {}

    // Send to CC contacts
    for (const cc of ccList) {
      const ccResult = await sendBriefingToClient({
        clientName: cc.name,
        clientEmail: cc.email!,
        company: briefing.clients.company,
        typeLabel: briefing.type_label,
        link,
        language: cc.language || 'pt-BR',
      })
      try { await supabaseAdmin.from('notifications').insert({
        briefing_id: briefing.id, type,
        status: ccResult.ok ? 'sent' : 'failed',
        details: { to: cc.email, name: cc.name, role: 'cc', link, manual: true }
      }) } catch(_e) {}
    }

    // Update recipients on briefing
    try { await supabaseAdmin.from('briefings').update({ recipients }).eq('id', briefing.id) } catch(_e) {}
  }

  return NextResponse.json({ ok: true, emailSent })
}
