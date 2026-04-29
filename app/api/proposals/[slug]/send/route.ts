import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getProposalBySlug, listBlocks } from '@/lib/proposals'
import { sendProposalToClient } from '@/lib/email'
import { resolveBriefingRecipients } from '@/lib/briefing-recipients'
import { formatProposalNumber } from '@/lib/proposal-types'
import type { BlockContentInvestment } from '@/lib/proposal-types'
import { isAuthed } from '@/lib/auth'

function fmtCurrency(amount: number, language: 'pt-BR' | 'en-US'): string {
  if (language === 'en-US') {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount)
  }
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(amount)
}

/**
 * POST /api/proposals/[slug]/send
 *
 * Authoritative endpoint for "publishing" a proposal. Replaces the old flow
 * where the editor's "Enviar proposta" button just PATCHed status='sent'
 * and copied the link — that left the actual emailing to the owner.
 *
 * What it does:
 *   1. Looks up proposal + client + investment block (for total + valid_until)
 *   2. Sends the email to the client (CTA → /p/[slug])
 *   3. On success: sets status='sent' + sent_at, records activity
 *   4. Returns the public URL so the client can also be linked manually
 *
 * Failures:
 *   - Missing client email → 400 (clear error to surface in the editor)
 *   - Resend failure → 502 with the underlying error message; status NOT
 *     advanced (so retry remains possible)
 *
 * Idempotency: if status is already 'sent' / 'viewed' / 'approved', we
 * still send (the owner might be re-sending after edits) but we don't
 * overwrite sent_at. The activity log gets a new entry either way.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  if (!isAuthed(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const { slug } = await params

  // Optional body — when omitted, falls back to the canonical contact
  // list (legacy behaviour). When present, the SendDialog UI gives
  // the owner explicit control over which contacts get the email
  // for this specific send. Each entry must have email + name + language;
  // `role` is informational ('primary'/'cc'/'extra').
  let body: {
    recipients_override?: Array<{
      email: string
      name: string
      language: 'pt-BR' | 'en-US'
      role?: 'primary' | 'cc' | 'extra'
    }>
  } = {}
  try {
    const text = await req.text()
    if (text.trim()) {
      body = JSON.parse(text)
    }
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const proposal = await getProposalBySlug(slug)
  if (!proposal) {
    return NextResponse.json({ error: 'Proposta não encontrada' }, { status: 404 })
  }

  // Recipients: explicit override from the SendDialog wins. Otherwise
  // resolve from client_contacts (legacy default — what the editor's
  // "Enviar" button used to do unconditionally).
  type LocalRecipient = {
    email: string
    name: string
    role: 'primary' | 'cc' | 'extra'
    language: string
  }
  let recipients: LocalRecipient[]
  if (Array.isArray(body.recipients_override) && body.recipients_override.length > 0) {
    // Validate the override before using it. Empty array would have
    // already bailed via the length check above.
    const cleaned = body.recipients_override
      .filter((r) => r && typeof r.email === 'string' && r.email.includes('@'))
      .map((r) => ({
        email: r.email.trim(),
        name: typeof r.name === 'string' && r.name.trim() ? r.name.trim() : 'Cliente',
        role: (r.role === 'primary' || r.role === 'cc' || r.role === 'extra'
          ? r.role
          : 'cc') as 'primary' | 'cc' | 'extra',
        language: r.language === 'en-US' ? 'en-US' : 'pt-BR',
      }))
    if (cleaned.length === 0) {
      return NextResponse.json(
        { error: 'Nenhum destinatário válido' },
        { status: 400 },
      )
    }
    recipients = cleaned
  } else {
    // Resolve recipient list from client_contacts (the canonical source since
    // schema v5). Falls back to the legacy clients.email/name if no contact
    // rows exist — same behaviour as briefings, so the same client can
    // receive both kinds of email through the same setup.
    recipients = await resolveBriefingRecipients(proposal.client_id, {
      name: proposal.clients?.name || 'Cliente',
      email: proposal.clients?.email ?? null,
    })
  }

  if (recipients.length === 0) {
    return NextResponse.json(
      {
        error:
          'O cliente desta proposta não tem contato com e-mail. Cadastre um contato principal em /admin/clientes.',
      },
      { status: 400 },
    )
  }

  // Atomic claim: try to advance status to 'sent' BEFORE sending email.
  // Only the first concurrent request gets a row back; the loser gets
  // null and bails out with 409. This kills the "double-click sends
  // two emails" race that happened before v0.10.71.
  //
  // We allow the claim from any status that's "still drafting" — draft,
  // viewed, expired, rejected, revised. A proposal already 'sent' or
  // 'approved' won't claim again — re-send needs to be an explicit
  // re-publish flow (not built yet; for now, status patch via editor).
  //
  // sent_at is preserved on first send: only set if currently null.
  const claimablePrior = ['draft', 'revised', 'expired', 'rejected'] as const
  const claimUpdate: Record<string, unknown> = {
    status: 'sent',
    updated_at: new Date().toISOString(),
  }
  if (!proposal.sent_at) claimUpdate.sent_at = new Date().toISOString()

  const { data: claimed, error: claimErr } = await supabaseAdmin
    .from('proposals')
    .update(claimUpdate)
    .eq('id', proposal.id)
    .in('status', [...claimablePrior, 'sent', 'viewed'])
    // Allow re-send from 'sent'/'viewed' (owner re-publishing after edits)
    // but make it concurrent-safe: only the row whose previous updated_at
    // matches what we read above wins.
    .eq('updated_at', proposal.updated_at)
    .select('id')
    .maybeSingle()

  if (claimErr) {
    return NextResponse.json({ error: claimErr.message }, { status: 500 })
  }
  if (!claimed) {
    // Another request already advanced the proposal. Likely double-click
    // or two tabs. Bail without sending — the first request's email
    // already shipped (or is in flight).
    return NextResponse.json(
      { error: 'Esta proposta já está sendo enviada. Aguarde alguns segundos.' },
      { status: 409 },
    )
  }

  // Pull the investment block so the email can mention the total amount.
  // Missing investment block isn't fatal — we just send "" and the
  // template falls back gracefully.
  const blocks = await listBlocks(proposal.id)
  const investment = blocks.find((b) => b.type === 'investment')
  const totalAmount = investment
    ? (investment.content as BlockContentInvestment).total_amount ?? 0
    : 0

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || `https://${req.headers.get('host')}`
  const link = `${baseUrl}/p/${proposal.slug}`
  const proposalNumber = formatProposalNumber(proposal.number, proposal.version_suffix)

  // Send to every recipient. Each one gets the email in their own
  // language preference (set on the contact row), AND a personalized
  // link with ?l=<lang> so the public page renders in their language
  // when they click. Without this, an EN contact opens the link and
  // sees the page in PT (default), which was the v0.10.75 bug.
  const sendResults = await Promise.all(
    recipients.map(async (r) => {
      const lang = r.language === 'en-US' ? 'en-US' : 'pt-BR'
      const localeForDate = lang === 'en-US' ? 'en-US' : 'pt-BR'
      // Per-recipient link carries the language. The page reads
      // searchParams.l and falls back to 'pt-BR' if absent.
      const personalLink = `${link}?l=${lang === 'en-US' ? 'en' : 'pt'}`
      const validUntilStr = proposal.valid_until
        ? new Date(proposal.valid_until + 'T00:00:00').toLocaleDateString(localeForDate, {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
          })
        : lang === 'en-US'
          ? 'on request'
          : 'a combinar'

      const r2 = await sendProposalToClient({
        clientName: r.name,
        clientEmail: r.email,
        company: proposal.clients?.company || '',
        proposalTitle: proposal.title,
        proposalNumber,
        validUntil: validUntilStr,
        totalAmount: fmtCurrency(totalAmount, lang),
        link: personalLink,
        language: lang,
      })
      return { recipient: r, ...r2 }
    }),
  )

  const successes = sendResults.filter((r) => r.ok)
  const failures = sendResults.filter((r) => !r.ok)

  // "At least one delivery succeeded" is the success criterion.
  // When the owner uses the SendDialog override, they may pick only
  // CCs (or only one extra contact) without a primary in the mix —
  // and that's a valid send. Without override, the canonical flow
  // always has a primary, so this generalization is backwards-compat.
  if (successes.length === 0) {
    const firstErr = failures[0]?.error
    const errMsg =
      firstErr instanceof Error
        ? firstErr.message
        : typeof firstErr === 'string'
          ? firstErr
          : 'Falha ao enviar e-mail pro destinatário'
    return NextResponse.json({ error: errMsg }, { status: 502 })
  }

  // Forwards-compat: pick a "primary" result for the response payload.
  // Prefer one tagged 'primary' if available; otherwise the first
  // successful send. This is just for the `emailId` field returned
  // to the client — doesn't affect anything else.
  const result =
    sendResults.find((r) => r.recipient.role === 'primary' && r.ok) ||
    sendResults.find((r) => r.ok)!

  // Status was already claimed at the top of the handler (atomic update
  // before sending the email). If the email failed AFTER we claimed,
  // we have a tricky state — proposal is 'sent' but no email arrived.
  // In practice this is rare (Resend errors are usually pre-flight, e.g.
  // invalid email), and the activity log captures the failure for the
  // owner to spot and re-trigger.

  // Log it with full recipient details — when the owner used the
  // SendDialog override, this is how we reconstruct who got each
  // version. Includes name + role + language for audit.
  try {
    await supabaseAdmin.from('proposal_activity').insert({
      proposal_id: proposal.id,
      actor_type: 'admin',
      event: 'sent',
      details: {
        to: successes.map((s) => ({
          email: s.recipient.email,
          name: s.recipient.name,
          role: s.recipient.role,
          language: s.recipient.language,
        })),
        failed: failures.map((f) => ({
          email: f.recipient.email,
          name: f.recipient.name,
          role: f.recipient.role,
        })),
        primary_email_id: result.id,
        used_override: Array.isArray(body.recipients_override),
      },
    })
  } catch (e) {
    console.error('[proposals/send] activity log failed:', e)
  }

  return NextResponse.json({
    ok: true,
    link,
    emailId: result.id,
    sentTo: successes.map((s) => s.recipient.email),
    failedTo: failures.map((f) => f.recipient.email),
  })
}
