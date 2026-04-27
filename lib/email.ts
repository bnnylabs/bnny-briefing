/**
 * Email module — visual identity matches the admin app (Light theme).
 *
 * Design constraints unique to email that drove the choices here:
 *   • Outlook (every version) doesn't render SVG → logo must be PNG/JPG.
 *   • Gmail strips <style> blocks in some webmail contexts → all styling
 *     is inline.
 *   • Layout is 100% table-based (Outlook ignores flex/grid entirely).
 *   • System font stack — no @font-face requests, no custom font drift.
 *   • All emails are sent with a plain-text alternative, which improves
 *     deliverability and renders in clients that opt out of HTML.
 *
 * Phase 5a refactor:
 *   • Copy is no longer hardcoded here — every sender resolves its
 *     subject/preheader/title/body/cta through getTemplate(), which
 *     reads admin overrides from `email_templates` and falls back to
 *     EMAIL_DEFAULTS when the row is absent or disabled.
 *   • The body comes in as markdown with {var} placeholders and
 *     {{block_name}} structural placeholders. We interpolate vars,
 *     render the markdown to email-safe HTML, and let the renderer
 *     splice structural blocks (meta cards, diff tables, fallback
 *     links) into their named slots.
 *   • Primary color is resolved from settings.brand_primary_color
 *     (hex validated, lime fallback) so the editor's color picker
 *     ripples through to actual sends.
 */

import { Resend } from 'resend'
import { supabaseAdmin } from './supabase'
import {
  escapeHtml,
  interpolate,
  renderMarkdownToHtml,
  type TemplateVars,
} from './email-markdown'
import { getTemplate } from './email-templates'
import type { TemplateLanguage, TemplateType } from './email-defaults'

// ─── Resend client ───────────────────────────────────────────────────────

function getResend() {
  return new Resend(process.env.RESEND_API_KEY || 'placeholder')
}

const FROM = process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev'

// ─── Visual tokens — mirror the app's Light theme ────────────────────────

const T = {
  bg: '#f4f4f4',
  card: '#ffffff',
  fg: '#0a0a0a',
  muted: '#737373',
  border: '#e5e5e5',
  borderSubtle: '#f0f0f0',
  primaryFallback: '#a3e635', // lime-400
  primaryFg: '#0a0a0a',
}

const FONT_STACK =
  '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif'

const HEX_RE = /^#[0-9a-fA-F]{6}$/

/**
 * Resolves the primary color (used for CTA bg + accents) from the
 * settings cache. Validates hex format strictly so a stray value can't
 * inject CSS — anything that fails the regex falls back to the lime
 * default. This keeps the editor's color picker honest without trusting
 * the DB shape.
 */
function getPrimaryColor(settings: Record<string, string>): string {
  const v = settings.brand_primary_color
  if (v && HEX_RE.test(v)) return v
  return T.primaryFallback
}

// ─── Settings cache ──────────────────────────────────────────────────────
//
// Reading settings synchronously on every email send is wasteful — they
// change rarely. Cache for 30 seconds in-process.

let cachedSettings: Record<string, string> | null = null
let cachedAt = 0
const CACHE_MS = 30_000

async function getSettings(): Promise<Record<string, string>> {
  if (cachedSettings && Date.now() - cachedAt < CACHE_MS) return cachedSettings
  const { data } = await supabaseAdmin.from('settings').select('key, value')
  const next: Record<string, string> = {}
  data?.forEach((s: { key: string; value: string }) => {
    next[s.key] = s.value
  })
  cachedSettings = next
  cachedAt = Date.now()
  return next
}

export function invalidateEmailSettingsCache(): void {
  cachedAt = 0
}

// ─── Helpers ─────────────────────────────────────────────────────────────

function renderLogo(logoUrl: string | undefined): string {
  if (logoUrl) {
    return `<img src="${escapeHtml(logoUrl)}" alt="Bnny Labs" height="32" style="display:block;height:32px;width:auto;border:0;outline:0;text-decoration:none;line-height:1">`
  }
  // Stylized text fallback — uses the app's mono-feel through the system
  // font stack. Looks intentional, not "logo missing".
  return `<span style="font-family:${FONT_STACK};font-size:18px;font-weight:800;letter-spacing:-0.04em;color:${T.fg}">Bnny Labs</span>`
}

