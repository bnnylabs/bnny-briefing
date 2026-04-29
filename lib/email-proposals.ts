/**
 * Proposal-domain email senders.
 *
 * Six functions covering the proposal lifecycle:
 *   1. sendProposalToClient       — send the published proposal link
 *   2. sendProposalViewedToAdmin  — owner notification (first open)
 *   3. sendProposalApprovedToAdmin — owner notification (approved)
 *   4. sendProposalRejectedToAdmin — owner notification (rejected)
 *   5. sendProposalApprovedToActor — receipt to the person who approved
 *   6. sendProposalRejectedToActor — receipt to the person who rejected
 *
 * Each function wraps `composeEmail` with the variables, blocks, and CTA
 * appropriate for its email type. Returns { ok, id } on success or
 * { ok: false, error } on failure — never throws.
 *
 * Extracted from lib/email.ts (v0.10.100). Infrastructure
 * (composeEmail, render helpers) lives in email-render.ts.
 */

import {
  composeEmail,
  FROM,
  getResend,
  renderFallbackLinkBlock,
  renderMetaCard,
} from './email-render'
import type { TemplateVars } from './email-markdown'
import type { TemplateLanguage } from './email-defaults'

/**
 * Email to client — proposal published, here's the link.
 *
 * Fired from POST /api/proposals/[slug]/send when the owner clicks
 * "Enviar proposta" in the editor. The CTA points to the public view at
 * /p/[slug]; the fallback link block renders the same URL as a copy/paste
 * fallback for clients whose mail clients strip CTA buttons.
 */
export async function sendProposalToClient({
  clientName,
  clientEmail,
  company,
  proposalTitle,
  proposalNumber,
  validUntil,
  totalAmount,
  link,
  language = 'pt-BR',
}: {
  clientName: string
  clientEmail: string
  company: string
  proposalTitle: string
  proposalNumber: string
  validUntil: string
  totalAmount: string
  link: string
  language?: string
}) {
  const lang: TemplateLanguage = language === 'en-US' ? 'en-US' : 'pt-BR'
  const vars: TemplateVars = {
    client_name: clientName,
    company,
    proposal_title: proposalTitle,
    proposal_number: proposalNumber,
    valid_until: validUntil,
    total_amount: totalAmount,
  }

  const composed = await composeEmail({
    type: 'proposal_sent_to_client',
    language: lang,
    vars,
    blocks: {
      fallback_link: renderFallbackLinkBlock(link, lang),
    },
    ctaHref: link,
  })

  try {
    const result = await getResend().emails.send({
      from: FROM,
      to: clientEmail,
      subject: composed.subject,
      html: composed.html,
      text: composed.text,
    })
    return { ok: true, id: result.data?.id }
  } catch (error) {
    console.error('sendProposalToClient failed:', error)
    return { ok: false, error }
  }
}

/**
 * Email to admin (owner) — client just opened the proposal.
 *
 * Fired from POST /api/p/[slug]/view the first time a client lands on the
 * public proposal page. Idempotency is handled upstream — this function
 * just builds + sends. If the same client refreshes the page, the view
 * tracker won't re-fire because status has already moved to 'viewed'.
 */
export async function sendProposalViewedToAdmin({
  adminEmail,
  clientName,
  company,
  proposalTitle,
  proposalNumber,
  baseUrl,
  language = 'pt-BR',
}: {
  adminEmail: string
  clientName: string
  company: string
  proposalTitle: string
  proposalNumber: string
  baseUrl: string
  language?: string
}) {
  const lang: TemplateLanguage = language === 'en-US' ? 'en-US' : 'pt-BR'
  const localeForDate = lang === 'en-US' ? 'en-US' : 'pt-BR'
  const adminUrl = `${baseUrl}/admin/propostas`
  const viewedAt = new Date().toLocaleString(localeForDate)

  const vars: TemplateVars = {
    client_name: clientName,
    company,
    proposal_title: proposalTitle,
    proposal_number: proposalNumber,
    viewed_at: viewedAt,
  }

  const composed = await composeEmail({
    type: 'proposal_viewed_admin',
    language: lang,
    vars,
    blocks: {
      meta_card: renderMetaCard([
        {
          label: lang === 'en-US' ? 'Client' : 'Cliente',
          value: clientName,
        },
        {
          label: lang === 'en-US' ? 'Company' : 'Empresa',
          value: company,
        },
        {
          label: lang === 'en-US' ? 'Proposal' : 'Proposta',
          value: `${proposalNumber} — ${proposalTitle}`,
        },
        {
          label: lang === 'en-US' ? 'Opened at' : 'Aberta em',
          value: viewedAt,
        },
      ]),
    },
    ctaHref: adminUrl,
  })

  try {
    const result = await getResend().emails.send({
      from: FROM,
      to: adminEmail,
      subject: composed.subject,
      html: composed.html,
      text: composed.text,
    })
    return { ok: true, id: result.data?.id }
  } catch (error) {
    console.error('sendProposalViewedToAdmin failed:', error)
    return { ok: false, error }
  }
}

