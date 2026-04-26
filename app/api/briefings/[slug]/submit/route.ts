import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { sendCompletionToAdmin, sendWhatsApp } from '@/lib/email'
import { sendClientConfirmation } from '@/lib/email'

export async function POST(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const body = await req.json()
  const { answers } = body

  const { data: briefing, error: briefingError } = await supabaseAdmin
    .from('briefings').select(`*, clients(*)`).eq('slug', slug).single()

  if (briefingError || !briefing) return NextResponse.json({ error: 'Briefing não encontrado' }, { status: 404 })

  // Use client data as canonical contact — not form answers
  const { error: responseError } = await supabaseAdmin.from('responses').insert({
    briefing_id: briefing.id, answers,
    responsible_name: briefing.clients?.name,
    responsible_email: briefing.clients?.email,
    responsible_phone: briefing.clients?.phone,
  })

  if (responseError) return NextResponse.json({ error: responseError.message }, { status: 500 })

  await supabaseAdmin.from('briefings').update({ status: 'concluido', completed_at: new Date().toISOString() }).eq('id', briefing.id)

  const { data: settingsData } = await supabaseAdmin.from('settings').select('*')
  const settings: Record<string, string> = {}
  settingsData?.forEach((s: { key: string; value: string }) => { settings[s.key] = s.value })

  const adminEmail = settings.notification_email || process.env.NOTIFICATION_EMAIL || ''
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || `https://${req.headers.get('host')}`
  const clientName = briefing.clients?.name || answers.filled_by || 'Cliente'
  const clientEmail = briefing.clients?.email

  // Email to admin
  if (adminEmail) {
    await sendCompletionToAdmin({
      adminEmail, clientName, company: briefing.clients?.company,
      typeLabel: briefing.type_label, slug, baseUrl,
    })
    try { await supabaseAdmin.from('notifications').insert({ briefing_id: briefing.id, type: 'email_admin', status: 'sent', details: { to: adminEmail } }) } catch(_e) {}
  }

  // Confirmation email to client
  if (clientEmail) {
    await sendClientConfirmation({
      clientName, clientEmail,
      company: briefing.clients?.company,
      typeLabel: briefing.type_label,
      language: briefing.language || 'pt-BR',
    })
    try { await supabaseAdmin.from('notifications').insert({ briefing_id: briefing.id, type: 'email_client_confirmation', status: 'sent', details: { to: clientEmail } }) } catch(_e) {}
  }

  // WhatsApp to admin
  const msg = `✅ Briefing concluído!\nEmpresa: ${briefing.clients?.company}\nContato: ${clientName}\nTipo: ${briefing.type_label}\nVer: ${baseUrl}/admin`
  await sendWhatsApp(msg)

  return NextResponse.json({ ok: true })
}
