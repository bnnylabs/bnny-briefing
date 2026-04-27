import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

function isAuthed(req: NextRequest) {
  const cookie = req.cookies.get('bnny_auth')
  return cookie?.value === (process.env.ADMIN_PASSWORD || 'bnny2024')
}

// Notes are append-only — no editing text after creation.
// PATCH only toggles is_pinned. No DELETE endpoint by design.
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; noteId: string }> },
) {
  if (!isAuthed(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id, noteId } = await params
  const { is_pinned } = await req.json()

  if (typeof is_pinned !== 'boolean') {
    return NextResponse.json({ error: 'is_pinned_required' }, { status: 400 })
  }

  const { error } = await supabaseAdmin
    .from('client_notes')
    .update({ is_pinned })
    .eq('id', noteId)
    .eq('client_id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
