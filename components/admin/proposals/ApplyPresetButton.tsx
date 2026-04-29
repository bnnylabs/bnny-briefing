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
import type { PaymentTerm } from '@/lib/proposal-types'
import type { PaymentPreset } from '@/lib/payment-presets'

interface ApplyPresetButtonProps {
  /**
   * Called when the user picks a preset. Parent receives the
   * payment_terms array from the chosen preset and is responsible for
   * patching the block content. Sync — no async work happens inside.
   */
  onApply: (terms: PaymentTerm[]) => void
  /** Optional className for layout flexibility. */
  className?: string
  /** Disabled state — parent passes when in some operation. */
  disabled?: boolean
}

/**
 * Button that opens a popover listing all payment presets. Clicking a
 * preset replaces the current payment_terms with the preset's terms.
 *
 * Lazy-loads the preset list on first popover open. Subsequent opens
 * reuse the cache (in-memory; refreshes on full page reload).
 *
 * Used in two places:
 *   1. components/admin/proposals/BlockInvestment.tsx (template +
 *      proposal investment editors share the same component)
 *   2. Anywhere else that wants to apply a preset to PaymentTerm[]
 *
 * Why a popover and not a Dialog: presets are a quick choice (1 click).
 * A modal would feel heavy for picking from a short list.
 */
export function ApplyPresetButton({
  onApply,
  className,
  disabled,
}: ApplyPresetButtonProps) {
  const [open, setOpen] = React.useState(false)
  const [loading, setLoading] = React.useState(false)
  const [presets, setPresets] = React.useState<PaymentPreset[] | null>(null)

  const loadIfNeeded = React.useCallback(async () => {
    if (presets !== null) return
    setLoading(true)
    try {
      const res = await fetch('/api/proposal-payment-presets', {
        cache: 'no-store',
      })
      if (res.ok) {
        const data = await res.json()
        setPresets((data.presets ?? []) as PaymentPreset[])
      } else {
        setPresets([])
      }
    } catch {
      setPresets([])
    } finally {
      setLoading(false)
    }
  }, [presets])

  function handleOpenChange(next: boolean) {
    setOpen(next)
    if (next) loadIfNeeded()
  }

  function handleApply(p: PaymentPreset) {
    onApply(p.payment_terms ?? [])
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
            Nenhum preset cadastrado.
            <br />
            Crie em <span className="font-mono">Configurações &gt; Pagamentos</span>.
          </div>
        ) : (
          <div className="max-h-80 overflow-y-auto py-1">
            {presets.map((p) => {
              const termCount = (p.payment_terms ?? []).filter((t) => {
                const hasLabel = !!t.label?.trim()
                const hasDesc = !!t.description?.trim()
                return hasLabel || hasDesc
              }).length
              return (
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
                        <Star className="h-3 w-3 fill-current text-primary" aria-label="Padrão" />
                      )}
                      {p.type && (
                        <Badge variant="secondary" className="font-mono text-[9px]">
                          {p.type}
                        </Badge>
                      )}
                    </div>
                    {p.description && (
                      <div className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">
                        {p.description}
                      </div>
                    )}
                    <div className="mt-0.5 font-mono text-[10px] uppercase tracking-wider text-muted-foreground/80">
                      {termCount} {termCount === 1 ? 'opção' : 'opções'}
                    </div>
                  </div>
                </button>
              )
            })}
          </div>
        )}
      </PopoverContent>
    </Popover>
  )
}
