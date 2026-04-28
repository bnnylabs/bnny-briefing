/**
 * proposal-markdown — minimal markdown→React renderer for proposal blocks.
 *
 * Surface intentionally small. We don't want a full markdown parser — the
 * content comes from owner-controlled templates, not arbitrary user input,
 * but escaping HTML is still the safer baseline.
 *
 * Supported:
 *   • # Heading 1 / ## Heading 2 / ### Heading 3
 *   • **bold** / *italic*
 *   • [text](url) — only http/https/mailto/relative URLs
 *   • Paragraphs separated by blank lines
 *   • Single \n inside a paragraph → <br>
 *
 * Not supported (intentionally): images, code blocks, lists, tables. Lists
 * are handled by the next_steps block which has structured items.
 */

import * as React from 'react'

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function isSafeUrl(url: string): boolean {
  return /^(https?:|mailto:)/i.test(url) || url.startsWith('/') || url.startsWith('#')
}

/** Apply inline markdown to a (HTML-escaped) string. Returns HTML string. */
function renderInline(escaped: string): string {
  let out = escaped
  // Links first
  out = out.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_m, label: string, url: string) => {
    const safe = isSafeUrl(url) ? url : '#'
    return `<a href="${safe}" target="_blank" rel="noopener noreferrer" class="underline underline-offset-2 hover:text-primary">${label}</a>`
  })
  // Bold before italic so ** doesn't get eaten by italic regex
  out = out.replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>')
  out = out.replace(/(^|[^*])\*([^*\n]+)\*(?!\*)/g, '$1<em>$2</em>')
  // Single newlines inside a paragraph → <br>
  out = out.replace(/\n/g, '<br>')
  return out
}

interface ProposalMarkdownProps {
  source: string
  /** Extra Tailwind classes for the outer wrapper */
  className?: string
}

/**
 * Renders markdown as a vertical stack of React elements. Each paragraph and
 * heading is a separate node, so Tailwind `space-y-*` on the container
 * controls gaps consistently.
 */
export function ProposalMarkdown({ source, className }: ProposalMarkdownProps) {
  const blocks = React.useMemo(() => parseBlocks(source), [source])

  return (
    <div className={className ?? 'space-y-3 text-sm leading-relaxed text-foreground/85'}>
      {blocks.map((block, i) => {
        switch (block.kind) {
          case 'h1':
            return (
              <h2
                key={i}
                className="text-lg font-bold tracking-tight text-foreground"
                dangerouslySetInnerHTML={{ __html: renderInline(escapeHtml(block.text)) }}
              />
            )
          case 'h2':
            return (
              <h3
                key={i}
                className="mt-2 text-sm font-bold tracking-tight text-foreground"
                dangerouslySetInnerHTML={{ __html: renderInline(escapeHtml(block.text)) }}
              />
            )
          case 'h3':
            return (
              <h4
                key={i}
                className="text-xs font-semibold uppercase tracking-widest text-muted-foreground"
                dangerouslySetInnerHTML={{ __html: renderInline(escapeHtml(block.text)) }}
              />
            )
          case 'p':
          default:
            return (
              <p
                key={i}
                dangerouslySetInnerHTML={{ __html: renderInline(escapeHtml(block.text)) }}
              />
            )
        }
      })}
    </div>
  )
}

type Block =
  | { kind: 'h1'; text: string }
  | { kind: 'h2'; text: string }
  | { kind: 'h3'; text: string }
  | { kind: 'p'; text: string }

function parseBlocks(md: string): Block[] {
  const normalized = (md ?? '').replace(/\r\n/g, '\n').trim()
  if (!normalized) return []

  const paragraphs = normalized.split(/\n\n+/)
  const out: Block[] = []

  for (const raw of paragraphs) {
    const trimmed = raw.trim()
    if (!trimmed) continue

    // A "paragraph" can contain multiple heading lines. Walk lines so that
    // a heading followed by a paragraph in the same block (no blank line)
    // still renders correctly.
    const lines = trimmed.split('\n')
    let buffer: string[] = []

    const flushBuffer = () => {
      if (buffer.length === 0) return
      out.push({ kind: 'p', text: buffer.join('\n') })
      buffer = []
    }

    for (const line of lines) {
      const h3 = line.match(/^###\s+(.+)$/)
      const h2 = line.match(/^##\s+(.+)$/)
      const h1 = line.match(/^#\s+(.+)$/)
      if (h3) {
        flushBuffer()
        out.push({ kind: 'h3', text: h3[1].trim() })
      } else if (h2) {
        flushBuffer()
        out.push({ kind: 'h2', text: h2[1].trim() })
      } else if (h1) {
        flushBuffer()
        out.push({ kind: 'h1', text: h1[1].trim() })
      } else {
        buffer.push(line)
      }
    }
    flushBuffer()
  }

  return out
}
