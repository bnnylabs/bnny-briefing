import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export const runtime = 'nodejs'
export const maxDuration = 30

function isAuthed(req: NextRequest) {
  const cookie = req.cookies.get('bnny_auth')
  return cookie?.value === (process.env.ADMIN_PASSWORD || 'bnny2024')
}

const BUCKET = 'briefing-files'
const MAX_BYTES = 2 * 1024 * 1024 // 2 MB ceiling — logos should be small
const ALLOWED_MIME = new Set([
  'image/svg+xml',
  'image/png',
  'image/jpeg',
  'image/webp',
])

/**
 * POST /api/admin/brand/upload
 * Accepts a single logo file, stores it under brand/, returns a public URL.
 */
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
        { error: 'Formato não suportado. Use SVG, PNG, JPG ou WebP.' },
        { status: 400 },
      )
    }

    const ext = (file.name.split('.').pop() || 'bin').toLowerCase()
    // Cache-busting filename so browsers pick up new uploads immediately
    const path = `brand/logo-${Date.now()}.${ext}`

    const buffer = Buffer.from(await file.arrayBuffer())
    const { error: uploadError } = await supabaseAdmin.storage
      .from(BUCKET)
      .upload(path, buffer, {
        contentType: file.type,
        upsert: true,
      })
    if (uploadError) {
      return NextResponse.json({ error: uploadError.message }, { status: 500 })
    }

    const { data: urlData } = supabaseAdmin.storage
      .from(BUCKET)
      .getPublicUrl(path)

    // Persist URL in settings table
    await supabaseAdmin.from('settings').upsert(
      {
        key: 'brand_logo_url',
        value: urlData.publicUrl,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'key' },
    )

    return NextResponse.json({ url: urlData.publicUrl, path })
  } catch (error) {
    console.error('Brand upload failed:', error)
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 })
  }
}

/**
 * DELETE /api/admin/brand/upload
 * Removes the brand_logo_url setting (falls back to bundled SVG).
 */
export async function DELETE(req: NextRequest) {
  if (!isAuthed(req))
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  await supabaseAdmin.from('settings').upsert(
    {
      key: 'brand_logo_url',
      value: '',
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'key' },
  )
  return NextResponse.json({ ok: true })
}
