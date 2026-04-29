import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { sendCompletionToAdmin, sendWhatsApp, sendClientConfirmation } from '@/lib/email'
import { resolveBriefingRecipients } from '@/lib/briefing-recipients'

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

  // Get previous answers for diff (on update).
  // Order by submitted_at, not id — id is a random UUID so it gives
  // unstable ordering. submitted_at is monotonic at insert time.
  let previousAnswers: Record<string, unknown> = {}
  if (isUpdate) {
    const { data: prevResponse } = await supabaseAdmin
      .from('responses').select('answers').eq('briefing_id', briefing.id).order('submitted_at', { ascending: false }).limit(1).single()
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

    // Log form_submitted event to activity timeline
    try { await supabaseAdmin.from('notifications').insert({
      briefing_id: briefing.id,
      type: 'form_submitted',
      status: 'sent',
      details: { event: 'form_submitted', timestamp: now.toISOString(), label: 'Briefing concluído pelo cliente' },
    }) } catch (_e) {}
  }

  // Load settings
  const { data: settingsData } = await supabaseAdmin.from('settings').select('*')
  const settings: Record<string, string> = {}
  settingsData?.forEach((s: { key: string; value: string }) => { settings[s.key] = s.value })

  const adminEmail = settings.notification_email || process.env.NOTIFICATION_EMAIL || ''
    const editingHours = parseInt(settings.editing_hours || '48', 10)
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || `https://${req.headers.get('host')}`

  // Resolve client recipient from client_contacts (canonical since
  // schema v5). The legacy briefing.clients.email path is empty for
  // any client created after v5 — so the confirmation email below was
  // silently never being sent. Same root cause as v0.10.63 (proposals)
  // and v0.10.66 (cron reminders).
  const recipients = await resolveBriefingRecipients(briefing.client_id, {
    name: briefing.clients?.name || 'Cliente',
    email: briefing.clients?.email ?? null,
  })
  const primary = recipients.find((r) => r.role === 'primary') ?? recipients[0]
  const clientName = primary?.name || briefing.clients?.name || 'Cliente'
  const clientEmail = primary?.email || null
  const lang = primary?.language || briefing.language || 'pt-BR'

  // Build diff for updates — collected as structured data, the email
  // module owns the rendering. Same shape both surfaces (email + future
  // PDF export, etc) can consume.
  const changes: { field: string; old: string; new: string }[] = []
  if (isUpdate) {
    for (const [key, newVal] of Object.entries(answers)) {
      const oldVal = (previousAnswers as Record<string, unknown>)[key]
      const oldStr = Array.isArray(oldVal) ? (oldVal as string[]).join(', ') : String(oldVal ?? '')
      const newStr = Array.isArray(newVal) ? (newVal as string[]).join(', ') : String(newVal ?? '')
      if (oldStr !== newStr && newStr && key !== 'filled_by') {
        changes.push({ field: key.replace(/_/g, ' '), old: oldStr, new: newStr })
      }
    }
  }

  // Email to admin — always sent in admin's language (pt-BR), independent
  // of the briefing's language. The admin is one person; the language
  // mismatch when receiving emails for foreign-language briefings was
  // surprising in screenshots.
  if (adminEmail) {
    await sendCompletionToAdmin({
      adminEmail,
      clientName,
      company: briefing.clients?.company || '',
      typeLabel: briefing.type_label,
      baseUrl,
      kind: isUpdate ? 'updated' : 'completed',
      changes,
      language: 'pt-BR',
    })
    try { await supabaseAdmin.from('notifications').insert({ briefing_id: briefing.id, type: isUpdate ? 'update_admin' : 'email_admin', status: 'sent', details: { to: adminEmail } }) } catch (_e) {}
  }

  // Confirmation to client (only on first submit)
  if (!isUpdate && clientEmail) {
    await sendClientConfirmation({ clientName, clientEmail, company: briefing.clients?.company, typeLabel: briefing.type_label, language: lang, briefingLink: `${baseUrl}/${briefing.slug}`, editingHours })
    try { await supabaseAdmin.from('notifications').insert({ briefing_id: briefing.id, type: 'email_client_confirmation', status: 'sent', details: { to: clientEmail } }) } catch (_e) {}
  }

  const msg = isUpdate
    ? `📝 Briefing atualizado!\nEmpresa: ${briefing.clients?.company}\nTipo: ${briefing.type_label}`
    : `✅ Briefing concluído!\nEmpresa: ${briefing.clients?.company}\nContato: ${clientName}\nTipo: ${briefing.type_label}\nVer: ${baseUrl}/admin`
  await sendWhatsApp(msg)

  return NextResponse.json({ ok: true, editingExpiresAt: isUpdate ? briefing.editing_expires_at : editingExpiresAt })
}
