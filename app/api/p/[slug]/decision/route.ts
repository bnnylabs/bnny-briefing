import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import {
  sendProposalApprovedToAdmin,
  sendProposalRejectedToAdmin,
  sendProposalApprovedToActor,
  sendProposalRejectedToActor,
} from '@/lib/email'
import { getStudioIdentity } from '@/lib/studio-identity'

/**
 * POST /api/p/[slug]/decision
 *
 * Public endpoint — the client clicks "Aprovar" or "Recusar" on the
 * public proposal page, the form submits here. No auth (clients have
 * no credentials); the slug acts as the capability token.
 *
 * Body shapes:
 *   approve: { action: 'approve', actor_name, actor_email, terms_accepted: true }
 *   reject:  { action: 'reject',  actor_name, actor_email, reason?: string }
 *
 * Both shapes capture name + email so the admin knows who acted.
 * Approval requires the terms_accepted flag (mirrors the checkbox
 * the client ticked in the dialog). Reject's reason is optional —
 * empty string and missing field are both treated as "no reason given".
 *
 * Atomic transition (winner-takes-all):
 *   The status update only goes through if proposals.status is currently
 *   'sent' or 'viewed'. Anything else (already approved, rejected, draft,
 *   expired) returns 409 — no double-fire of the admin email if the
 *   client double-clicks or hits the endpoint via a second tab.
 *
 * Side effects on success:
 *   - proposals row updated: status, approved_at OR rejected_at,
 *     rejection_reason if relevant
 *   - proposal_activity row inserted with full capture in details JSONB
 *   - email fired to admin via sendProposalApprovedToAdmin /
 *     sendProposalRejectedToAdmin (best-effort — failure is logged
 *     but doesn't roll back the decision)
 */

const SLUG_RE = /^[a-zA-Z0-9_-]{1,80}$/
const MAX_NAME = 200
const MAX_EMAIL = 320 // RFC 5321 max
const MAX_REASON = 2000

