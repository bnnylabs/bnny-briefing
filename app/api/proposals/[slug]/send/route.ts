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

  const proposal = await getProposalBySlug(slug)
  if (!proposal) {
    return NextResponse.json({ error: 'Proposta não encontrada' }, { status: 404 })
  }

  // Resolve recipient list from client_contacts (the canonical source since
  // schema v5). Falls back to the legacy clients.email/name if no contact
  // rows exist — same behaviour as briefings, so the same client can
  // receive both kinds of email through the same setup.
  const recipients = await resolveBriefingRecipients(proposal.client_id, {
    name: proposal.clients?.name || 'Cliente',
    email: proposal.clients?.email ?? null,
  })

  if (recipients.length === 0) {
    return NextResponse.json(
      {
        error:
          'O cliente desta proposta não tem contato com e-mail. Cadastre um contato principal em /admin/clientes.',
      },
      { status: 400 },
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
  // language preference (set on the contact row).
  const sendResults = await Promise.all(
    recipients.map(async (r) => {
      const lang = r.language === 'en-US' ? 'en-US' : 'pt-BR'
      const localeForDate = lang === 'en-US' ? 'en-US' : 'pt-BR'
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
        link,
        language: lang,
      })
      return { recipient: r, ...r2 }
    }),
  )

  const successes = sendResults.filter((r) => r.ok)
  const failures = sendResults.filter((r) => !r.ok)

  // We treat "primary delivered" as the success criterion. CCs failing
  // is annoying but doesn't block the publish — they're informational
  // copies. Primary failing means the actual recipient didn't get the
  // proposal, which is failure.
  const primaryDelivered = successes.some((s) => s.recipient.role === 'primary')
  if (!primaryDelivered) {
    const firstErr = failures[0]?.error
    const errMsg =
      firstErr instanceof Error
        ? firstErr.message
        : typeof firstErr === 'string'
          ? firstErr
          : 'Falha ao enviar e-mail pro destinatário principal'
    return NextResponse.json({ error: errMsg }, { status: 502 })
  }

  // Forwards-compat with single-recipient code paths below.
  const result = sendResults.find((r) => r.recipient.role === 'primary' && r.ok)!

  // Email shipped — now update state. We use a partial update so we don't
  // clobber sent_at on re-sends (preserves first-send timestamp).
  const update: Record<string, unknown> = {
    status: 'sent',
    updated_at: new Date().toISOString(),
  }
  if (!proposal.sent_at) update.sent_at = new Date().toISOString()

  const { error: updErr } = await supabaseAdmin
    .from('proposals')
    .update(update)
    .eq('id', proposal.id)

  if (updErr) {
    // Email already went out — can't undo it. Surface the error but tag
    // it so the UI can show "email enviado, mas o status não atualizou".
    return NextResponse.json(
      { error: updErr.message, emailSent: true },
      { status: 500 },
    )
  }

  // Log it (best-effort — failures here are silent).
  try {
    await supabaseAdmin.from('proposal_activity').insert({
      proposal_id: proposal.id,
      actor_type: 'admin',
      event: 'sent',
      details: {
        to: successes.map((s) => ({ email: s.recipient.email, role: s.recipient.role })),
        failed: failures.map((f) => ({ email: f.recipient.email, role: f.recipient.role })),
        primary_email_id: result.id,
      },
    })
  } catch {
    // Activity logging is best-effort. Don't break the response.
  }

  return NextResponse.json({
    ok: true,
    link,
    emailId: result.id,
    sentTo: successes.map((s) => s.recipient.email),
    failedTo: failures.map((f) => f.recipient.email),
  })
}
