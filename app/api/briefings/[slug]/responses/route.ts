import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { isAuthed } from '@/lib/auth'

/**
 * GET /api/briefings/[slug]/responses
 *
 * Stays public — the briefing form (app/[slug]/page.tsx) needs to load
 * a client's previous answers when they revisit their unique link to
 * edit. Hardening v0.10.65:
 *
 *   - Slug shape validation (length + charset). Bots probing random
 *     paths get a fast 400 instead of hitting the DB.
 *   - Non-admin requests for non-existent slugs get a uniform 200 with
 *     empty payload, NOT a 404. This prevents slug-existence enumeration
 *     via response code timing/shape — slugs are now strong enough
 *     (8 cryptographic bytes) that the security model is "unguessable
 *     URL == capability token", and we don't want to leak which slugs
 *     are real to scanners.
 *   - Admin requests still get 404 on miss — useful for debugging.
 *
 * Authorization model (the slug acts as the secret):
 *   anyone with the URL can read the responses. This is the same model
 *   that's been live since the briefing system shipped — sharing the
 *   link with the wrong person is a user-side risk, not a server-side
 *   bug. The fix that matters here is making the slug truly unguessable
 *   (which v0.10.65 also addresses in lib/briefing-types.ts).
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params

  // Shape check: real slugs are kebab-base + dash + base64url suffix.
  // Reject anything wildly different to swat bot probes early.
  if (typeof slug !== 'string' || slug.length === 0 || slug.length > 80) {
    return NextResponse.json({ error: 'Invalid slug' }, { status: 400 })
  }
  if (!/^[a-zA-Z0-9_-]+$/.test(slug)) {
    return NextResponse.json({ error: 'Invalid slug' }, { status: 400 })
  }

  const adminMode = isAuthed(req)

  const { data: briefing } = await supabaseAdmin
    .from('briefings')
    .select('id, update_count')
    .eq('slug', slug)
    .maybeSingle()

  if (!briefing) {
    if (adminMode) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }
    // Non-admin probe: respond identically to "exists but no responses"
    // so 404 vs 200-empty doesn't leak existence.
    return NextResponse.json({
      answers: {},
      originalAnswers: {},
      diff: {},
      versions: 0,
      updateCount: 0,
      submittedAt: null,
      originalSubmittedAt: null,
    })
  }

  // Order by submitted_at, not by id (which is gen_random_uuid()) — id
  // sort gives non-chronological chaos. submitted_at is monotonic on
  // insert and gives true ordering across all versions.
  const { data: responses } = await supabaseAdmin
    .from('responses')
    .select('*')
    .eq('briefing_id', briefing.id)
    .order('submitted_at', { ascending: true })

  const all = responses || []
  const latest = all[all.length - 1]
  const previousVersion = all.length >= 2 ? all[all.length - 2] : null

  const diff: Record<string, { old: unknown; new: unknown }> = {}
  if (previousVersion && latest) {
    const oldAnswers = (previousVersion.answers || {}) as Record<string, unknown>
    const newAnswers = (latest.answers || {}) as Record<string, unknown>
    const allKeys = new Set([
      ...Object.keys(oldAnswers),
      ...Object.keys(newAnswers),
    ])
    for (const key of allKeys) {
      const oldVal = oldAnswers[key]
      const newVal = newAnswers[key]
      const oldStr = Array.isArray(oldVal)
        ? (oldVal as string[]).join(', ')
        : String(oldVal ?? '')
      const newStr = Array.isArray(newVal)
        ? (newVal as string[]).join(', ')
        : String(newVal ?? '')
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
