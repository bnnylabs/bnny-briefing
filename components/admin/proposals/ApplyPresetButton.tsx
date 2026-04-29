'use client'

import * as React from 'react'
import { Loader2, Sparkles, Star } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { Badge } from '@/components/ui/badge'

/**
 * Minimum shape any preset must have for this component. Concrete preset
 * types (PaymentPreset, TermsPreset, NextStepsPreset) all satisfy this
 * since they share the same metadata fields — only the body differs.
 */
export interface BasePreset {
  id: string
  name: string
  description: string | null
  type: string | null
  is_default: boolean
}

interface ApplyPresetButtonProps<T extends BasePreset> {
  /**
   * GET endpoint that returns { presets: T[] }. Lazy-loaded on first
   * popover open. Cached in component state per session.
   */
  endpoint: string

  /**
   * Called when the user picks a preset. Parent receives the full
   * preset object — extracts whatever payload field it cares about
   * (payment_terms, body_markdown, items, etc.).
   */
  onApply: (preset: T) => void

  /**
   * Returns a short detail line shown under each preset in the list
   * (e.g. "2 opções", "350 chars", "5 passos"). Helps owner pick at
   * a glance without opening each preset.
   */
  getDetailLine?: (preset: T) => string

  /**
   * Text shown when no presets exist. Should point the owner to the
   * config tab where they can create one.
   */
  emptyHint: React.ReactNode

  /** Optional className for layout flexibility. */
  className?: string

  /** Disabled state. */
  disabled?: boolean
}

/**
 * Generic "Aplicar preset" popover. Originally built for payment
 * presets (v0.10.86), generalized in v0.10.87 to also serve terms +
 * next-steps presets.
 *
 * Lazy-loads on first open. Subsequent opens reuse cache. Refresh
 * via full page reload (the editor pages don't need live updates of
 * preset library content during editing).
 *
 * Why popover and not Dialog: applying a preset is a 1-click choice
 * from a short list. A modal would feel heavy.
 */
export function ApplyPresetButton<T extends BasePreset>({
  endpoint,
  onApply,
  getDetailLine,
  emptyHint,
  className,
  disabled,
}: ApplyPresetButtonProps<T>) {
  const [open, setOpen] = React.useState(false)
  const [loading, setLoading] = React.useState(false)
  const [presets, setPresets] = React.useState<T[] | null>(null)

  const loadIfNeeded = React.useCallback(async () => {
    if (presets !== null) return
    setLoading(true)
    try {
      const res = await fetch(endpoint, { cache: 'no-store' })
      if (res.ok) {
        const data = await res.json()
        setPresets((data.presets ?? []) as T[])
      } else {
        setPresets([])
      }
    } catch {
      setPresets([])
    } finally {
      setLoading(false)
    }
  }, [endpoint, presets])

  function handleOpenChange(next: boolean) {
    setOpen(next)
    if (next) loadIfNeeded()
  }

  function handleApply(p: T) {
    onApply(p)
    setOpen(false)
  }

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={disabled}
          className={className}
        >
          <Sparkles className="mr-1 h-3.5 w-3.5" />
          Aplicar preset
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72 p-0">
        {loading ? (
          <div className="flex items-center justify-center p-6 text-sm text-muted-foreground">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Carregando…
          </div>
        ) : presets === null || presets.length === 0 ? (
          <div className="p-4 text-center text-xs text-muted-foreground">
            {emptyHint}
          </div>
        ) : (
          <div className="max-h-80 overflow-y-auto py-1">
            {presets.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => handleApply(p)}
                className="flex w-full items-start gap-2 px-3 py-2 text-left text-sm hover:bg-accent"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="font-medium">{p.name}</span>
                    {p.is_default && (
                      <Star
                        className="h-3 w-3 fill-current text-primary"
                        aria-label="Padrão"
                      />
                    )}
                    {p.type && (
                      <Badge
                        variant="secondary"
                        className="font-mono text-[9px]"
                      >
                        {p.type}
                      </Badge>
                    )}
                  </div>
                  {p.description && (
                    <div className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">
                      {p.description}
                    </div>
                  )}
                  {getDetailLine && (
                    <div className="mt-0.5 font-mono text-[10px] uppercase tracking-wider text-muted-foreground/80">
                      {getDetailLine(p)}
                    </div>
                  )}
                </div>
              </button>
            ))}
          </div>
        )}
      </PopoverContent>
    </Popover>
  )
}
