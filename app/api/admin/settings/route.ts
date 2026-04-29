import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { isAuthed } from '@/lib/auth'

/**
 * /api/admin/settings — admin-only, simple key/value store.
 *
 * GET   → returns the full settings map as { key: value }.
 * POST  → upserts one or many key/value pairs in a single round-trip.
 *
 * The previous POST handler iterated through Object.entries and awaited
 * an upsert per row, producing N round-trips to Supabase for N keys
 * (saving 10 settings = 10 sequential round-trips). It also had no
 * partial-failure handling — if the 5th upsert failed, the first 4
 * were already persisted with no rollback. This version uses a single
 * upsert with an array, so all keys land atomically and we issue one
 * request to the DB regardless of payload size.
 */

export async function GET(req: NextRequest) {
  if (!isAuthed(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data, error } = await supabaseAdmin.from('settings').select('key, value')
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const settings: Record<string, string> = {}
  data?.forEach((s) => {
    settings[s.key] = s.value || ''
  })
  return NextResponse.json({ settings })
}

export async function POST(req: NextRequest) {
  if (!isAuthed(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return NextResponse.json(
      { error: 'Body must be a JSON object of key/value pairs' },
      { status: 400 },
    )
  }

  const entries = Object.entries(body as Record<string, unknown>)
  if (entries.length === 0) {
    // Nothing to do — bail early without hitting the DB.
    return NextResponse.json({ ok: true, updated: 0 })
  }

  // Build the rows for a single batch upsert. Coerce values to string
  // because the column is TEXT and we want consistent storage even if
  // the client accidentally sends a number or boolean.
  const now = new Date().toISOString()
  const rows = entries.map(([key, value]) => ({
    key,
    value: value === null || value === undefined ? '' : String(value),
    updated_at: now,
  }))

  const { error } = await supabaseAdmin
    .from('settings')
    .upsert(rows, { onConflict: 'key' })

  if (error) {
    console.error('[admin/settings] upsert failed:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, updated: rows.length })
}
