'use client'

import * as React from 'react'
import { AlertTriangle, type LucideIcon } from 'lucide-react'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface ConfirmDialogProps {
  /** Open/close state — keep this lifted in the caller. */
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Headline at the top of the dialog. Keep it as a question. */
  title: string
  /** One-line context shown below the title. Optional. */
  description?: React.ReactNode
  /** Icon at the top of the card (default: AlertTriangle). */
  icon?: LucideIcon
  /** Visual treatment of the action button. */
  variant?: 'destructive' | 'default'
  /** Label for the confirm button. Default 'Confirmar'. */
  confirmLabel?: string
  /** Label for the cancel button. Default 'Cancelar'. */
  cancelLabel?: string
  /** Async or sync confirm handler. While in-flight, button shows loading. */
  onConfirm: () => void | Promise<void>
  /** External pending state (e.g. when caller manages its own loading). */
  loading?: boolean
}

/**
 * Reusable confirmation dialog. Replaces:
 *   - window.confirm() native popups (inconsistent with brand, no
 *     focus-trap, blocks the JS thread, ugly on mobile)
 *   - bespoke <Modal> implementations scattered across pages
 *
 * Built on top of <Dialog> Radix so it inherits focus-trap, portal
 * rendering, escape handling, scroll-lock, accessible aria attributes.
 *
 * Internal pending state ensures the confirm button shows feedback
 * even when the caller hands us an async function without managing
 * its own loading state.
 */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  icon: Icon = AlertTriangle,
  variant = 'destructive',
  confirmLabel = 'Confirmar',
  cancelLabel = 'Cancelar',
  onConfirm,
  loading: externalLoading,
}: ConfirmDialogProps) {
  const [internalLoading, setInternalLoading] = React.useState(false)
  const loading = externalLoading ?? internalLoading

  const handleConfirm = async () => {
    setInternalLoading(true)
    try {
      await onConfirm()
    } finally {
      setInternalLoading(false)
    }
  }

  const tone =
    variant === 'destructive'
      ? 'bg-destructive/10 text-destructive'
      : 'bg-primary/10 text-primary'

  return (
    <Dialog open={open} onOpenChange={(o) => !loading && onOpenChange(o)}>
      <DialogContent className="max-w-md">
        <div className="py-2 text-center">
          <div className={cn('mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full', tone)}>
            <Icon className="h-[22px] w-[22px]" />
          </div>
          <div className="mb-1 text-lg font-bold tracking-tight">{title}</div>
          {description && (
            <div className="mb-6 text-sm text-muted-foreground">{description}</div>
          )}
          {!description && <div className="mb-6" />}
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
              className="flex-1"
            >
              {cancelLabel}
            </Button>
            <Button
              variant={variant}
              onClick={handleConfirm}
              disabled={loading}
              className="flex-1"
            >
              {loading ? 'Aguarde…' : confirmLabel}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
