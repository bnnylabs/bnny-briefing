import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export const runtime = 'nodejs'
export const maxDuration = 30

function isAuthed(req: NextRequest) {
  const cookie = req.cookies.get('bnny_auth')
  return cookie?.value === (process.env.ADMIN_PASSWORD || 'bnny2024')
}

const BUCKET = 'briefing-files'
const MAX_BYTES = 2 * 1024 * 1024
const ALLOWED_MIME = new Set(['image/png', 'image/jpeg', 'image/webp'])

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string; contactId: string } },
) {
  if (!isAuthed(req))
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

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
    const path = `clients/${params.id}/contacts/${params.contactId}-${Date.now()}.${ext}`

    const buffer = Buffer.from(await file.arrayBuffer())
    const { error: uploadError } = await supabaseAdmin.storage
      .from(BUCKET)
      .upload(path, buffer, { contentType: file.type, upsert: true })

    if (uploadError)
      return NextResponse.json({ error: uploadError.message }, { status: 500 })

    const { data: urlData } = supabaseAdmin.storage.from(BUCKET).getPublicUrl(path)

    await supabaseAdmin
      .from('client_contacts')
      .update({ avatar_url: urlData.publicUrl })
      .eq('id', params.contactId)

    return NextResponse.json({ url: urlData.publicUrl })
  } catch (e) {
    console.error('Contact avatar upload failed:', e)
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 })
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string; contactId: string } },
) {
  if (!isAuthed(req))
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  await supabaseAdmin
    .from('client_contacts')
    .update({ avatar_url: null })
    .eq('id', params.contactId)

  return NextResponse.json({ ok: true })
}
