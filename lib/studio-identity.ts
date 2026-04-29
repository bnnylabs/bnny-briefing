/**
 * Studio identity — singleton record with editable studio info
 * (name, contact, address, social, voice manifesto, etc).
 *
 * Used by:
 *   - /admin/config/propostas (Estúdio tab) — edits the row
 *   - /p/[slug] (public proposal view) — renders the footer
 *   - Future: emails, PDFs, AI context for proposal generation
 *
 * The table is enforced as a singleton by the SQL CHECK constraint
 * (id must equal 'default'), so we never deal with multiple rows.
 */

import { cache } from 'react'
import { supabaseAdmin } from '@/lib/supabase'

export interface StudioIdentity {
  studio_name: string
  tagline: string | null
  email_contact: string
  phone_contact: string | null
  whatsapp_contact: string | null
  website: string | null
  address: string | null
  city: string | null
  state: string | null
  country: string | null
  cnpj: string | null
  social_links: Record<string, string>
  footer_disclaimer: string | null
  voice_manifesto: string | null
  updated_at: string
}

/**
 * Hardcoded fallback used in two scenarios:
 *   1. Migration v12 hasn't run yet — getStudioIdentity returns
 *      these values so the app keeps rendering as before.
 *   2. The DB read fails for any reason — better to show old
 *      hardcoded values than render an empty footer.
 *
 * The owner can override every field via the Estúdio tab; these
 * defaults match the previous hardcoded values in /p/[slug].
 */
export const STUDIO_IDENTITY_DEFAULTS: StudioIdentity = {
  studio_name: 'Bnny Labs',
  tagline: null,
  email_contact: 'gustavo@bnnylabs.com',
  phone_contact: '+55 47 98844 8858',
  whatsapp_contact: '5547988448858',
  website: 'https://bnnylabs.com',
  address: null,
  city: null,
  state: null,
  country: 'Brasil',
  cnpj: null,
  social_links: {},
  footer_disclaimer: null,
  voice_manifesto: null,
  updated_at: new Date(0).toISOString(),
}

/**
 * Read the singleton studio_identity row. Cached per request via
 * React's `cache()` so repeated calls within the same render don't
 * hit the DB more than once. The cache scope is the React rendering
 * pass, NOT global — so updates from the admin UI become visible
 * on the next request.
 *
 * Returns the DEFAULTS if the row is missing (DB never seeded) or
 * the read fails. Never throws — UI rendering must not break on
 * a config-table glitch.
 */
export const getStudioIdentity = cache(async (): Promise<StudioIdentity> => {
  try {
    const { data, error } = await supabaseAdmin
      .from('studio_identity')
      .select('*')
      .eq('id', 'default')
      .maybeSingle()

    if (error || !data) {
      if (error) {
        console.error('[studio-identity] read failed, using defaults:', error)
      }
      return STUDIO_IDENTITY_DEFAULTS
    }

    // Coerce social_links — JSONB can come back as null in edge cases.
    const social =
      data.social_links && typeof data.social_links === 'object'
        ? (data.social_links as Record<string, string>)
        : {}

    return {
      studio_name: data.studio_name ?? STUDIO_IDENTITY_DEFAULTS.studio_name,
      tagline: data.tagline ?? null,
      email_contact: data.email_contact ?? STUDIO_IDENTITY_DEFAULTS.email_contact,
      phone_contact: data.phone_contact ?? null,
      whatsapp_contact: data.whatsapp_contact ?? null,
      website: data.website ?? null,
      address: data.address ?? null,
      city: data.city ?? null,
      state: data.state ?? null,
      country: data.country ?? null,
      cnpj: data.cnpj ?? null,
      social_links: social,
      footer_disclaimer: data.footer_disclaimer ?? null,
      voice_manifesto: data.voice_manifesto ?? null,
      updated_at: data.updated_at ?? new Date().toISOString(),
    }
  } catch (e) {
    console.error('[studio-identity] read threw, using defaults:', e)
    return STUDIO_IDENTITY_DEFAULTS
  }
})

/**
 * Update the singleton row. Accepts a partial — only the fields
 * provided are written. studio_name and email_contact are NOT
 * NULL in the schema, so the caller must avoid passing empty
 * strings for those (the API route validates).
 */
export async function updateStudioIdentity(
  patch: Partial<Omit<StudioIdentity, 'updated_at'>>,
): Promise<{ ok: true } | { ok: false; error: string }> {
  // Strip undefined keys so the upsert doesn't try to overwrite
  // existing values with null. social_links empty object is fine.
  const cleanPatch: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(patch)) {
    if (v !== undefined) cleanPatch[k] = v
  }
  cleanPatch.updated_at = new Date().toISOString()

  const { error } = await supabaseAdmin
    .from('studio_identity')
    .update(cleanPatch)
    .eq('id', 'default')

  if (error) {
    console.error('[studio-identity] update failed:', error)
    return { ok: false, error: error.message }
  }
  return { ok: true }
}

/**
 * Format the studio's location into a single readable line:
 *   "Blumenau, SC — Brasil"
 * Returns null if no location data is present.
 */
export function formatStudioLocation(s: StudioIdentity): string | null {
  const parts = [s.city, s.state].filter(Boolean).join(', ')
  if (!parts && !s.country) return null
  if (!parts) return s.country
  if (!s.country) return parts
  return `${parts} — ${s.country}`
}
