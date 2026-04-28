import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export const runtime = 'nodejs'
export const maxDuration = 30

/**
 * POST /api/upload — public endpoint used by clients filling out a
 * briefing form to attach files (logos, references, brand assets, etc).
 *
 * Stays public BY DESIGN — clients don't have credentials. Hardening:
 *
 *   1. Slug must reference a real briefing. Without this, an attacker
 *      could spam any slug they want and inflate Supabase storage.
 *   2. MIME whitelist — images, PDFs, Word/PPT docs. SVG is REJECTED
 *      because Supabase storage serves it as image/svg+xml inline,
 *      which is an XSS vector if the SVG contains <script>. Clients
 *      who need SVG can convert to PDF/PNG (rare in practice — usually
 *      a one-line "we'll convert it for you" reply suffices).
 *   3. Size cap unchanged at 10MB.
 *
 * Not yet covered by this endpoint (could come in a later iteration):
 *   - Per-IP rate limiting (DOS prevention)
 *   - Magic-byte content-type verification (right now we trust the
 *     browser-reported MIME, which a determined attacker can spoof —
 *     but combined with slug existence check, the abuse surface is
 *     bounded to clients who already have a legitimate briefing link).
 */

// Whitelist of MIMEs we accept on briefing uploads. Excludes SVG, HTML,
// and any text/* type that browsers might render inline.
const ALLOWED_MIMES = new Set<string>([
  // Images
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/gif',
  // Docs
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  // Adobe
  'application/postscript', // .ai
  // Plain text — useful for sharing copy / specs as .txt
  'text/plain',
])

const MAX_BYTES = 10 * 1024 * 1024 // 10MB
const MAX_FIELDID_LEN = 64
const MAX_FILENAME_LEN = 200

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const file = formData.get('file')
    const slugRaw = formData.get('slug')
    const fieldIdRaw = formData.get('fieldId')

    // Type-narrow: formData entries are FormDataEntryValue (string | File).
    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'Missing file' }, { status: 400 })
    }
    if (typeof slugRaw !== 'string' || typeof fieldIdRaw !== 'string') {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }
    const slug = slugRaw.trim()
    const fieldId = fieldIdRaw.trim()

    // Basic shape validation — slug and fieldId have known forms.
    if (!slug || !fieldId) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }
    if (!/^[a-z0-9_-]{1,80}$/i.test(slug)) {
      return NextResponse.json({ error: 'Invalid slug format' }, { status: 400 })
    }
    if (fieldId.length > MAX_FIELDID_LEN || !/^[a-z0-9_-]+$/i.test(fieldId)) {
      return NextResponse.json({ error: 'Invalid fieldId' }, { status: 400 })
    }

    // Existence check — only let through uploads for real briefings.
    // This is the main mitigation against storage spam from random bots.
    const { data: briefing, error: briefingErr } = await supabaseAdmin
      .from('briefings')
      .select('id')
      .eq('slug', slug)
      .maybeSingle()

    if (briefingErr || !briefing) {
      return NextResponse.json(
        { error: 'Briefing not found' },
        { status: 404 },
      )
    }

    // Size check.
    if (file.size > MAX_BYTES) {
      return NextResponse.json(
        { error: 'File too large. Maximum size is 10MB.' },
        { status: 400 },
      )
    }

    // MIME check — reject anything outside the whitelist. Note this
    // trusts the client-reported MIME; a magic-byte sniff would be
    // stronger but more expensive. Combined with the slug existence
    // check above, the abuse surface stays tightly bounded.
    const mime = (file.type || 'application/octet-stream').toLowerCase()
    if (!ALLOWED_MIMES.has(mime)) {
      return NextResponse.json(
        {
          error: `File type not allowed (${mime}). Use PNG, JPG, WebP, GIF, PDF, Word, PowerPoint, Excel, or AI.`,
        },
        { status: 415 },
      )
    }

    // Build storage path: briefings/{slug}/{fieldId}/{timestamp}-{filename}
    const safeName = file.name
      .replace(/[^a-zA-Z0-9._-]/g, '_')
      .slice(0, MAX_FILENAME_LEN)
    const path = `briefings/${slug}/${fieldId}/${Date.now()}-${safeName}`

    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    const { error: uploadError } = await supabaseAdmin.storage
      .from('briefing-files')
      .upload(path, buffer, {
        contentType: mime,
        upsert: false,
      })

    if (uploadError) {
      console.error('[upload] storage error:', uploadError)
      return NextResponse.json({ error: uploadError.message }, { status: 500 })
    }

    const { data: urlData } = supabaseAdmin.storage
      .from('briefing-files')
      .getPublicUrl(path)

    return NextResponse.json({
      url: urlData.publicUrl,
      name: file.name,
      size: file.size,
      type: mime,
      path,
    })
  } catch (error) {
    console.error('[upload] unhandled:', error)
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 })
  }
}
