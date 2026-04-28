import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { isAuthed } from '@/lib/auth'

/**
 * Phase 2.1 simplification: there's no real per-user session yet, just a
 * password gate. We treat the first admin row in `users` as "the current
 * user". Once Phase 4 ships proper auth, this endpoint will read from the
 * authenticated session instead.
 */
async function getCurrentUser() {
  const { data, error } = await supabaseAdmin
    .from('users')
    .select('*')
    .eq('role', 'admin')
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()
  if (error || !data) return null
  return data
}

/** GET /api/admin/profile — returns the current admin profile */
export async function GET(req: NextRequest) {
  if (!isAuthed(req))
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const user = await getCurrentUser()
  if (!user) {
    // Graceful fallback if the migration hasn't been applied yet
    return NextResponse.json({
      profile: {
        id: null,
        name: 'Bnny Labs',
        email: '',
        role: 'admin',
        photo_url: null,
        job_title: 'Admin',
      },
    })
  }
  return NextResponse.json({ profile: user })
}

/** PATCH /api/admin/profile — updates name, photo_url, job_title */
export async function PATCH(req: NextRequest) {
  if (!isAuthed(req))
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const body = await req.json()
  const allowed = ['name', 'photo_url', 'job_title'] as const
  const patch: Record<string, string | null> = {}
  for (const key of allowed) {
    if (key in body) patch[key] = body[key] ?? null
  }
  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ ok: true })
  }
  const user = await getCurrentUser()
  if (!user) {
    return NextResponse.json({ error: 'No admin user found' }, { status: 404 })
  }
  patch.updated_at = new Date().toISOString()
  const { error } = await supabaseAdmin
    .from('users')
    .update(patch)
    .eq('id', user.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
