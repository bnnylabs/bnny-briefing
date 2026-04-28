import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { isAuthed } from '@/lib/auth'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!isAuthed(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params

  const { data, error } = await supabaseAdmin
    .from('client_notes')
    .select('*')
    .eq('client_id', id)
    // Pinned notes first, then newest first
    .order('is_pinned', { ascending: false })
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ notes: data ?? [] })
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!isAuthed(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params
  const { body_markdown } = await req.json()

  if (!body_markdown?.trim()) {
    return NextResponse.json({ error: 'body_required' }, { status: 400 })
  }

  const { data, error } = await supabaseAdmin
    .from('client_notes')
    .insert({ client_id: id, body_markdown: body_markdown.trim() })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await supabaseAdmin
    .from('clients')
    .update({ last_activity_at: new Date().toISOString() })
    .eq('id', id)

  return NextResponse.json({ note: data })
}
