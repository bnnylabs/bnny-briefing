/**
 * email-markdown — minimal, email-safe markdown renderer.
 *
 * The surface is intentionally tiny so admins editing email copy can't
 * smuggle in HTML that breaks Outlook/Apple Mail rendering or, worse,
 * arbitrary scripts. Supported syntax:
 *
 *   • Paragraphs: blank-line separated.
 *   • **bold**            → <strong>
 *   • *italic*            → <em>
 *   • [text](url)         → <a> (only http/https/mailto/relative are allowed)
 *   • > muted line        → muted small paragraph (used for the small
 *                           "reply to add anything" line at the bottom of
 *                           the confirmation email).
 *   • Single \n inside a paragraph → <br>
 *   • {{block_name}}      → injected pre-rendered HTML block. The
 *                           sender supplies a `blocks` map; if a block
 *                           is missing or empty, the placeholder
 *                           paragraph is silently dropped. This lets us
 *                           keep structural pieces (meta cards, diff
 *                           tables, fallback links) auto-rendered with
 *                           the right inline styles while still letting
 *                           the admin position them inside the body.
 *
 * No headings, no lists, no images, no tables. Anything else stays
 * literal. The renderer escapes HTML before applying inline rules,
 * which is why escapeHtml lives here too rather than reaching back to
 * email.ts — keeps the module self-contained for testing.
 */

export interface RenderMarkdownOpts {
  fontStack: string
  mutedColor: string
  /**
   * Pre-rendered HTML blocks keyed by name. A paragraph that consists
   * solely of `{{name}}` is replaced by the corresponding HTML; if the
   * key is missing or the value is empty, the paragraph is dropped.
   */
  blocks?: Record<string, string>
}

export function escapeHtml(s: string | undefined | null): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function isSafeUrl(url: string): boolean {
  // Allow http(s), mailto, and root-relative or anchor links. Everything
  // else (data:, javascript:, file:) gets neutralized to '#'.
  return /^(https?:|mailto:)/i.test(url) || url.startsWith('/') || url.startsWith('#')
}

/**
 * Inline markdown rendering. Input is assumed to be HTML-escaped on
 * the literal text portions; markdown markers (* [ ] ( )) survive
 * escapeHtml unchanged so the regexes below still match.
 */
function renderInline(text: string): string {
  let out = text
  // Links first so [** something](url) doesn't get its label mangled
  // by the bold/italic passes.
  out = out.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_m, label, url) => {
    const safeUrl = isSafeUrl(url) ? url : '#'
    return `<a href="${safeUrl}" target="_blank" style="color:inherit;text-decoration:underline">${label}</a>`
  })
  // Bold (must run before italic since ** would otherwise match * twice).
  out = out.replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>')
  // Italic — single * not adjacent to another *. Negative lookbehind
  // rejects ** that already became <strong>.
  out = out.replace(/(^|[^*])\*([^*\n]+)\*(?!\*)/g, '$1<em>$2</em>')
  // Single \n inside a paragraph → <br> (paragraph splitting happens
  // upstream).
  out = out.replace(/\n/g, '<br>')
  return out
}

export function renderMarkdownToHtml(md: string, opts: RenderMarkdownOpts): string {
  const { fontStack, mutedColor, blocks = {} } = opts
  // Normalize line endings, then split on blank lines.
  const paragraphs = (md ?? '').replace(/\r\n/g, '\n').split(/\n\n+/)
  const out: string[] = []

  for (const raw of paragraphs) {
    const trimmed = raw.trim()
    if (!trimmed) continue

    // Block placeholder — a paragraph that is exactly `{{name}}` (or
    // surrounded by whitespace) is replaced by the named pre-rendered
    // HTML block. If the block is missing/empty, drop the paragraph.
    const blockMatch = trimmed.match(/^\{\{(\w+)\}\}$/)
    if (blockMatch) {
      const name = blockMatch[1]
      const html = blocks[name]
      if (html && html.trim()) out.push(html)
      continue
    }

    // Muted "blockquote" — entire paragraph rendered small + muted.
    // We strip a single leading "> " from each line so multi-line muted
    // blocks compose naturally.
    const isMuted = trimmed.split('\n').every((l) => l.startsWith('> '))
    if (isMuted) {
      const stripped = trimmed
        .split('\n')
        .map((l) => l.slice(2))
        .join('\n')
      const escaped = escapeHtml(stripped)
      const inline = renderInline(escaped)
      out.push(
        `<p style="margin:0 0 12px;font-family:${fontStack};color:${mutedColor};font-size:13px;line-height:1.5">${inline}</p>`,
      )
      continue
    }

    const escaped = escapeHtml(trimmed)
    const inline = renderInline(escaped)
    out.push(
      `<p style="margin:0 0 12px;font-family:${fontStack};font-size:15px;color:inherit;line-height:1.6">${inline}</p>`,
    )
  }

  return out.join('')
}

/**
 * Replace `{var_name}` placeholders with values. Unknown placeholders
 * are left literal (so admins notice their typos instead of getting a
 * silent empty string in the inbox).
 *
 * Values are NOT escaped here — escaping happens at render time inside
 * renderMarkdownToHtml. If a value contains markdown markers (e.g., a
 * client whose name has a literal `**` in it), they will be interpreted.
 * Acceptable for v0.6.0 — variable values in this app are client names,
 * company names, type labels, and dates, none of which realistically
 * contain markdown syntax.
 */
export type TemplateVars = Record<string, string | number>

export function interpolate(text: string, vars: TemplateVars): string {
  return text.replace(/\{(\w+)\}/g, (match, key) => {
    if (key in vars) return String(vars[key])
    return match
  })
}
