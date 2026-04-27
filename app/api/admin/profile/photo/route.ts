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

/** POST — uploads a photo and updates the current admin's photo_url */
export async function POST(req: NextRequest) {
  if (!isAuthed(req))
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const formData = await req.formData()
    const file = formData.get('file') as File | null
    if (!file) {
      return NextResponse.json({ error: 'Missing file' }, { status: 400 })
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json(
        { error: 'Arquivo muito grande. Máximo 2 MB.' },
        { status: 400 },
      )
    }
    if (!ALLOWED_MIME.has(file.type)) {
      return NextResponse.json(
        { error: 'Use PNG, JPG ou WebP.' },
        { status: 400 },
      )
    }

    const ext = (file.name.split('.').pop() || 'png').toLowerCase()
    const path = `user/photo-${Date.now()}.${ext}`

    const buffer = Buffer.from(await file.arrayBuffer())
    const { error: uploadError } = await supabaseAdmin.storage
      .from(BUCKET)
      .upload(path, buffer, { contentType: file.type, upsert: true })
    if (uploadError) {
      return NextResponse.json(
        { error: uploadError.message },
        { status: 500 },
      )
    }

    const { data: urlData } = supabaseAdmin.storage
      .from(BUCKET)
      .getPublicUrl(path)

    // Update the first admin row's photo_url
    const { data: admin } = await supabaseAdmin
      .from('users')
      .select('id')
      .eq('role', 'admin')
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle()

    if (admin?.id) {
      await supabaseAdmin
        .from('users')
        .update({
          photo_url: urlData.publicUrl,
          updated_at: new Date().toISOString(),
        })
        .eq('id', admin.id)
    }

    return NextResponse.json({ url: urlData.publicUrl })
  } catch (error) {
    console.error('Photo upload failed:', error)
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 })
  }
}

/** DELETE — clears photo_url on the admin row */
export async function DELETE(req: NextRequest) {
  if (!isAuthed(req))
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: admin } = await supabaseAdmin
    .from('users')
    .select('id')
    .eq('role', 'admin')
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()
  if (admin?.id) {
    await supabaseAdmin
      .from('users')
      .update({ photo_url: null, updated_at: new Date().toISOString() })
      .eq('id', admin.id)
  }
  return NextResponse.json({ ok: true })
}
