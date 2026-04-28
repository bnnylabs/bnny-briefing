'use client'

import type { BlockContentHeader } from '@/lib/proposal-types'

interface HeaderEditorProps {
  content: BlockContentHeader
  onChange: (content: BlockContentHeader) => void
}

/**
 * Header block — free-form intro paragraph.
 * In the BNNY Horus PDF this is the "Foi um prazer conversar com você sobre…"
 * opening copy that sits right under the proposal title.
 */
export function HeaderEditor({ content, onChange }: HeaderEditorProps) {
  return (
    <div className="space-y-2">
      <label className="text-[10px] uppercase tracking-widest text-muted-foreground">
        Texto de abertura
      </label>
      <textarea
        value={content.body ?? ''}
        onChange={(e) => onChange({ body: e.target.value })}
        placeholder="Foi um prazer conversar com você sobre…"
        rows={4}
        className="w-full resize-y rounded-md border border-border bg-card px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
      />
    </div>
  )
}

interface HeaderPreviewProps {
  content: BlockContentHeader
}

export function HeaderPreview({ content }: HeaderPreviewProps) {
  if (!content.body?.trim()) {
    return (
      <p className="text-sm italic text-muted-foreground/60">
        Texto de abertura aparecerá aqui…
      </p>
    )
  }
  // Render newlines as paragraph breaks for the preview.
  const paragraphs = content.body.split(/\n\n+/).filter(Boolean)
  return (
    <div className="space-y-3 text-sm leading-relaxed text-foreground/85">
      {paragraphs.map((p, i) => (
        <p key={i} className="whitespace-pre-wrap">
          {p}
        </p>
      ))}
    </div>
  )
}
