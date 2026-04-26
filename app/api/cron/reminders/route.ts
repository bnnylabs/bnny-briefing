import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { sendReminderToClient } from '@/lib/email'

// Vercel Cron — configure in vercel.json
// Runs daily at 10:00 UTC

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { data: settingsData } = await supabaseAdmin.from('settings').select('*')
    const settings: Record<string, string> = {}
    settingsData?.forEach((s: { key: string; value: string }) => { settings[s.key] = s.value })

    const reminderDays = parseInt(settings.reminder_days || '3', 10)
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
      const clientEmail = briefing.clients?.email
      const clientName = briefing.clients?.name
      if (!clientEmail || !clientName) continue

      const result = await sendReminderToClient({
        clientName, clientEmail,
        company: briefing.clients?.company || '',
        typeLabel: briefing.type_label,
        link: `${baseUrl}/${briefing.slug}`,
        language: briefing.language || 'pt-BR',
      })

      if (result.ok) {
        await supabaseAdmin.from('briefings')
          .update({ reminder_sent_at: new Date().toISOString() })
          .eq('id', briefing.id)
        try {
          await supabaseAdmin.from('notifications').insert({
            briefing_id: briefing.id, type: 'reminder', status: 'sent',
            details: { to: clientEmail, emailId: result.id },
          })
        } catch (_e) {}
        sent++
      }
    }

    return NextResponse.json({ sent, total: briefings.length, reminderDays })
  } catch (error) {
    console.error('Cron error:', error)
    return NextResponse.json({ error: 'Cron failed' }, { status: 500 })
  }
}