// ─── Proposal decision (approved / rejected) ────────────────────────────

/**
 * Email to admin when client clicks "Aprovar" on the public proposal
 * view. Captures who approved (name + email) — that data was collected
 * in the dialog form before the API call. Terms acceptance is implicit
 * (the route validates terms_accepted=true before this fires).
 */
export async function sendProposalApprovedToAdmin({
  adminEmail,
  proposalTitle,
  proposalNumber,
  clientCompany,
  actorName,
  actorEmail,
  adminUrl,
  language = 'pt-BR',
}: {
  adminEmail: string
  proposalTitle: string
  proposalNumber: string
  clientCompany: string
  actorName: string
  actorEmail: string
  adminUrl: string
  language?: string
}) {
  const lang: TemplateLanguage = language === 'en-US' ? 'en-US' : 'pt-BR'
  const localeForDate = lang === 'en-US' ? 'en-US' : 'pt-BR'
  const approvedAt = new Date().toLocaleString(localeForDate)

  const vars: TemplateVars = {
    actor_name: actorName,
    actor_email: actorEmail,
    company: clientCompany,
    proposal_title: proposalTitle,
    proposal_number: proposalNumber,
    approved_at: approvedAt,
  }

  const composed = await composeEmail({
    type: 'proposal_approved_admin',
    language: lang,
    vars,
    blocks: {
      meta_card: renderMetaCard([
        {
          label: lang === 'en-US' ? 'Approved by' : 'Aprovado por',
          value: actorName,
        },
        {
          label: lang === 'en-US' ? 'Email' : 'E-mail',
          value: actorEmail,
        },
        {
          label: lang === 'en-US' ? 'Company' : 'Empresa',
          value: clientCompany,
        },
        {
          label: lang === 'en-US' ? 'Proposal' : 'Proposta',
          value: `${proposalNumber} — ${proposalTitle}`,
        },
        {
          label: lang === 'en-US' ? 'Approved at' : 'Aprovado em',
          value: approvedAt,
        },
      ]),
    },
    ctaHref: adminUrl,
  })

  try {
    const result = await getResend().emails.send({
      from: FROM,
      to: adminEmail,
      subject: composed.subject,
      html: composed.html,
      text: composed.text,
    })
    return { ok: true, id: result.data?.id }
  } catch (error) {
    console.error('[email/proposal-approved-admin] failed:', error)
    return { ok: false, error }
  }
}

/**
 * Email to admin when client clicks "Recusar" on the public proposal
 * view. Reason is optional — if absent, the body section that mentions
 * it is rendered as a graceful "Sem motivo informado." placeholder.
 */
export async function sendProposalRejectedToAdmin({
  adminEmail,
  proposalTitle,
  proposalNumber,
  clientCompany,
  actorName,
  actorEmail,
  reason,
  adminUrl,
  language = 'pt-BR',
}: {
  adminEmail: string
  proposalTitle: string
  proposalNumber: string
  clientCompany: string
  actorName: string
  actorEmail: string
  reason: string | null
  adminUrl: string
  language?: string
}) {
  const lang: TemplateLanguage = language === 'en-US' ? 'en-US' : 'pt-BR'
  const localeForDate = lang === 'en-US' ? 'en-US' : 'pt-BR'
  const rejectedAt = new Date().toLocaleString(localeForDate)

  const reasonText = reason && reason.trim()
    ? (lang === 'en-US' ? `**Reason given:** ${reason.trim()}` : `**Motivo informado:** ${reason.trim()}`)
    : (lang === 'en-US' ? '_No reason given._' : '_Sem motivo informado._')

  const vars: TemplateVars = {
    actor_name: actorName,
    actor_email: actorEmail,
    company: clientCompany,
    proposal_title: proposalTitle,
    proposal_number: proposalNumber,
    rejected_at: rejectedAt,
    reason: reasonText,
  }

  const composed = await composeEmail({
    type: 'proposal_rejected_admin',
    language: lang,
    vars,
    blocks: {
      meta_card: renderMetaCard([
        {
          label: lang === 'en-US' ? 'Rejected by' : 'Recusado por',
          value: actorName,
        },
        {
          label: lang === 'en-US' ? 'Email' : 'E-mail',
          value: actorEmail,
        },
        {
          label: lang === 'en-US' ? 'Company' : 'Empresa',
          value: clientCompany,
        },
        {
          label: lang === 'en-US' ? 'Proposal' : 'Proposta',
          value: `${proposalNumber} — ${proposalTitle}`,
        },
        {
          label: lang === 'en-US' ? 'Rejected at' : 'Recusado em',
          value: rejectedAt,
        },
      ]),
    },
    ctaHref: adminUrl,
  })

  try {
    const result = await getResend().emails.send({
      from: FROM,
      to: adminEmail,
      subject: composed.subject,
      html: composed.html,
      text: composed.text,
    })
    return { ok: true, id: result.data?.id }
  } catch (error) {
    console.error('[email/proposal-rejected-admin] failed:', error)
    return { ok: false, error }
  }
}