function renderButton(href: string, text: string, primary: string): string {
  // Email clients (notably Apple Mail across all platforms) apply
  // text-decoration:underline on <a> tags regardless of !important
  // overrides. The trick that works: make the inner <span> a separate
  // formatting context with display:inline-block — Apple Mail won't
  // propagate the underline to the inline-block child, so the text
  // renders clean.
  //
  // Defense in depth still applies: !important + -webkit-text-decoration
  // on both the <a> and the <span> for clients that do honor them.
  const safeText = escapeHtml(text)
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="border-collapse:separate"><tr><td align="center" bgcolor="${primary}" style="border-radius:8px;background-color:${primary};mso-padding-alt:12px 22px"><a href="${escapeHtml(href)}" target="_blank" style="display:inline-block;padding:12px 22px;font-family:${FONT_STACK};font-size:14px;font-weight:600;color:${T.primaryFg} !important;text-decoration:none !important;-webkit-text-decoration:none !important;letter-spacing:-0.01em;line-height:1;border-radius:8px;mso-line-height-rule:exactly"><span style="display:inline-block;color:${T.primaryFg};text-decoration:none !important;-webkit-text-decoration:none !important">${safeText}</span></a></td></tr></table>`
}

interface MetaItem {
  label: string
  value: string
}

function renderMetaCard(items: MetaItem[]): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:${T.bg};border:1px solid ${T.border};border-radius:8px;margin:20px 0"><tr><td style="padding:16px 20px;font-family:${FONT_STACK}">${items
    .map(
      (it, i) =>
        `<div style="${i > 0 ? `margin-top:14px;padding-top:14px;border-top:1px solid ${T.border}` : ''}"><div style="font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.08em;color:${T.muted};margin:0 0 4px">${escapeHtml(it.label)}</div><div style="font-size:14px;color:${T.fg};font-weight:500;line-height:1.4">${escapeHtml(it.value)}</div></div>`,
    )
    .join('')}</td></tr></table>`
}

export interface DiffChange {
  field: string
  old: string
  new: string
}

function renderDiffSection(changes: DiffChange[], lang: TemplateLanguage): string {
  const sectionLabel = lang === 'en-US' ? 'CHANGES' : 'ALTERAÇÕES'
  const header = `<div style="font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.08em;color:${T.muted};margin:24px 0 10px">${sectionLabel}</div>`

  if (changes.length === 0) {
    return `${header}<p style="font-family:${FONT_STACK};font-size:14px;color:${T.muted};margin:16px 0">${lang === 'en-US' ? 'No changes detected.' : 'Sem alterações detectadas.'}</p>`
  }
  const rows = changes
    .map(
      (c) =>
        `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:${T.bg};border:1px solid ${T.border};border-radius:8px;margin-bottom:12px"><tr><td style="padding:14px 18px;font-family:${FONT_STACK}"><div style="font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.08em;color:${T.muted};margin:0 0 8px">${escapeHtml(c.field)}</div><div style="font-size:13px;color:${T.muted};text-decoration:line-through;margin:0 0 6px;line-height:1.5">${escapeHtml(c.old || (lang === 'en-US' ? '(empty)' : '(vazio)'))}</div><div style="font-size:14px;color:${T.fg};font-weight:500;line-height:1.5">${escapeHtml(c.new)}</div></td></tr></table>`,
    )
    .join('')
  return `${header}${rows}`
}

/**
 * Fallback link block — auto-rendered for invitation-style emails so
 * the recipient can copy the URL if their client mangled the button.
 * This sits at the {{fallback_link}} placeholder inside the body
 * markdown.
 */
function renderFallbackLinkBlock(link: string, lang: TemplateLanguage): string {
  const label =
    lang === 'en-US'
      ? "If the button below doesn't work, copy this link:"
      : 'Se o botão abaixo não funcionar, copie o link:'
  return `<p style="margin:0 0 12px;font-family:${FONT_STACK};color:${T.muted};font-size:13px;line-height:1.5">${escapeHtml(label)}<br><a href="${escapeHtml(link)}" target="_blank" style="color:${T.muted} !important;text-decoration:underline;-webkit-text-decoration:underline;word-break:break-all">${escapeHtml(link)}</a></p>`
}