function isValidEmail(s: string): boolean {
  // Pragmatic check — full RFC 5322 is impractical. Reject obvious junk
  // (no @, no dot in domain, whitespace inside).
  if (s.length > MAX_EMAIL) return false
  if (/\s/.test(s)) return false
  const at = s.indexOf('@')
  if (at <= 0 || at === s.length - 1) return false
  const domain = s.slice(at + 1)
  if (!domain.includes('.')) return false
  return true
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params

  // Slug shape check — bots probing random paths get a 400 fast.
  if (!SLUG_RE.test(slug)) {
    return NextResponse.json({ error: 'Invalid slug' }, { status: 400 })
  }

  let body: Record<string, unknown>
  try {
    body = (await req.json()) as Record<string, unknown>
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const action = body.action
  if (action !== 'approve' && action !== 'reject') {
    return NextResponse.json(
      { error: 'action must be "approve" or "reject"' },
      { status: 400 },
    )
  }

  const actor_name =
    typeof body.actor_name === 'string' ? body.actor_name.trim() : ''
  const actor_email =
    typeof body.actor_email === 'string' ? body.actor_email.trim() : ''

  if (!actor_name || actor_name.length > MAX_NAME) {
    return NextResponse.json(
      { error: 'Nome é obrigatório (até 200 caracteres)' },
      { status: 400 },
    )
  }
  if (!actor_email || !isValidEmail(actor_email)) {
    return NextResponse.json(
      { error: 'E-mail válido é obrigatório' },
      { status: 400 },
    )
  }

  // Approval-specific: terms checkbox MUST be true.
  if (action === 'approve') {
    if (body.terms_accepted !== true) {
      return NextResponse.json(
        { error: 'Aceite dos termos é obrigatório' },
        { status: 400 },
      )
    }
  }

  // Reject-specific: reason is optional but capped if present.
  const reason =
    action === 'reject' && typeof body.reason === 'string'
      ? body.reason.trim().slice(0, MAX_REASON)
      : ''

  // Language hint from the public page. Used both in the actor-facing
  // confirmation email and to select error messages we send back. We
  // intentionally accept short codes ('pt'/'en') and full codes
  // ('pt-BR'/'en-US') because the page passes the short form.
  const langInput = typeof body.lang === 'string' ? body.lang : ''
  const actorLang: 'pt-BR' | 'en-US' =
    langInput === 'en' || langInput === 'en-US' ? 'en-US' : 'pt-BR'

  // Look up the proposal. Use maybeSingle to avoid 500 on miss.
  const { data: proposal, error: lookupErr } = await supabaseAdmin
    .from('proposals')
    .select('id, status, title, number, version_suffix, client_id, clients(name, company)')
    .eq('slug', slug)
    .maybeSingle()

  if (lookupErr) {
    return NextResponse.json({ error: lookupErr.message }, { status: 500 })
  }
  if (!proposal) {
    return NextResponse.json({ error: 'Proposta não encontrada' }, { status: 404 })
  }

  // Atomic transition: only proceed if status is currently 'sent' or 'viewed'.
  // The .in() narrows the row out from under any concurrent request that
  // already advanced the status. Winner gets the row, loser gets null.
  const nowIso = new Date().toISOString()
  const newStatus = action === 'approve' ? 'approved' : 'rejected'
  const update: Record<string, unknown> = {
    status: newStatus,
    updated_at: nowIso,
  }
  if (action === 'approve') update.approved_at = nowIso
  if (action === 'reject') {
    update.rejected_at = nowIso
    update.rejection_reason = reason || null
  }

  const { data: claimed, error: updErr } = await supabaseAdmin
    .from('proposals')
    .update(update)
    .eq('id', proposal.id)
    .in('status', ['sent', 'viewed'])
    .select('id')
    .maybeSingle()

  if (updErr) {
    return NextResponse.json({ error: updErr.message }, { status: 500 })
  }
  if (!claimed) {
    return NextResponse.json(
      { error: 'Esta proposta já foi respondida.' },
      { status: 409 },
    )
  }

  // Capture metadata in proposal_activity (full audit trail). The columns
  // approved_at / rejected_at on proposals tell us WHEN — this row tells
  // us WHO and HOW. Headers come from the proxy (User-Agent, etc).
  const ip = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || null
  const userAgent = req.headers.get('user-agent') || null

  try {
    await supabaseAdmin.from('proposal_activity').insert({
      proposal_id: proposal.id,
      actor_type: 'client',
      event: action === 'approve' ? 'approved' : 'rejected',
      details: {
        actor_name,
        actor_email,
        terms_accepted_at: action === 'approve' ? nowIso : undefined,
        reason: reason || undefined,
        lang: actorLang,
        ip,
        user_agent: userAgent,
      },
    })
  } catch (e) {
    console.error('[p/decision] activity insert silenced:', e)
  }

  // Notify admin AND actor. Best-effort: status change already
  // persisted, so a failed email doesn't roll back the decision.
  // Owner sees it in /admin/propostas anyway, and the actor still
  // has the public page success state as immediate feedback.
  try {
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || `https://${req.headers.get('host')}`

    // proposal.clients comes back as array shape from the join — flatten.
    const clientRow = Array.isArray(proposal.clients)
      ? proposal.clients[0]
      : proposal.clients
    const clientCompany = (clientRow as { company?: string } | null)?.company || ''

    const proposalNumber =
      `#${String(proposal.number).padStart(3, '0')}` +
      (proposal.version_suffix ? `-${proposal.version_suffix}` : '')

    // Pull notification email + studio identity in parallel — settings
    // for the admin recipient, studio for the actor confirmation.
    const [{ data: settingsData }, studio] = await Promise.all([
      supabaseAdmin.from('settings').select('key, value'),
      getStudioIdentity(),
    ])
    const settings: Record<string, string> = {}
    settingsData?.forEach((s: { key: string; value: string }) => {
      settings[s.key] = s.value || ''
    })
    const adminEmail =
      settings.notification_email || process.env.NOTIFICATION_EMAIL || ''

    // Actor's view of the proposal — same slug, same query language.
    const actorProposalLink = `${baseUrl}/p/${slug}?l=${actorLang === 'en-US' ? 'en' : 'pt'}`

    const adminUrl = `${baseUrl}/admin/propostas/${slug}`

    if (action === 'approve') {
      const promises: Promise<unknown>[] = []

      if (adminEmail) {
        promises.push(
          sendProposalApprovedToAdmin({
            adminEmail,
            proposalTitle: proposal.title,
            proposalNumber,
            clientCompany,
            actorName: actor_name,
            actorEmail: actor_email,
            adminUrl,
          }),
        )
      }

      promises.push(
        sendProposalApprovedToActor({
          actorEmail: actor_email,
          actorName: actor_name,
          proposalTitle: proposal.title,
          proposalNumber,
          clientCompany,
          studioName: studio.studio_name,
          proposalLink: actorProposalLink,
          language: actorLang,
        }),
      )

      await Promise.all(promises)
    } else {
      const promises: Promise<unknown>[] = []

      if (adminEmail) {
        promises.push(
          sendProposalRejectedToAdmin({
            adminEmail,
            proposalTitle: proposal.title,
            proposalNumber,
            clientCompany,
            actorName: actor_name,
            actorEmail: actor_email,
            reason: reason || null,
            adminUrl,
          }),
        )
      }

      promises.push(
        sendProposalRejectedToActor({
          actorEmail: actor_email,
          actorName: actor_name,
          proposalTitle: proposal.title,
          proposalNumber,
          clientCompany,
          studioName: studio.studio_name,
          proposalLink: actorProposalLink,
          language: actorLang,
        }),
      )

      await Promise.all(promises)
    }
  } catch (e) {
    console.error('[p/decision] notifications silenced:', e)
  }

  return NextResponse.json({ ok: true, status: newStatus })
}
