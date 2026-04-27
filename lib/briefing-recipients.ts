import { supabaseAdmin } from './supabase'

export type BriefingRecipient = {
  email: string
  name: string
  role: 'primary' | 'cc'
  language: string
}

/**
 * Resolve the canonical recipient list for a briefing send.
 *
 * Priority:
 *   1. client_contacts WHERE is_primary = true       → role: 'primary'
 *   2. client_contacts WHERE receives_copies = true  → role: 'cc'
 *   3. Fallback: clients.email/name (legacy clients without contact rows)
 *
 * Deduplicates by email (case-insensitive). If the same email appears as
 * both primary and CC, the primary entry wins and the CC is dropped.
 *
 * Each recipient carries their own language preference for templating.
 */
export async function resolveBriefingRecipients(
  clientId: string,
  fallback: { name: string; email: string | null },
): Promise<BriefingRecipient[]> {
  const { data: contacts } = await supabaseAdmin
    .from('client_contacts')
    .select('name, email, language, is_primary, receives_copies')
    .eq('client_id', clientId)

  const recipients: BriefingRecipient[] = []
  const seen = new Set<string>()

  // Primary
  const primary = (contacts ?? []).find(c => c.is_primary && c.email)
  if (primary?.email) {
    recipients.push({
      email: primary.email,
      name: primary.name,
      role: 'primary',
      language: primary.language || 'pt-BR',
    })
    seen.add(primary.email.toLowerCase())
  } else if (fallback.email) {
    // No primary contact configured — use legacy clients table fields
    recipients.push({
      email: fallback.email,
      name: fallback.name,
      role: 'primary',
      language: 'pt-BR',
    })
    seen.add(fallback.email.toLowerCase())
  }

  // CCs (skip if email already used by primary)
  for (const c of contacts ?? []) {
    if (!c.receives_copies || c.is_primary || !c.email) continue
    const k = c.email.toLowerCase()
    if (seen.has(k)) continue
    recipients.push({
      email: c.email,
      name: c.name,
      role: 'cc',
      language: c.language || 'pt-BR',
    })
    seen.add(k)
  }

  return recipients
}
