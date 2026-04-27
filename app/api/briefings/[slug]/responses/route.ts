import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params

  const { data: briefing } = await supabaseAdmin
    .from('briefings').select('id, update_count').eq('slug', slug).single()

  if (!briefing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // CRITICAL: order by submitted_at, not by id.
  // The 'id' column is a random UUID (gen_random_uuid()), so ordering by
  // it produces alphabetical chaos — neither chronological nor stable.
  // submitted_at is timestamptz set at insert time and gives true
  // chronological order across all versions.
  const { data: responses } = await supabaseAdmin
    .from('responses')
    .select('*')
    .eq('briefing_id', briefing.id)
    .order('submitted_at', { ascending: true })

  const all = responses || []
  const latest = all[all.length - 1]
  // Compare the LAST UPDATE (previous version vs latest), not the
  // 'first ever' vs latest. This matches the diff the admin sees in
  // the update notification email, which calculates the same way:
  // "what changed between the version we had and the new one".
  const previousVersion = all.length >= 2 ? all[all.length - 2] : null

  let diff: Record<string, { old: unknown; new: unknown }> = {}
  if (previousVersion && latest) {
    const oldAnswers = (previousVersion.answers || {}) as Record<string, unknown>
    const newAnswers = (latest.answers || {}) as Record<string, unknown>
    // Iterate over the union of keys so we catch fields that were
    // *removed* (present before, absent now) as well as added/changed.
    const allKeys = new Set([
      ...Object.keys(oldAnswers),
      ...Object.keys(newAnswers),
    ])
    for (const key of allKeys) {
      const oldVal = oldAnswers[key]
      const newVal = newAnswers[key]
      const oldStr = Array.isArray(oldVal) ? (oldVal as string[]).join(', ') : String(oldVal ?? '')
      const newStr = Array.isArray(newVal) ? (newVal as string[]).join(', ') : String(newVal ?? '')
      if (oldStr !== newStr) {
        diff[key] = { old: oldVal, new: newVal }
      }
    }
  }

  return NextResponse.json({
    answers: latest?.answers || {},
    originalAnswers: all[0]?.answers || {},
    diff,
    versions: all.length,
    updateCount: briefing.update_count || 0,
    submittedAt: latest?.submitted_at,
    originalSubmittedAt: all[0]?.submitted_at,
  })
}
