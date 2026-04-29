import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { requireAuth } from '@/lib/auth'

/**
 * POST /api/admin/clients/[clientId]/contacts/from-decision
 *
 * Creates a non-primary, non-copy-receiver contact from the actor data
 * captured in a proposal_activity row. Triggered by the "Adicionar como
 * contato" button on the admin proposal page when someone outside the
 * cadastro approves/rejects.
 *
 * Body:
 *   { name: string, email: string, lang?: 'pt-BR'|'en-US' }
 *
 * Validation:
 *   - clientId exists
 *   - name + email required
 *   - email shape pragmatic check
 *   - reject if email already belongs to a contact of this client (the
 *     UI shouldn't even surface the alert in that case, but defend
 *     against double-clicks / stale state)
 */

function isValidEmail(s: string): boolean {
  if (s.length > 320 || /\s/.test(s)) return false
  const at = s.indexOf('@')
  if (at <= 0 || at === s.length - 1) return false
  return s.slice(at + 1).includes('.')
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ clientId: string }> },
) {
  const unauth = requireAuth(req)
  if (unauth) return unauth

  const { clientId } = await params
  if (!clientId || !/^[0-9a-f-]{36}$/i.test(clientId)) {
    return NextResponse.json({ error: 'Invalid clientId' }, { status: 400 })
  }

  let body: Record<string, unknown>
  try {
    body = (await req.json()) as Record<string, unknown>
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const name = typeof body.name === 'string' ? body.name.trim() : ''
  const email = typeof body.email === 'string' ? body.email.trim() : ''
  const langRaw = typeof body.lang === 'string' ? body.lang : ''
  const language: 'pt-BR' | 'en-US' = langRaw === 'en-US' ? 'en-US' : 'pt-BR'

  if (!name || name.length > 200) {
    return NextResponse.json({ error: 'Nome inválido' }, { status: 400 })
  }
  if (!email || !isValidEmail(email)) {
    return NextResponse.json({ error: 'E-mail inválido' }, { status: 400 })
  }

  // Confirm the client exists. Cheap, defensive — protects against
  // stale URLs that point to deleted clients.
  const { data: client } = await supabaseAdmin
    .from('clients')
    .select('id')
    .eq('id', clientId)
    .maybeSingle()
  if (!client) {
    return NextResponse.json({ error: 'Cliente não encontrado' }, { status: 404 })
  }

  // Refuse to create a duplicate. Email is unique per client by
  // convention (no UNIQUE constraint, but the alert on the admin page
  // uses email as the dedup key — doing the same here keeps it consistent).
  const { data: existing } = await supabaseAdmin
    .from('client_contacts')
    .select('id')
    .eq('client_id', clientId)
    .eq('email', email)
    .maybeSingle()
  if (existing) {
    return NextResponse.json(
      { error: 'Já existe um contato com este e-mail neste cliente' },
      { status: 409 },
    )
  }

  const { data: created, error } = await supabaseAdmin
    .from('client_contacts')
    .insert({
      client_id: clientId,
      name,
      email,
      language,
      is_primary: false,
      receives_copies: false,
    })
    .select('id, name, email, language')
    .single()

  if (error) {
    console.error('[contacts/from-decision] insert failed:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, contact: created })
}