/**
 * Email confirmation TO THE PERSON WHO APPROVED. Sent in their language
 * (which the public page passes through from the ?l= query string).
 *
 * Whoever clicked Aprovar on the public page gave us name + email in
 * the dialog. Even if they're not in the client_contacts list (an
 * external partner / lawyer / spouse), they get a copy as proof of
 * acceptance — the email serves as their record of what they agreed to.
 *
 * Best-effort: failure is logged but doesn't roll back the decision.
 */
export async function sendProposalApprovedToActor({
  actorEmail,
  actorName,
  proposalTitle,
  proposalNumber,
  clientCompany,
  studioName,
  proposalLink,
  language = 'pt-BR',
}: {
  actorEmail: string
  actorName: string
  proposalTitle: string
  proposalNumber: string
  clientCompany: string
  studioName: string
  proposalLink: string
  language?: string
}) {
  const lang: TemplateLanguage = language === 'en-US' ? 'en-US' : 'pt-BR'
  const localeForDate = lang === 'en-US' ? 'en-US' : 'pt-BR'
  const approvedAt = new Date().toLocaleString(localeForDate)

  const vars: TemplateVars = {
    actor_name: actorName,
    company: clientCompany,
    proposal_title: proposalTitle,
    proposal_number: proposalNumber,
    approved_at: approvedAt,
    studio_name: studioName,
  }

  const composed = await composeEmail({
    type: 'proposal_approved_to_actor',
    language: lang,
    vars,
    blocks: {
      meta_card: renderMetaCard([
        {
          label: lang === 'en-US' ? 'Proposal' : 'Proposta',
          value: `${proposalNumber} — ${proposalTitle}`,
        },
        {
          label: lang === 'en-US' ? 'Company' : 'Empresa',
          value: clientCompany,
        },
        {
          label: lang === 'en-US' ? 'Approved by' : 'Aprovado por',
          value: actorName,
        },
        {
          label: lang === 'en-US' ? 'Approved at' : 'Aprovado em',
          value: approvedAt,
        },
      ]),
    },
    ctaHref: proposalLink,
  })

  try {
    const result = await getResend().emails.send({
      from: FROM,
      to: actorEmail,
      subject: composed.subject,
      html: composed.html,
      text: composed.text,
    })
    return { ok: true, id: result.data?.id }
  } catch (error) {
    console.error('[email/proposal-approved-to-actor] failed:', error)
    return { ok: false, error }
  }
}

/**
 * Email confirmation TO THE PERSON WHO REJECTED. Same idea as the
 * approved version but with neutral copy. We don't include the reason
 * in this email because the actor wrote it themselves — they don't
 * need to read it back.
 */
export async function sendProposalRejectedToActor({
  actorEmail,
  actorName,
  proposalTitle,
  proposalNumber,
  clientCompany,
  studioName,
  proposalLink,
  language = 'pt-BR',
}: {
  actorEmail: string
  actorName: string
  proposalTitle: string
  proposalNumber: string
  clientCompany: string
  studioName: string
  proposalLink: string
  language?: string
}) {
  const lang: TemplateLanguage = language === 'en-US' ? 'en-US' : 'pt-BR'
  const localeForDate = lang === 'en-US' ? 'en-US' : 'pt-BR'
  const rejectedAt = new Date().toLocaleString(localeForDate)

  const vars: TemplateVars = {
    actor_name: actorName,
    company: clientCompany,
    proposal_title: proposalTitle,
    proposal_number: proposalNumber,
    rejected_at: rejectedAt,
    studio_name: studioName,
  }

  const composed = await composeEmail({
    type: 'proposal_rejected_to_actor',
    language: lang,
    vars,
    blocks: {
      meta_card: renderMetaCard([
        {
          label: lang === 'en-US' ? 'Proposal' : 'Proposta',
          value: `${proposalNumber} — ${proposalTitle}`,
        },
        {
          label: lang === 'en-US' ? 'Company' : 'Empresa',
          value: clientCompany,
        },
        {
          label: lang === 'en-US' ? 'Recorded at' : 'Registrado em',
          value: rejectedAt,
        },
      ]),
    },
    ctaHref: proposalLink,
  })

  try {
    const result = await getResend().emails.send({
      from: FROM,
      to: actorEmail,
      subject: composed.subject,
      html: composed.html,
      text: composed.text,
    })
    return { ok: true, id: result.data?.id }
  } catch (error) {
    console.error('[email/proposal-rejected-to-actor] failed:', error)
    return { ok: false, error }
  }
}
