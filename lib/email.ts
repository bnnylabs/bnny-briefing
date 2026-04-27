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
 * Tokens mirror the admin app's CSS variables — bg, card, fg, muted,
 * border, primary (lime). Cor primária é hardcoded por enquanto;
 * Fase B vai trazê-la de settings.brand_primary_color.
 */

import { Resend } from 'resend'
import { supabaseAdmin } from './supabase'

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
  primary: '#a3e635', // lime-400, identical to the app's --primary
  primaryFg: '#0a0a0a',
}

const FONT_STACK =
  '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif'

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

// ─── Helpers ─────────────────────────────────────────────────────────────

function escapeHtml(s: string | undefined | null): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function renderLogo(logoUrl: string | undefined): string {
  if (logoUrl) {
    return `<img src="${escapeHtml(logoUrl)}" alt="Bnny Labs" height="32" style="display:block;height:32px;width:auto;border:0;outline:0;text-decoration:none;line-height:1">`
  }
  // Stylized text fallback — uses the app's mono-feel through the system
  // font stack. Looks intentional, not "logo missing".
  return `<span style="font-family:${FONT_STACK};font-size:18px;font-weight:800;letter-spacing:-0.04em;color:${T.fg}">Bnny Labs</span>`
}

function renderButton(href: string, text: string): string {
  // Email clients (notably Apple Mail and Gmail iOS) override <a> styles
  // and add the default link color + underline. Defense in depth:
  //   1. !important on the <a> tag's color and text-decoration
  //   2. -webkit-text-decoration explicit (Apple Mail uses webkit prefix)
  //   3. Inner <span> with the same color + text-decoration:none — some
  //      clients style the wrapper but leave inner spans alone
  //   4. mso-padding-alt for legacy Outlook (table cell padding fallback)
  const safeText = escapeHtml(text)
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="border-collapse:separate"><tr><td align="center" bgcolor="${T.primary}" style="border-radius:8px;background-color:${T.primary};mso-padding-alt:12px 22px"><a href="${escapeHtml(href)}" target="_blank" style="display:inline-block;padding:12px 22px;font-family:${FONT_STACK};font-size:14px;font-weight:600;color:${T.primaryFg} !important;text-decoration:none !important;-webkit-text-decoration:none !important;letter-spacing:-0.01em;line-height:1;border-radius:8px;mso-line-height-rule:exactly"><span style="color:${T.primaryFg};text-decoration:none">${safeText}</span></a></td></tr></table>`
}

interface MetaItem {
  label: string
  value: string
}

function renderMetaCard(items: MetaItem[]): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:${T.bg};border:1px solid ${T.border};border-radius:8px;margin:20px 0"><tr><td style="padding:16px 20px;font-family:${FONT_STACK}">${items
    .map(
      (it, i) => `<div style="${i > 0 ? `margin-top:14px;padding-top:14px;border-top:1px solid ${T.border}` : ''}"><div style="font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.08em;color:${T.muted};margin:0 0 4px">${escapeHtml(it.label)}</div><div style="font-size:14px;color:${T.fg};font-weight:500;line-height:1.4">${escapeHtml(it.value)}</div></div>`,
    )
    .join('')}</td></tr></table>`
}

export interface DiffChange {
  field: string
  old: string
  new: string
}

function renderDiffSection(changes: DiffChange[], lang: 'pt-BR' | 'en-US'): string {
  if (changes.length === 0) {
    return `<p style="font-family:${FONT_STACK};font-size:14px;color:${T.muted};margin:16px 0">${lang === 'en-US' ? 'No changes detected.' : 'Sem alterações detectadas.'}</p>`
  }
  return changes
    .map(
      (c) =>
        `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:${T.bg};border:1px solid ${T.border};border-radius:8px;margin-bottom:12px"><tr><td style="padding:14px 18px;font-family:${FONT_STACK}"><div style="font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.08em;color:${T.muted};margin:0 0 8px">${escapeHtml(c.field)}</div><div style="font-size:13px;color:${T.muted};text-decoration:line-through;margin:0 0 6px;line-height:1.5">${escapeHtml(c.old || (lang === 'en-US' ? '(empty)' : '(vazio)'))}</div><div style="font-size:14px;color:${T.fg};font-weight:500;line-height:1.5">${escapeHtml(c.new)}</div></td></tr></table>`,
    )
    .join('')
}

