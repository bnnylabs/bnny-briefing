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
    .from('client_contacts')
    .select('*')
    .eq('client_id', id)
    .order('is_primary', { ascending: false })
    .order('created_at', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ contacts: data ?? [] })
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!isAuthed(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params
  const body = await req.json()

  const { name, email, role, language, is_primary, receives_copies, whatsapp, linkedin_url } = body

  if (!name?.trim()) {
    return NextResponse.json({ error: 'name_required' }, { status: 400 })
  }

  // If setting this contact as primary, unset all others first
  if (is_primary) {
    await supabaseAdmin
      .from('client_contacts')
      .update({ is_primary: false })
      .eq('client_id', id)
  }

  const { data, error } = await supabaseAdmin
    .from('client_contacts')
    .insert({
      client_id: id,
      name: name.trim(),
      email: email?.trim() || null,
      role: role?.trim() || null,
      language: language || 'pt-BR',
      is_primary: !!is_primary,
      receives_copies: !!receives_copies,
      whatsapp: whatsapp?.trim() || null,
      linkedin_url: linkedin_url?.trim() || null,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Update last_activity_at
  await supabaseAdmin
    .from('clients')
    .update({ last_activity_at: new Date().toISOString() })
    .eq('id', id)

  return NextResponse.json({ contact: data })
}
