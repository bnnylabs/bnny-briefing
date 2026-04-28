import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { requireAuth } from '@/lib/auth'

/**
 * GET /api/briefings/[slug]/notifications
 *
 * Admin-only — returns the per-briefing notification log (emails sent,
 * link opens, reminders, etc). Public access used to leak recipient
 * email addresses and timestamps to anyone who guessed a slug; locked
 * behind requireAuth as part of v0.10.65.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const unauthorized = requireAuth(req)
  if (unauthorized) return unauthorized

  const { slug } = await params
  const { data: briefing } = await supabaseAdmin
    .from('briefings')
    .select('id')
    .eq('slug', slug)
    .single()

  if (!briefing) return NextResponse.json({ notifications: [] })

  // Limit added: a briefing that's been around for months can accumulate
  // hundreds of reminder rows. The admin UI only renders the most recent
  // anyway. (Was unbounded before.)
  const { data } = await supabaseAdmin
    .from('notifications')
    .select('*')
    .eq('briefing_id', briefing.id)
    .order('sent_at', { ascending: false })
    .limit(100)

  return NextResponse.json({ notifications: data || [] })
}
