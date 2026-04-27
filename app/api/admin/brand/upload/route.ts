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

// Two upload "kinds" — the app logo (renders in admin UI, can be SVG) and
// the email logo (renders in email clients, must be raster: PNG/JPG only).
// Outlook in particular won't render SVG, and Gmail will downscale poorly.
type Kind = 'app' | 'email'

const CONFIG: Record<Kind, { mimes: Set<string>; settingsKey: string; pathPrefix: string }> = {
  app: {
    mimes: new Set(['image/svg+xml', 'image/png', 'image/jpeg', 'image/webp']),
    settingsKey: 'brand_logo_url',
    pathPrefix: 'brand/logo',
  },
  email: {
    // PNG strongly preferred for transparency, JPG accepted as fallback.
    mimes: new Set(['image/png', 'image/jpeg']),
    settingsKey: 'brand_logo_email',
    pathPrefix: 'brand/email-logo',
  },
}

function parseKind(req: NextRequest): Kind {
  const k = req.nextUrl.searchParams.get('kind')
  return k === 'email' ? 'email' : 'app'
}

/**
 * POST /api/admin/brand/upload?kind=app|email
 * Stores the uploaded image under the bucket and persists its public URL
 * in the matching settings key. `kind=app` is the default for backward
 * compatibility with the existing call site.
 */
export async function POST(req: NextRequest) {
  if (!isAuthed(req))
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const kind = parseKind(req)
  const { mimes, settingsKey, pathPrefix } = CONFIG[kind]

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
    if (!mimes.has(file.type)) {
      const allowed = kind === 'email' ? 'PNG ou JPG' : 'SVG, PNG, JPG ou WebP'
      return NextResponse.json(
        { error: `Formato não suportado. Use ${allowed}.` },
        { status: 400 },
      )
    }

    const ext = (file.name.split('.').pop() || 'bin').toLowerCase()
    const path = `${pathPrefix}-${Date.now()}.${ext}`

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

    await supabaseAdmin.from('settings').upsert(
      {
        key: settingsKey,
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
 * DELETE /api/admin/brand/upload?kind=app|email
 * Clears the corresponding settings key (falls back to bundled SVG / text).
 */
export async function DELETE(req: NextRequest) {
  if (!isAuthed(req))
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const kind = parseKind(req)
  const { settingsKey } = CONFIG[kind]

  await supabaseAdmin.from('settings').upsert(
    {
      key: settingsKey,
      value: '',
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'key' },
  )
  return NextResponse.json({ ok: true })
}