// ─── Base template ───────────────────────────────────────────────────────

interface TemplateOpts {
  preheader?: string // hidden inbox-preview text (Gmail/Apple Mail)
  title: string
  bodyHtml: string
  ctaText?: string
  ctaHref?: string
  lang?: 'pt-BR' | 'en-US'
  logoUrl?: string
}

function renderTemplate(opts: TemplateOpts): string {
  const { preheader, title, bodyHtml, ctaText, ctaHref, lang = 'pt-BR', logoUrl } = opts
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
                ? `<div style="margin-top:28px">${renderButton(ctaHref, ctaText)}</div>`
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
  const isEN = language === 'en-US'
  const lang = isEN ? 'en-US' : 'pt-BR'
  const settings = await getSettings()
  const logoUrl = settings.brand_logo_email || undefined

  const title = isEN
    ? 'Your briefing is ready'
    : 'Seu briefing está pronto'

  const bodyHtml = isEN
    ? `<p style="margin:0 0 12px">Hello, <strong>${escapeHtml(clientName)}</strong>!</p>
       <p style="margin:0 0 12px">We've prepared a <strong>${escapeHtml(typeLabel)}</strong> briefing for <strong>${escapeHtml(company)}</strong>.</p>
       <p style="margin:0 0 12px">Some fields are pre-filled based on what we know — just review, complete the rest, and submit. Takes a few minutes.</p>
       <p style="margin:0;color:${T.muted};font-size:13px">If the button below doesn't work, copy this link:<br><span style="word-break:break-all">${escapeHtml(link)}</span></p>`
    : `<p style="margin:0 0 12px">Olá, <strong>${escapeHtml(clientName)}</strong>!</p>
       <p style="margin:0 0 12px">Preparamos um briefing de <strong>${escapeHtml(typeLabel)}</strong> para a <strong>${escapeHtml(company)}</strong>.</p>
       <p style="margin:0 0 12px">Alguns campos já estão preenchidos com base no que sabemos. É só revisar, completar o que faltar e enviar. Leva poucos minutos.</p>
       <p style="margin:0;color:${T.muted};font-size:13px">Se o botão abaixo não funcionar, copie o link:<br><span style="word-break:break-all">${escapeHtml(link)}</span></p>`

  const ctaText = isEN ? 'Fill out briefing →' : 'Preencher briefing →'
  const preheader = isEN
    ? `Personalized briefing for ${company}`
    : `Briefing personalizado para ${company}`

  const html = renderTemplate({
    title,
    bodyHtml,
    ctaText,
    ctaHref: link,
    lang,
    logoUrl,
    preheader,
  })
  const text = renderPlainText({ title, bodyHtml, ctaText, ctaHref: link })

  try {
    const result = await getResend().emails.send({
      from: FROM,
      to: clientEmail,
      subject: isEN
        ? `${typeLabel} briefing — ${company}`
        : `Briefing de ${typeLabel} — ${company}`,
      html,
      text,
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
 * The HTML is built here from structured data, not handed in pre-rendered
 * — that's the whole point of this refactor: callers pass facts, this
 * module renders.
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
  const isEN = language === 'en-US'
  const lang = isEN ? 'en-US' : 'pt-BR'
  const settings = await getSettings()
  const logoUrl = settings.brand_logo_email || undefined

  const isUpdate = kind === 'updated'

  const title = isUpdate
    ? isEN
      ? 'Briefing updated'
      : 'Briefing atualizado'
    : isEN
      ? 'Briefing completed'
      : 'Briefing concluído'

  const subject = isUpdate
    ? isEN
      ? `${company} updated their ${typeLabel} briefing`
      : `${company} atualizou o briefing de ${typeLabel}`
    : isEN
      ? `Briefing completed — ${company} (${typeLabel})`
      : `Briefing concluído — ${company} (${typeLabel})`

  const lead = isUpdate
    ? isEN
      ? `<strong>${escapeHtml(company)}</strong> just updated the <strong>${escapeHtml(typeLabel)}</strong> briefing.`
      : `<strong>${escapeHtml(company)}</strong> acabou de atualizar o briefing de <strong>${escapeHtml(typeLabel)}</strong>.`
    : isEN
      ? `<strong>${escapeHtml(clientName)}</strong> from <strong>${escapeHtml(company)}</strong> just completed the <strong>${escapeHtml(typeLabel)}</strong> briefing.`
      : `<strong>${escapeHtml(clientName)}</strong> da <strong>${escapeHtml(company)}</strong> acabou de concluir o briefing de <strong>${escapeHtml(typeLabel)}</strong>.`

  const sectionLabel = isUpdate
    ? isEN
      ? 'CHANGES'
      : 'ALTERAÇÕES'
    : ''

  const middleBlock = isUpdate
    ? `<div style="font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.08em;color:${T.muted};margin:24px 0 10px">${sectionLabel}</div>${renderDiffSection(changes, lang)}`
    : renderMetaCard([
        {
          label: isEN ? 'Client' : 'Cliente',
          value: clientName,
        },
        {
          label: isEN ? 'Company' : 'Empresa',
          value: company,
        },
        {
          label: isEN ? 'Type' : 'Tipo',
          value: typeLabel,
        },
        {
          label: isEN ? 'Completed at' : 'Concluído em',
          value: new Date().toLocaleString(isEN ? 'en-US' : 'pt-BR'),
        },
      ])

  const bodyHtml = `<p style="margin:0 0 12px">${lead}</p>${middleBlock}`

  const ctaText = isEN ? 'View in admin →' : 'Ver no painel →'
  const ctaHref = `${baseUrl}/admin`
  const preheader = isUpdate
    ? `${changes.length} ${changes.length === 1 ? (isEN ? 'change' : 'alteração') : isEN ? 'changes' : 'alterações'}`
    : isEN
      ? 'New responses to review'
      : 'Novas respostas para revisar'

  const html = renderTemplate({
    title,
    bodyHtml,
    ctaText,
    ctaHref,
    lang,
    logoUrl,
    preheader,
  })
  const text = renderPlainText({ title, bodyHtml, ctaText, ctaHref })

  try {
    const result = await getResend().emails.send({
      from: FROM,
      to: adminEmail,
      subject,
      html,
      text,
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
  const isEN = language === 'en-US'
  const lang = isEN ? 'en-US' : 'pt-BR'
  const settings = await getSettings()
  const logoUrl = settings.brand_logo_email || undefined

  const title = isEN ? 'Reminder: your briefing is waiting' : 'Lembrete: briefing aguardando'

  const bodyHtml = isEN
    ? `<p style="margin:0 0 12px">Hello, <strong>${escapeHtml(clientName)}</strong>!</p>
       <p style="margin:0 0 12px">Just a quick reminder that your <strong>${escapeHtml(typeLabel)}</strong> briefing for <strong>${escapeHtml(company)}</strong> is still waiting.</p>
       <p style="margin:0">It only takes a few minutes — some answers are already pre-filled, you just need to review and confirm.</p>`
    : `<p style="margin:0 0 12px">Olá, <strong>${escapeHtml(clientName)}</strong>!</p>
       <p style="margin:0 0 12px">Passando para lembrar que seu briefing de <strong>${escapeHtml(typeLabel)}</strong> da <strong>${escapeHtml(company)}</strong> ainda está aguardando.</p>
       <p style="margin:0">Leva apenas alguns minutos — algumas respostas já estão preenchidas, é só revisar e confirmar.</p>`

  const ctaText = isEN ? 'Fill out now →' : 'Preencher agora →'
  const preheader = isEN
    ? `Quick reminder — briefing pending for ${company}`
    : `Lembrete rápido — briefing pendente da ${company}`

  const html = renderTemplate({
    title,
    bodyHtml,
    ctaText,
    ctaHref: link,
    lang,
    logoUrl,
    preheader,
  })
  const text = renderPlainText({ title, bodyHtml, ctaText, ctaHref: link })

  try {
    const result = await getResend().emails.send({
      from: FROM,
      to: clientEmail,
      subject: isEN
        ? `Reminder: ${typeLabel} briefing pending — ${company}`
        : `Lembrete: briefing de ${typeLabel} aguardando — ${company}`,
      html,
      text,
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
  const isEN = language === 'en-US'
  const lang = isEN ? 'en-US' : 'pt-BR'
  const settings = await getSettings()
  const logoUrl = settings.brand_logo_email || undefined

  const title = isEN ? 'Briefing received' : 'Briefing recebido'

  const editBlock = briefingLink
    ? renderMetaCard([
        {
          label: isEN ? 'Editing window' : 'Janela de edição',
          value: isEN
            ? `${editingHours} hours to review and edit your answers`
            : `${editingHours} horas para revisar e editar suas respostas`,
        },
      ])
    : ''

  const bodyHtml = isEN
    ? `<p style="margin:0 0 12px">Hello, <strong>${escapeHtml(clientName)}</strong>!</p>
       <p style="margin:0 0 12px">We received the <strong>${escapeHtml(typeLabel)}</strong> briefing for <strong>${escapeHtml(company)}</strong>. Thank you for taking the time.</p>
       ${editBlock}
       <p style="margin:0 0 12px">Our team will review your answers and reach out shortly to move things forward.</p>
       <p style="margin:0;color:${T.muted};font-size:13px">If you need to add anything else, just reply to this email.</p>`
    : `<p style="margin:0 0 12px">Olá, <strong>${escapeHtml(clientName)}</strong>!</p>
       <p style="margin:0 0 12px">Recebemos o briefing de <strong>${escapeHtml(typeLabel)}</strong> da <strong>${escapeHtml(company)}</strong>. Obrigado pelo seu tempo.</p>
       ${editBlock}
       <p style="margin:0 0 12px">Nossa equipe vai analisar suas respostas e em breve entrará em contato para dar andamento.</p>
       <p style="margin:0;color:${T.muted};font-size:13px">Se precisar adicionar algo, é só responder esse email.</p>`

  // CTA is the edit link when present, otherwise no CTA — confirmation
  // emails without an edit window don't need a button.
  const ctaText = briefingLink
    ? isEN
      ? 'Review my answers →'
      : 'Revisar minhas respostas →'
    : undefined
  const ctaHref = briefingLink

  const preheader = isEN
    ? `Briefing received — ${company}`
    : `Briefing recebido — ${company}`

  const html = renderTemplate({
    title,
    bodyHtml,
    ctaText,
    ctaHref,
    lang,
    logoUrl,
    preheader,
  })
  const text = renderPlainText({ title, bodyHtml, ctaText, ctaHref })

  try {
    const result = await getResend().emails.send({
      from: FROM,
      to: clientEmail,
      replyTo: process.env.NOTIFICATION_EMAIL || FROM,
      subject: isEN
        ? `Briefing received — ${company}`
        : `Briefing recebido — ${company}`,
      html,
      text,
    })
    return { ok: true, id: result.data?.id }
  } catch (error) {
    console.error('sendClientConfirmation failed:', error)
    return { ok: false, error }
  }
}

// ─── WhatsApp via CallMeBot ──────────────────────────────────────────────

export async function sendWhatsApp(message: string) {
  const phone = process.env.CALLMEBOT_PHONE
  const apikey = process.env.CALLMEBOT_APIKEY
  if (!phone || !apikey) return { ok: false, reason: 'not configured' }
  try {
    const encoded = encodeURIComponent(message)
    const url = `https://api.callmebot.com/whatsapp.php?phone=${phone}&text=${encoded}&apikey=${apikey}`
    const res = await fetch(url)
    return { ok: res.ok }
  } catch (error) {
    console.error('WhatsApp failed:', error)
    return { ok: false, error }
  }
}
