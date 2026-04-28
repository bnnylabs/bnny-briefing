import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { isAuthed } from '@/lib/auth'

export const runtime = 'nodejs'
export const maxDuration = 30

const BUCKET = 'briefing-files'
const MAX_BYTES = 2 * 1024 * 1024
const ALLOWED_MIME = new Set(['image/png', 'image/jpeg', 'image/webp'])

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!isAuthed(req))
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params

  try {
    const formData = await req.formData()
    const file = formData.get('file') as File | null
    if (!file)
      return NextResponse.json({ error: 'Missing file' }, { status: 400 })
    if (file.size > MAX_BYTES)
      return NextResponse.json({ error: 'Máximo 2 MB.' }, { status: 400 })
    if (!ALLOWED_MIME.has(file.type))
      return NextResponse.json({ error: 'Use PNG, JPG ou WebP.' }, { status: 400 })

    const ext = (file.name.split('.').pop() || 'png').toLowerCase()
    const path = `clients/${id}/avatar-${Date.now()}.${ext}`

    const buffer = Buffer.from(await file.arrayBuffer())
    const { error: uploadError } = await supabaseAdmin.storage
      .from(BUCKET)
      .upload(path, buffer, { contentType: file.type, upsert: true })

    if (uploadError)
      return NextResponse.json({ error: uploadError.message }, { status: 500 })

    const { data: urlData } = supabaseAdmin.storage.from(BUCKET).getPublicUrl(path)

    await supabaseAdmin
      .from('clients')
      .update({ avatar_url: urlData.publicUrl })
      .eq('id', id)

    return NextResponse.json({ url: urlData.publicUrl })
  } catch (e) {
    console.error('Client avatar upload failed:', e)
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 })
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!isAuthed(req))
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params

  await supabaseAdmin
    .from('clients')
    .update({ avatar_url: null })
    .eq('id', id)

  return NextResponse.json({ ok: true })
}
