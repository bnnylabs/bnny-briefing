import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import {
  getStudioIdentity,
  updateStudioIdentity,
  type StudioIdentity,
} from '@/lib/studio-identity'

/**
 * GET /api/admin/studio-identity
 * Returns the current studio identity row. Admin-only.
 */
export async function GET(req: NextRequest) {
  const unauthorized = requireAuth(req)
  if (unauthorized) return unauthorized

  const studio = await getStudioIdentity()
  return NextResponse.json({ studio })
}

/**
 * PUT /api/admin/studio-identity
 * Partial update of the singleton row. Body is a JSON object with
 * any subset of the editable fields. Admin-only.
 *
 * Validation:
 *   - If studio_name or email_contact are present, must be non-empty.
 *   - social_links must be an object of string values if present.
 *   - Unknown fields in the body are ignored (whitelist approach).
 */
const EDITABLE_FIELDS: ReadonlyArray<keyof Omit<StudioIdentity, 'updated_at'>> = [
  'studio_name',
  'tagline',
  'email_contact',
  'phone_contact',
  'whatsapp_contact',
  'website',
  'address',
  'city',
  'state',
  'country',
  'cnpj',
  'social_links',
  'footer_disclaimer',
  'voice_manifesto',
]

export async function PUT(req: NextRequest) {
  const unauthorized = requireAuth(req)
  if (unauthorized) return unauthorized

  let body: Record<string, unknown>
  try {
    body = (await req.json()) as Record<string, unknown>
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return NextResponse.json(
      { error: 'Body must be a JSON object' },
      { status: 400 },
    )
  }

  // Whitelist + light validation. Unknown keys are silently dropped.
  const patch: Partial<Omit<StudioIdentity, 'updated_at'>> = {}

  for (const field of EDITABLE_FIELDS) {
    if (!(field in body)) continue
    const value = body[field]

    if (field === 'social_links') {
      if (value === null) {
        patch.social_links = {}
        continue
      }
      if (typeof value !== 'object' || Array.isArray(value)) {
        return NextResponse.json(
          { error: 'social_links must be an object' },
          { status: 400 },
        )
      }
      // Coerce all values to strings (frontend may send null for empty fields)
      const coerced: Record<string, string> = {}
      for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
        if (v !== null && v !== undefined && v !== '') {
          coerced[k] = String(v)
        }
      }
      patch.social_links = coerced
      continue
    }

    // Required-non-empty fields: refuse blanking them
    if (field === 'studio_name' || field === 'email_contact') {
      if (typeof value !== 'string' || value.trim() === '') {
        return NextResponse.json(
          { error: `${field} cannot be empty` },
          { status: 400 },
        )
      }
      patch[field] = value.trim()
      continue
    }

    // Optional string fields — accept null/empty as "clear it"
    if (value === null || value === '') {
      patch[field] = null
    } else if (typeof value === 'string') {
      patch[field] = value.trim()
    } else {
      return NextResponse.json(
        { error: `${field} must be a string or null` },
        { status: 400 },
      )
    }
  }

  const result = await updateStudioIdentity(patch)
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
}