function renderEditingWindowBlock(hours: number, lang: TemplateLanguage): string {
  const label = lang === 'en-US' ? 'Editing window' : 'Janela de edição'
  const value =
    lang === 'en-US'
      ? `${hours} hours to review and edit your answers`
      : `${hours} horas para revisar e editar suas respostas`
  return renderMetaCard([{ label, value }])
}

// ─── Base template ───────────────────────────────────────────────────────

interface TemplateOpts {
  preheader?: string
  title: string
  bodyHtml: string
  ctaText?: string
  ctaHref?: string
  lang?: TemplateLanguage
  logoUrl?: string
  primaryColor: string
}

function renderTemplate(opts: TemplateOpts): string {
  const {
    preheader,
    title,
    bodyHtml,
    ctaText,
    ctaHref,
    lang = 'pt-BR',
    logoUrl,
    primaryColor,
  } = opts
  const isEN = lang === 'en-US'
  const footerText = isEN
    ? "This is an automated message. Please don't reply directly."
    : 'Este é um email automático. Por favor, não responda diretamente.'

  return `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml" lang="${lang}">
<head>
<meta charset="UTF-8">
<meta http-equiv="Content-Type" content="text/html; charset=UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="x-apple-disable-message-reformatting">
<meta name="color-scheme" content="only light">
<meta name="supported-color-schemes" content="only light">
<meta name="format-detection" content="telephone=no, address=no, email=no, date=no">
<title>${escapeHtml(title)}</title>
<style>
  /* Force light scheme — most clients honor this when declared. Apple
     Mail iOS dark mode is the stubborn outlier; the inline styles below
     compensate for it where the meta tags don't. */
  :root { color-scheme: only light; supported-color-schemes: only light; }
  /* Apple Mail dark-mode-specific override — keep our colors stable. */
  [data-ogsc] body, [data-ogsb] body { background:${T.bg} !important; }
  /* Mobile tightening */
  @media only screen and (max-width: 480px) {
    .email-card { border-radius:0 !important; border-left:0 !important; border-right:0 !important }
    .email-pad { padding:24px 22px 28px !important }
    .email-header-pad { padding:20px 22px !important }
    .email-footer-pad { padding:16px 22px !important }
    .email-h1 { font-size:19px !important }
  }
</style>
</head>
<body bgcolor="${T.bg}" style="margin:0;padding:0;background:${T.bg};background-color:${T.bg};font-family:${FONT_STACK};color:${T.fg};-webkit-font-smoothing:antialiased;-ms-text-size-adjust:100%;-webkit-text-size-adjust:100%">
${preheader ? `<div style="display:none;max-height:0;overflow:hidden;mso-hide:all;color:transparent">${escapeHtml(preheader)}</div>` : ''}
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" bgcolor="${T.bg}" style="background:${T.bg};background-color:${T.bg}">
  <tr>
    <td align="center" style="padding:32px 16px">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" class="email-card" style="max-width:600px;width:100%;background:${T.card};background-color:${T.card};border:1px solid ${T.border};border-radius:12px;overflow:hidden">
        <tr>
          <td class="email-header-pad" style="padding:24px 32px;border-bottom:1px solid ${T.borderSubtle};background:${T.card};background-color:${T.card}">
            ${renderLogo(logoUrl)}
          </td>
        </tr>
        <tr>
          <td class="email-pad" style="padding:32px 32px 36px;background:${T.card};background-color:${T.card}">
            <h1 class="email-h1" style="margin:0 0 12px;font-family:${FONT_STACK};font-size:20px;font-weight:700;letter-spacing:-0.02em;color:${T.fg};line-height:1.3">${escapeHtml(title)}</h1>
            <div style="font-family:${FONT_STACK};font-size:15px;color:${T.fg};line-height:1.6">
              ${bodyHtml}
            </div>
            ${
              ctaText && ctaHref
                ? `<div style="margin-top:28px">${renderButton(ctaHref, ctaText, primaryColor)}</div>`
                : ''
            }
          </td>
        </tr>
        <tr>
          <td class="email-footer-pad" style="padding:18px 32px;background:${T.bg};background-color:${T.bg};border-top:1px solid ${T.borderSubtle};font-family:${FONT_STACK};font-size:12px;color:${T.muted};text-align:center;line-height:1.5">
            ${escapeHtml(footerText)}
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>
</body>
</html>`
}

