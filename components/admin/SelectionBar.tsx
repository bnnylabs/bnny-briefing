'use client'

import * as React from 'react'
import { CheckCircle2, Trash2 } from 'lucide-react'

import { cn } from '@/lib/utils'

interface SelectionBarProps {
  /** Number of items currently selected. The bar renders only when > 0. */
  count: number
  /** Singular label fragment, e.g. 'briefing' / 'cliente' */
  itemLabel: string
  /** Plural label fragment, e.g. 'briefings' / 'clientes' */
  itemLabelPlural: string
  /** Called when the user clicks Cancel (clear selection). */
  onCancel: () => void
  /** Called when the user clicks the destructive batch action. */
  onDelete: () => void
  /** Optional className applied to the root for container-level overrides. */
  className?: string
}

/**
 * Floating-style selection bar shown at the top of a list when the user
 * has selected one or more rows. The contrast-heavy treatment (dark
 * foreground bg + inverted text) clearly distinguishes 'selection mode'
 * from regular content while keeping the destructive action obvious via
 * the red button.
 *
 * Animates in from the top so the appearance reads as a state change,
 * not a layout shift.
 *
 * Used by /admin/briefings and /admin/clientes for parity.
 */
export function SelectionBar({
  count,
  itemLabel,
  itemLabelPlural,
  onCancel,
  onDelete,
  className,
}: SelectionBarProps) {
  if (count <= 0) return null

  const noun = count === 1 ? itemLabel : itemLabelPlural
  void noun // reserved for future copy ('Excluir 2 briefings'), kept compact for now

  return (
    <div
      role="region"
      aria-label="Ações em lote"
      className={cn(
        'mb-3 flex items-center justify-between gap-3 rounded-lg border border-foreground/15 bg-card px-3.5 py-2 shadow-md',
        'animate-in slide-in-from-top-2 fade-in-0 duration-200',
        className,
      )}
    >
      <span className="inline-flex items-center gap-2 text-sm font-medium text-foreground tabular-nums">
        <CheckCircle2
          size={14}
          strokeWidth={2}
          className="text-foreground/70"
        />
        {count} selecionado{count > 1 ? 's' : ''}
      </span>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-md px-2.5 py-1 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          Cancelar
        </button>
        <button
          type="button"
          onClick={onDelete}
          className="inline-flex items-center gap-1.5 rounded-md bg-destructive px-3 py-1.5 text-sm font-medium text-destructive-foreground transition-colors hover:bg-destructive/90"
        >
          <Trash2 size={13} strokeWidth={2} />
          Excluir {count}
        </button>
      </div>
    </div>
  )
}
