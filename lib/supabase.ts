import { createClient } from '@supabase/supabase-js'

/**
 * Server-side Supabase client.
 *
 * Only the admin (service-key) client is exported. The previous version
 * also exported a `supabase` anon client, which:
 *   1. Was never used anywhere in the app (verified via grep before
 *      this refactor).
 *   2. Created a foot-gun: any future code that reached for the simpler
 *      `supabase` import would silently bypass RLS protection because
 *      the anon role now has zero permissions on every table (see
 *      schema-v11.sql).
 *
 * The previous service-key fallback `... || supabaseAnonKey` was also a
 * silent failure mode: if SUPABASE_SERVICE_KEY were ever missing, the
 * "admin" client would secretly run as anon. With RLS now enabled,
 * that would break every query in production with confusing 0-row
 * responses instead of a clear error. We fail fast at boot instead.
 *
 * Environment variables required:
 *   - NEXT_PUBLIC_SUPABASE_URL  (URL is fine to be public)
 *   - SUPABASE_SERVICE_KEY      (NEVER public — server-side only)
 *
 * NEXT_PUBLIC_SUPABASE_ANON_KEY is no longer read here. It can stay in
 * the Vercel env vars without harm — nothing references it. Removing
 * it entirely is safe but not required.
 */

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY

if (!supabaseUrl) {
  throw new Error('NEXT_PUBLIC_SUPABASE_URL environment variable is required')
}
if (!supabaseServiceKey) {
  throw new Error('SUPABASE_SERVICE_KEY environment variable is required')
}

/** Server-side client with service-role permissions. Bypasses RLS. */
export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey)
