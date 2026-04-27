import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { sendReminderToClient, sendBriefingToClient, sendWhatsApp } from '@/lib/email'
import { resolveBriefingRecipients, type BriefingRecipient } from '@/lib/briefing-recipients'

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

type IncomingRecipient = { email: string; name: string; role?: 'primary' | 'cc' }

/**
 * POST /api/admin/notify
 *
 * Body:
 *   slug:      briefing slug
 *   type:      'reminder' | 'resend'
 *   recipients (optional): list of explicit destinations for custom send
 *
 * Behavior:
 *   - With recipients[]: send only to those, looking up language per email
 *   - Without recipients: send to canonical primary + CC contacts
 *
 * Each delivery is logged independently in the notifications table.
 */
export async function POST(req: NextRequest) {
  if (!isAuthed(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { slug, type, recipients: incoming } = await req.json() as {
    slug: string
    type: 'reminder' | 'resend'
    recipients?: IncomingRecipient[]
  }

  const { data: briefing } = await supabaseAdmin
    .from('briefings').select('*, clients(*)').eq('slug', slug).single()
  if (!briefing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const baseUrl = getBaseUrl(req)
  const link = `${baseUrl}/${slug}`

  // Resolve target recipients — either explicit (custom send) or canonical (default)
  let targets: BriefingRecipient[]
  if (incoming && incoming.length > 0) {
    const { data: contacts } = await supabaseAdmin
      .from('client_contacts')
      .select('email, language')
      .eq('client_id', briefing.client_id)
    const langMap: Record<string, string> = {}
    for (const c of contacts ?? []) {
      if (c.email) langMap[c.email.toLowerCase()] = c.language || 'pt-BR'
    }
    targets = incoming.map(r => ({
      email: r.email,
      name: r.name,
      role: r.role ?? 'cc',
      language: langMap[r.email.toLowerCase()] || briefing.language || 'pt-BR',
    }))
  } else {
    targets = await resolveBriefingRecipients(briefing.client_id, {
      name: briefing.clients?.name ?? '',
      email: briefing.clients?.email ?? null,
    })
  }

  if (targets.length === 0) {
    return NextResponse.json({ error: 'no_recipients' }, { status: 400 })
  }

  let primarySent = false

  for (const r of targets) {
    let result: { ok: boolean }

    if (type === 'reminder') {
      result = await sendReminderToClient({
        clientName: r.name,
        clientEmail: r.email,
        company: briefing.clients?.company ?? '',
        typeLabel: briefing.type_label,
        link,
        language: r.language,
      })
    } else {
      result = await sendBriefingToClient({
        clientName: r.name,
        clientEmail: r.email,
        company: briefing.clients?.company ?? '',
        typeLabel: briefing.type_label,
        link,
        language: r.language,
      })
    }

    if (r.role === 'primary') primarySent = result.ok

    try { await supabaseAdmin.from('notifications').insert({
      briefing_id: briefing.id,
      type,
      status: result.ok ? 'sent' : 'failed',
      details: { to: r.email, name: r.name, role: r.role, link, manual: true }
    }) } catch(_e) {}
  }

  // Update recipients snapshot only on default (full) sends — custom sends shouldn't overwrite history
  if (!incoming) {
    const snapshot = targets.map(r => ({ email: r.email, name: r.name, role: r.role }))
    try { await supabaseAdmin.from('briefings').update({ recipients: snapshot }).eq('id', briefing.id) } catch(_e) {}
  }

  if (type === 'reminder') {
    await sendWhatsApp(`🔔 Lembrete enviado para ${briefing.clients?.company}: ${targets.length} destinatário${targets.length > 1 ? 's' : ''}`)
  }

  return NextResponse.json({ ok: true, sent: targets.length, emailSent: primarySent })
}
