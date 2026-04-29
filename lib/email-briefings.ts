/**
 * Briefing-domain email senders.
 *
 * Each function wraps `composeEmail` with the variables, blocks, and CTA
 * appropriate for one specific email type. Returns { ok, id } on
 * success or { ok: false, error } on failure — never throws, because
 * email sending is fire-and-forget from the caller's perspective and a
 * failed send shouldn't bring down the request that triggered it.
 *
 * Extracted from lib/email.ts (v0.10.100). The infrastructure
 * (composeEmail, renderFallbackLinkBlock, etc.) lives in email-render.ts;
 * this module is just a thin domain layer on top.
 */

import {
  composeEmail,
  FROM,
  getResend,
  renderDiffSection,
  renderEditingWindowBlock,
  renderFallbackLinkBlock,
  renderMetaCard,
  type DiffChange,
} from './email-render'
import type { TemplateVars } from './email-markdown'
import type { TemplateLanguage } from './email-defaults'

/**
 * Email to client — briefing created, fill it out.
 */
export async function sendBriefingToClient({
  clientName,
  clientEmail,
  company,
  typeLabel,
  link,
  language = 'pt-BR',
}: {
  clientName: string
  clientEmail: string
  company: string
  typeLabel: string
  link: string
  language?: string
}) {
  const lang: TemplateLanguage = language === 'en-US' ? 'en-US' : 'pt-BR'
  const vars: TemplateVars = {
    client_name: clientName,
    company,
    type_label: typeLabel,
  }

  const composed = await composeEmail({
    type: 'briefing_invitation',
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
    console.error('sendBriefingToClient failed:', error)
    return { ok: false, error }
  }
}

/**
 * Email to admin — briefing completed, or updated.
 *
 * Accepts a `kind` to switch between completion and update copy, and a
 * `changes` array (only for updates) which renders as the diff section.
 */
export async function sendCompletionToAdmin({
  adminEmail,
  clientName,
  company,
  typeLabel,
  baseUrl,
  kind = 'completed',
  changes = [],
  language = 'pt-BR',
}: {
  adminEmail: string
  clientName: string
  company: string
  typeLabel: string
  baseUrl: string
  kind?: 'completed' | 'updated'
  changes?: DiffChange[]
  language?: string
}) {
  const lang: TemplateLanguage = language === 'en-US' ? 'en-US' : 'pt-BR'
  const isUpdate = kind === 'updated'
  const adminUrl = `${baseUrl}/admin`
  const localeForDate = lang === 'en-US' ? 'en-US' : 'pt-BR'

  const vars: TemplateVars = isUpdate
    ? {
        company,
        type_label: typeLabel,
        changes_count: String(changes.length),
      }
    : {
        client_name: clientName,
        company,
        type_label: typeLabel,
        completed_at: new Date().toLocaleString(localeForDate),
      }

  const blocks: Record<string, string> = isUpdate
    ? { changes: renderDiffSection(changes, lang) }
    : {
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
            label: lang === 'en-US' ? 'Type' : 'Tipo',
            value: typeLabel,
          },
          {
            label: lang === 'en-US' ? 'Completed at' : 'Concluído em',
            value: new Date().toLocaleString(localeForDate),
          },
        ]),
      }

  const composed = await composeEmail({
    type: isUpdate ? 'briefing_updated_admin' : 'briefing_completed_admin',
    language: lang,
    vars,
    blocks,
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
    console.error('sendCompletionToAdmin failed:', error)
    return { ok: false, error }
  }
}

/**
 * Reminder email to client — briefing pending.
 */
export async function sendReminderToClient({
  clientName,
  clientEmail,
  company,
  typeLabel,
  link,
  language = 'pt-BR',
}: {
  clientName: string
  clientEmail: string
  company: string
  typeLabel: string
  link: string
  language?: string
}) {
  const lang: TemplateLanguage = language === 'en-US' ? 'en-US' : 'pt-BR'
  const vars: TemplateVars = {
    client_name: clientName,
    company,
    type_label: typeLabel,
  }

  const composed = await composeEmail({
    type: 'briefing_reminder',
    language: lang,
    vars,
    blocks: {},
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
    console.error('sendReminderToClient failed:', error)
    return { ok: false, error }
  }
}

/**
 * Confirmation to client after they finish filling out the briefing.
 * Mentions the editing window when applicable.
 */
export async function sendClientConfirmation({
  clientName,
  clientEmail,
  company,
  typeLabel,
  language = 'pt-BR',
  briefingLink,
  editingHours = 48,
}: {
  clientName: string
  clientEmail: string
  company: string
  typeLabel: string
  language?: string
  briefingLink?: string
  editingHours?: number
}) {
  const lang: TemplateLanguage = language === 'en-US' ? 'en-US' : 'pt-BR'
  const vars: TemplateVars = {
    client_name: clientName,
    company,
    type_label: typeLabel,
    editing_hours: editingHours,
  }

  const blocks: Record<string, string> = briefingLink
    ? { editing_window: renderEditingWindowBlock(editingHours, lang) }
    : {} // no edit window → block placeholder is silently dropped

  const composed = await composeEmail({
    type: 'briefing_confirmation',
    language: lang,
    vars,
    blocks,
    ctaHref: briefingLink,
    // CTA only when there's a link to send them to. The cta_text
    // column may still be set, but there's nowhere for the button to go
    // without briefingLink.
    ctaTextOverride: briefingLink ? undefined : '',
  })

  try {
    const result = await getResend().emails.send({
      from: FROM,
      to: clientEmail,
      replyTo: process.env.NOTIFICATION_EMAIL || FROM,
      subject: composed.subject,
      html: composed.html,
      text: composed.text,
    })
    return { ok: true, id: result.data?.id }
  } catch (error) {
    console.error('sendClientConfirmation failed:', error)
    return { ok: false, error }
  }
}
