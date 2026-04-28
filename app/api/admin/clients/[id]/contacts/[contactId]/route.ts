import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { isAuthed } from '@/lib/auth'

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; contactId: string }> },
) {
  if (!isAuthed(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id, contactId } = await params
  const body = await req.json()

  // If promoting to primary, demote all others first
  if (body.is_primary) {
    await supabaseAdmin
      .from('client_contacts')
      .update({ is_primary: false })
      .eq('client_id', id)
  }

  const { error } = await supabaseAdmin
    .from('client_contacts')
    .update(body)
    .eq('id', contactId)
    .eq('client_id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; contactId: string }> },
) {
  if (!isAuthed(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id, contactId } = await params

  // Don't allow deleting the only primary contact
  const { data: all } = await supabaseAdmin
    .from('client_contacts')
    .select('id, is_primary')
    .eq('client_id', id)

  const primary = all?.find((c) => c.is_primary)
  if (primary?.id === contactId && (all?.length ?? 0) > 1) {
    return NextResponse.json(
      { error: 'cannot_delete_primary_with_others' },
      { status: 422 },
    )
  }

  const { error } = await supabaseAdmin
    .from('client_contacts')
    .delete()
    .eq('id', contactId)
    .eq('client_id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
