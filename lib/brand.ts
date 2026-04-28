import { supabaseAdmin } from '@/lib/supabase'

/**
 * Brand identity for the app. Drives:
 *  - sidebar logo
 *  - email "from name" and signature
 *  - "Briefing submitted" success screen
 *  - favicon (eventually)
 *
 * All fields are stored as rows in the `settings` table (key/value pairs).
 * Defaults below are used when a row is missing.
 */
export interface Brand {
  /** Display name of the company. Shown in sidebar fallback, emails, success screen. */
  name: string
  /** URL of the uploaded logo. When null, the bundled SVG (`<Logo />`) is used. */
  logoUrl: string | null
  /** From-name used in transactional emails. Defaults to {name}. */
  emailFromName: string
  /** Footer text appended to email templates. */
  emailSignature: string
  /** Hex like "#12fea9" — currently informational only; we apply via CSS later. */
  primaryColor: string | null
}

export const DEFAULT_BRAND: Brand = {
  name: 'Bnny Labs',
  logoUrl: null,
  emailFromName: 'Bnny Labs',
  emailSignature: 'Bnny Labs · briefing.bnnylabs.com',
  primaryColor: null,
}

const KEYS = {
  name: 'brand_name',
  logoUrl: 'brand_logo_url',
  emailFromName: 'brand_email_from_name',
  emailSignature: 'brand_email_signature',
  primaryColor: 'brand_primary_color',
} as const

/** Server-only: load brand from DB. Falls back to defaults on missing rows or errors. */
export async function getBrand(): Promise<Brand> {
  try {
    const { data, error } = await supabaseAdmin
      .from('settings')
      .select('key, value')
      .in('key', Object.values(KEYS))
    if (error || !data) return DEFAULT_BRAND
    const map = Object.fromEntries(data.map((r) => [r.key, r.value])) as Record<
      string,
      string | null
    >
    const name = map[KEYS.name] || DEFAULT_BRAND.name
    return {
      name,
      logoUrl: map[KEYS.logoUrl] || null,
      emailFromName: map[KEYS.emailFromName] || name,
      emailSignature:
        map[KEYS.emailSignature] || DEFAULT_BRAND.emailSignature,
      primaryColor: map[KEYS.primaryColor] || null,
    }
  } catch {
    return DEFAULT_BRAND
  }
}

/** Map of internal field name → settings table key, exposed for the Config UI. */
export const BRAND_KEYS = KEYS