/**
 * Plain-text alternative — ugly but accurate. Strips tags, decodes
 * common entities. Resend uses this when the receiving client opts
 * out of HTML (rare but real, and improves spam scores either way).
 */
function renderPlainText({
  title,
  bodyHtml,
  ctaText,
  ctaHref,
}: {
  title: string
  bodyHtml: string
  ctaText?: string
  ctaHref?: string
}): string {
  const cleanBody = bodyHtml
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|h1|h2|h3|li)>/gi, '\n\n')
    .replace(/<li[^>]*>/gi, '• ')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
  const cta = ctaText && ctaHref ? `\n\n${ctaText}\n${ctaHref}` : ''
  return `${title}\n\n${cleanBody}${cta}\n\n—\nBnny Labs`
}

// ─── Renderer entry point — used by the test-send + preview routes ───────

/**
 * Resolves a template, interpolates variables, renders the body with
 * its block placeholders filled in, and returns a fully composed HTML
 * + plain-text pair plus subject. Callers that just want to send an
 * email use the typed wrappers below; this lower-level entry exists so
 * the test-send endpoint and the live-preview API can reuse the exact
 * same pipeline.
 */
export interface RenderedEmail {
  subject: string
  html: string
  text: string
  ctaText?: string
  ctaHref?: string
  preheader: string
  title: string
  primaryColor: string
}

interface ComposeArgs {
  type: TemplateType
  language: TemplateLanguage
  vars: TemplateVars
  blocks: Record<string, string>
  ctaHref?: string
  /**
   * When set to '' (empty string), forces the CTA off even if the
   * template has cta_text. Used by the confirmation sender when no
   * editing link is available — there's nowhere for the button to go.
   * When undefined, the template's cta_text is used.
   */
  ctaTextOverride?: string
  /**
   * If provided, used in place of getSettings(). Lets the preview API
   * render a draft without persisting changes.
   */
  settings?: Record<string, string>
  /**
   * If provided, overrides the resolved template fields. Used by the
   * live preview so the admin sees their unsaved draft, not the DB row.
   */
  override?: {
    subject?: string
    preheader?: string
    title?: string
    body_markdown?: string
    cta_text?: string
  }
}

export async function composeEmail(args: ComposeArgs): Promise<RenderedEmail> {
  const { type, language, vars, blocks, ctaHref, ctaTextOverride, override } = args
  const settings = args.settings ?? (await getSettings())
  const tpl = await getTemplate(type, language)

  const subject = interpolate(override?.subject ?? tpl.subject, vars)
  const preheader = interpolate(override?.preheader ?? tpl.preheader, vars)
  const title = interpolate(override?.title ?? tpl.title, vars)

  const interpolatedBody = interpolate(
    override?.body_markdown ?? tpl.body_markdown,
    vars,
  )
  const bodyHtml = renderMarkdownToHtml(interpolatedBody, {
    fontStack: FONT_STACK,
    mutedColor: T.muted,
    blocks,
  })

  const rawCta =
    ctaTextOverride !== undefined ? ctaTextOverride : (override?.cta_text ?? tpl.cta_text)
  const ctaText = rawCta ? interpolate(rawCta, vars) : undefined

  const primaryColor = getPrimaryColor(settings)
  const logoUrl = settings.brand_logo_email || undefined

  const html = renderTemplate({
    title,
    bodyHtml,
    ctaText: ctaText && ctaHref ? ctaText : undefined,
    ctaHref: ctaText && ctaHref ? ctaHref : undefined,
    lang: language,
    logoUrl,
    preheader,
    primaryColor,
  })
  const text = renderPlainText({
    title,
    bodyHtml,
    ctaText: ctaText && ctaHref ? ctaText : undefined,
    ctaHref: ctaText && ctaHref ? ctaHref : undefined,
  })

  return {
    subject,
    html,
    text,
    ctaText,
    ctaHref,
    preheader,
    title,
    primaryColor,
  }
}

// ─── Public email functions ──────────────────────────────────────────────

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

// ─── Preview pipeline (used by the editor's live preview API) ───────────

