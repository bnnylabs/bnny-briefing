import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { sendCompletionToAdmin, sendWhatsApp, sendClientConfirmation } from '@/lib/email'

export async function POST(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const body = await req.json()
  const { answers, isUpdate } = body

  const { data: briefing, error: briefingError } = await supabaseAdmin
    .from('briefings').select('*, clients(*)').eq('slug', slug).single()
  if (briefingError || !briefing) return NextResponse.json({ error: 'Briefing não encontrado' }, { status: 404 })

  // Check editing permission for updates
  if (isUpdate) {
    const now = new Date()
    const editingExpired = briefing.editing_expires_at && new Date(briefing.editing_expires_at) < now
    if (briefing.editing_locked || editingExpired) {
      return NextResponse.json({ error: 'Editing not allowed' }, { status: 403 })
    }
  }

  // Get previous answers for diff (on update)
  let previousAnswers: Record<string, unknown> = {}
  if (isUpdate) {
    const { data: prevResponse } = await supabaseAdmin
      .from('responses').select('answers').eq('briefing_id', briefing.id).order('created_at', { ascending: false }).limit(1).single()
    if (prevResponse) previousAnswers = prevResponse.answers as Record<string, unknown>
  }

  // Save response
  const { error: responseError } = await supabaseAdmin.from('responses').insert({
    briefing_id: briefing.id, answers,
    responsible_name: briefing.clients?.name,
    responsible_email: briefing.clients?.email,
    responsible_phone: briefing.clients?.phone,
  })
  if (responseError) return NextResponse.json({ error: responseError.message }, { status: 500 })

  const now = new Date()
  const editingExpiresAt = new Date(now.getTime() + 48 * 60 * 60 * 1000).toISOString()

  if (isUpdate) {
    await supabaseAdmin.from('briefings').update({
      update_count: (briefing.update_count || 0) + 1,
    }).eq('id', briefing.id)
  } else {
    await supabaseAdmin.from('briefings').update({
      status: 'concluido',
      completed_at: now.toISOString(),
      editing_expires_at: editingExpiresAt,
    }).eq('id', briefing.id)
  }

  // Load settings
  const { data: settingsData } = await supabaseAdmin.from('settings').select('*')
  const settings: Record<string, string> = {}
  settingsData?.forEach((s: { key: string; value: string }) => { settings[s.key] = s.value })

  const adminEmail = settings.notification_email || process.env.NOTIFICATION_EMAIL || ''
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || `https://${req.headers.get('host')}`
  const clientName = briefing.clients?.name || 'Cliente'
  const clientEmail = briefing.clients?.email
  const lang = briefing.language || 'pt-BR'
  const isEN = lang === 'en-US'

  // Build diff for updates
  let diffHtml = ''
  if (isUpdate && Object.keys(previousAnswers).length > 0) {
    const changes: { field: string; old: string; new: string }[] = []
    for (const [key, newVal] of Object.entries(answers)) {
      const oldVal = previousAnswers[key]
      const oldStr = Array.isArray(oldVal) ? (oldVal as string[]).join(', ') : String(oldVal || '')
      const newStr = Array.isArray(newVal) ? (newVal as string[]).join(', ') : String(newVal || '')
      if (oldStr !== newStr && newStr && key !== 'filled_by') {
        changes.push({ field: key.replace(/_/g, ' '), old: oldStr, new: newStr })
      }
    }
    if (changes.length > 0) {
      diffHtml = changes.map(c => `
        <div style="margin-bottom:16px;padding:12px 16px;background:#f8f8f8;border-left:3px solid #c8ff00;border-radius:0 8px 8px 0">
          <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:#888;margin-bottom:8px">${c.field}</div>
          <div style="font-size:13px;color:#999;text-decoration:line-through;margin-bottom:4px">${c.old}</div>
          <div style="font-size:14px;color:#111;font-weight:600">${c.new}</div>
        </div>`).join('')
    }
  }

  // Email to admin
  if (adminEmail) {
    const subject = isUpdate
      ? `📝 ${briefing.clients?.company} atualizou o briefing de ${briefing.type_label}`
      : `✅ Briefing concluído — ${briefing.clients?.company} (${briefing.type_label})`

    const bodyHtml = isUpdate
      ? `<h1>${isEN ? 'Briefing updated!' : 'Briefing atualizado!'} 📝</h1>
         <p><strong>${briefing.clients?.company}</strong> ${isEN ? 'updated their' : 'atualizou o'} briefing de <strong>${briefing.type_label}</strong>.</p>
         ${diffHtml || '<p style="color:#888">Sem alterações detectadas.</p>'}
         <a href="${baseUrl}/admin" class="btn">${isEN ? 'View in admin →' : 'Ver no painel →'}</a>`
      : `<h1>${isEN ? 'Briefing completed!' : 'Briefing concluído!'} ✅</h1>
         <p>${isEN ? 'Client' : 'O cliente'} <strong>${clientName}</strong> ${isEN ? 'from' : 'da'} <strong>${briefing.clients?.company}</strong> ${isEN ? 'completed the' : 'concluiu o briefing de'} <strong>${briefing.type_label}</strong>.</p>
         <a href="${baseUrl}/admin" class="btn">${isEN ? 'View responses →' : 'Ver respostas →'}</a>`

    await sendCompletionToAdmin({ adminEmail, clientName, company: briefing.clients?.company, typeLabel: briefing.type_label, slug, baseUrl, customSubject: subject, customBody: bodyHtml })
    try { await supabaseAdmin.from('notifications').insert({ briefing_id: briefing.id, type: isUpdate ? 'update_admin' : 'email_admin', status: 'sent', details: { to: adminEmail } }) } catch (_e) {}
  }

  // Confirmation to client (only on first submit)
  if (!isUpdate && clientEmail) {
    await sendClientConfirmation({ clientName, clientEmail, company: briefing.clients?.company, typeLabel: briefing.type_label, language: lang })
    try { await supabaseAdmin.from('notifications').insert({ briefing_id: briefing.id, type: 'email_client_confirmation', status: 'sent', details: { to: clientEmail } }) } catch (_e) {}
  }

  const msg = isUpdate
    ? `📝 Briefing atualizado!\nEmpresa: ${briefing.clients?.company}\nTipo: ${briefing.type_label}`
    : `✅ Briefing concluído!\nEmpresa: ${briefing.clients?.company}\nContato: ${clientName}\nTipo: ${briefing.type_label}\nVer: ${baseUrl}/admin`
  await sendWhatsApp(msg)

  return NextResponse.json({ ok: true, editingExpiresAt: isUpdate ? briefing.editing_expires_at : editingExpiresAt })
}
