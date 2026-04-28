import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { sendReminderToClient } from '@/lib/email'
import { resolveBriefingRecipients } from '@/lib/briefing-recipients'

// Vercel Cron — configure in vercel.json
// Runs daily at 10:00 UTC

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET

  // Hard-require CRON_SECRET. The previous version had
  //   if (cronSecret && authHeader !== `Bearer ${cronSecret}`) ...
  // which fails OPEN if the env var was missing — anyone could hit the
  // endpoint and trigger reminder emails to every active briefing.
  // Now: if the secret isn't configured, the cron returns 500. Better
  // to break the cron than to ship reminder emails on demand to bots.
  if (!cronSecret) {
    console.error('[cron/reminders] CRON_SECRET not configured')
    return NextResponse.json({ error: 'Misconfigured' }, { status: 500 })
  }
  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { data: settingsData } = await supabaseAdmin.from('settings').select('*')
    const settings: Record<string, string> = {}
    settingsData?.forEach((s: { key: string; value: string }) => { settings[s.key] = s.value })

    // parseInt('abc', 10) returns NaN, which silently breaks downstream
    // date math. Coerce to a sane default if the stored setting is junk.
    const parsedDays = parseInt(settings.reminder_days || '3', 10)
    const reminderDays = Number.isFinite(parsedDays) && parsedDays > 0 ? parsedDays : 3
    const reminderCutoff = new Date(Date.now() - reminderDays * 24 * 60 * 60 * 1000).toISOString()
    const expiryCutoff = new Date().toISOString()

    const { data: briefings, error } = await supabaseAdmin
      .from('briefings')
      .select('*, clients(*)')
      .in('status', ['enviado', 'em_andamento'])
      .lt('created_at', reminderCutoff)
      .is('reminder_sent_at', null)
      .or(`expires_at.is.null,expires_at.gt.${expiryCutoff}`)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    if (!briefings?.length) return NextResponse.json({ sent: 0, message: 'No briefings need reminders' })

    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://briefing.bnnylabs.com'
    let sent = 0

    for (const briefing of briefings) {
      // Resolve recipients from client_contacts (canonical since schema
      // v5). The legacy briefing.clients.email path is empty for any
      // client created after the v5 migration, which is everyone now —
      // that's why this cron was silently sending zero reminders even
      // when it ran.
      const recipients = await resolveBriefingRecipients(briefing.client_id, {
        name: briefing.clients?.name || 'Cliente',
        email: briefing.clients?.email ?? null,
      })
      if (recipients.length === 0) continue

      const primary = recipients.find((r) => r.role === 'primary') ?? recipients[0]

      const result = await sendReminderToClient({
        clientName: primary.name,
        clientEmail: primary.email,
        company: briefing.clients?.company || '',
        typeLabel: briefing.type_label,
        link: `${baseUrl}/${briefing.slug}`,
        language: primary.language || briefing.language || 'pt-BR',
      })

      if (result.ok) {
        await supabaseAdmin.from('briefings')
          .update({ reminder_sent_at: new Date().toISOString() })
          .eq('id', briefing.id)
        try {
          await supabaseAdmin.from('notifications').insert({
            briefing_id: briefing.id, type: 'reminder', status: 'sent',
            details: { to: primary.email, emailId: result.id },
          })
        } catch (_e) {
          // Notifications are best-effort; don't fail the cron over them.
          console.error('[cron/reminders] notifications insert silenced:', _e)
        }
        sent++
      }
    }

    return NextResponse.json({ sent, total: briefings.length, reminderDays })
  } catch (error) {
    console.error('Cron error:', error)
    return NextResponse.json({ error: 'Cron failed' }, { status: 500 })
  }
}
