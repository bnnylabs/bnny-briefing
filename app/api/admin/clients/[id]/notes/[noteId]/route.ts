import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { isAuthed } from '@/lib/auth'

// Notes can be unpinned/repinned via PATCH and removed via DELETE.
// Body text remains immutable after creation (no PUT) — that's still
// by design: notes are timestamped commentary, not editable content.
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

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; noteId: string }> },
) {
  if (!isAuthed(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id, noteId } = await params

  // Match both id and client_id to prevent cross-client deletion if a
  // noteId is somehow guessed — server-side defense in depth.
  const { error } = await supabaseAdmin
    .from('client_notes')
    .delete()
    .eq('id', noteId)
    .eq('client_id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
