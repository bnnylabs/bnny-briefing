import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params

  const { data: briefing } = await supabaseAdmin
    .from('briefings').select('id, update_count').eq('slug', slug).single()

  if (!briefing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Fetch all versions — try submitted_at first (original schema), fallback to created_at
  const { data: responses } = await supabaseAdmin
    .from('responses')
    .select('*')
    .eq('briefing_id', briefing.id)
    .order('id', { ascending: true })

  const all = responses || []
  const latest = all[all.length - 1]
  const original = all[0]

  // Build diff between original and latest (if multiple versions)
  let diff: Record<string, { old: unknown; new: unknown }> = {}
  if (all.length > 1 && original && latest) {
    const oldAnswers = (original.answers || {}) as Record<string, unknown>
    const newAnswers = (latest.answers || {}) as Record<string, unknown>
    for (const [key, newVal] of Object.entries(newAnswers)) {
      const oldVal = oldAnswers[key]
      const oldStr = Array.isArray(oldVal) ? (oldVal as string[]).join(', ') : String(oldVal || '')
      const newStr = Array.isArray(newVal) ? (newVal as string[]).join(', ') : String(newVal || '')
      if (oldStr !== newStr && newStr) {
        diff[key] = { old: oldVal, new: newVal }
      }
    }
  }

  return NextResponse.json({
    answers: latest?.answers || {},
    originalAnswers: original?.answers || {},
    diff,
    versions: all.length,
    updateCount: briefing.update_count || 0,
    submittedAt: latest?.submitted_at || latest?.created_at,
    originalSubmittedAt: original?.submitted_at || original?.created_at,
  })
}
