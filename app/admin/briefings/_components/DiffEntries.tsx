'use client'

import { Pencil } from 'lucide-react'
import { FIELD_LABELS_PT, FIELD_LABELS_EN } from '@/lib/briefing-types'

/**
 * Renders the per-field diff cards used in two distinct modals:
 *
 *   - ResponsesModal (when the operator toggles "Ver alterações")
 *   - DiffModal (the dedicated diff view, opened from a row's update count)
 *
 * Both render the same shape: a card per field with the label as a
 * heading, the old value struck through, the new value bold below.
 *
 * Extracted v0.10.102. Before, both modals had the same JSX block
 * inline — when one shifted padding or token names, the other quietly
 * drifted apart. Centralizing here makes either modal's diff display
 * a one-line change forever.
 *
 * Empty diff (`diff` is `{}`) renders nothing so the parent can show
 * its own empty-state copy ("Nenhuma alteração detectada" or
 * "Não foi possível comparar versões.") with the appropriate context.
 */
export function DiffEntries({
  diff,
  language,
}: {
  diff: Record<string, { old: unknown; new: unknown }>
  language?: string
}) {
  const labelMap = language === 'en-US' ? FIELD_LABELS_EN : FIELD_LABELS_PT

  return (
    <>
      {Object.entries(diff).map(([key, { old: oldVal, new: newVal }]) => {
        const label = labelMap[key] || key.replace(/_/g, ' ')
        const oldStr = Array.isArray(oldVal) ? (oldVal as string[]).join(', ') : String(oldVal || '')
        const newStr = Array.isArray(newVal) ? (newVal as string[]).join(', ') : String(newVal || '')
        return (
          <div key={key} className="rounded-lg overflow-hidden border border-border">
            <div className="px-3.5 py-2 bg-muted/40 border-b border-border">
              <span className="inline-flex items-center gap-1.5 text-[10px] font-bold text-foreground uppercase tracking-wider">
                <Pencil size={10} /> {label}
              </span>
            </div>
            <div className="px-3.5 py-3 bg-card flex flex-col gap-2">
              <div className="text-xs text-muted-foreground line-through">
                {oldStr || '—'}
              </div>
              <div className="text-sm font-semibold text-foreground">{newStr}</div>
            </div>
          </div>
        )
      })}
    </>
  )
}