/**
 * Renders a fully-composed preview email using sample data, optionally
 * with the admin's unsaved draft fields overriding the resolved
 * template. The preview API streams the resulting HTML into an iframe
 * srcdoc, so the editor shows the exact same output a real send would
 * produce — bit-identical pipeline, only the variable values and CTA
 * destinations are sample/mock.
 *
 * Sample blocks mirror what each sender produces from real data:
 *   • briefing_invitation     → fallback_link to a sample URL
 *   • briefing_reminder       → no blocks (reminder body has none)
 *   • briefing_confirmation   → editing_window meta card (48h)
 *   • briefing_completed_admin→ meta_card with sample client/company
 *   • briefing_updated_admin  → changes block with two sample diffs
 */
export async function composePreview({
  type,
  language,
  override,
}: {
  type: TemplateType
  language: TemplateLanguage
  override?: {
    subject?: string
    preheader?: string
    title?: string
    body_markdown?: string
    cta_text?: string
  }
}): Promise<RenderedEmail> {
  const { getSampleVariables } = await import('./email-defaults')
  const sampleVars = getSampleVariables(language)
  const sampleLink = 'https://briefing.bnnylabs.com/exemplo-preview'
  const sampleAdminUrl = 'https://briefing.bnnylabs.com/admin'

  let blocks: Record<string, string> = {}
  let ctaHref: string | undefined

  switch (type) {
    case 'briefing_invitation':
      blocks = { fallback_link: renderFallbackLinkBlock(sampleLink, language) }
      ctaHref = sampleLink
      break
    case 'briefing_reminder':
      blocks = {}
      ctaHref = sampleLink
      break
    case 'briefing_confirmation':
      blocks = { editing_window: renderEditingWindowBlock(48, language) }
      ctaHref = sampleLink
      break
    case 'briefing_completed_admin':
      blocks = {
        meta_card: renderMetaCard([
          {
            label: language === 'en-US' ? 'Client' : 'Cliente',
            value: sampleVars.client_name,
          },
          {
            label: language === 'en-US' ? 'Company' : 'Empresa',
            value: sampleVars.company,
          },
          {
            label: language === 'en-US' ? 'Type' : 'Tipo',
            value: sampleVars.type_label,
          },
          {
            label: language === 'en-US' ? 'Completed at' : 'Concluído em',
            value: sampleVars.completed_at,
          },
        ]),
      }
      ctaHref = sampleAdminUrl
      break
    case 'briefing_updated_admin': {
      const sampleChanges: DiffChange[] =
        language === 'en-US'
          ? [
              { field: 'Project goal', old: 'Brand refresh', new: 'Full identity rework' },
              { field: 'Deadline', old: '', new: 'Mid-November' },
              { field: 'Audience', old: 'B2B SaaS', new: 'B2B SaaS + DTC retail' },
            ]
          : [
              { field: 'Objetivo do projeto', old: 'Refresh de marca', new: 'Reformulação completa de identidade' },
              { field: 'Prazo', old: '', new: 'Meados de novembro' },
              { field: 'Público', old: 'B2B SaaS', new: 'B2B SaaS + varejo DTC' },
            ]
      blocks = { changes: renderDiffSection(sampleChanges, language) }
      ctaHref = sampleAdminUrl
      break
    }
  }

  return composeEmail({
    type,
    language,
    vars: sampleVars,
    blocks,
    ctaHref,
    override,
  })
}

// ─── WhatsApp via CallMeBot ──────────────────────────────────────────────

export async function sendWhatsApp(message: string) {
  const phone = process.env.CALLMEBOT_PHONE
  const apikey = process.env.CALLMEBOT_APIKEY

  if (!phone || !apikey) {
    console.warn('WhatsApp env vars not configured (CALLMEBOT_PHONE/APIKEY)')
    return { ok: false, error: 'not_configured' }
  }

  const url = `https://api.callmebot.com/whatsapp.php?phone=${encodeURIComponent(phone)}&text=${encodeURIComponent(message)}&apikey=${encodeURIComponent(apikey)}`

  try {
    const response = await fetch(url)
    return { ok: response.ok }
  } catch (error) {
    console.error('sendWhatsApp failed:', error)
    return { ok: false, error }
  }
}
