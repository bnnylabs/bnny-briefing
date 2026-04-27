'use client'

import * as React from 'react'
import { ExternalLink, X } from 'lucide-react'

import { Dialog, DialogContent } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'

interface PreviewModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Briefing type slug, e.g. 'logo' or 'identidade' */
  type: string
  /** Language: 'pt-BR' | 'en-US' */
  language: string
  /** Company name shown in the preview header */
  company: string
}

/**
 * Lightbox modal for "see what the client will see".
 *
 * Replaces the previous window.open()-based popup so previews follow the
 * same lightbox pattern as every other admin action. Header has an
 * "Abrir em nova aba" button for the rare case of sharing the link
 * outside this device.
 */
export function PreviewModal({
  open,
  onOpenChange,
  type,
  language,
  company,
}: PreviewModalProps) {
  const url = React.useMemo(() => {
    const params = new URLSearchParams({
      type,
      lang: language,
      company: company || 'Empresa',
    })
    return `/admin/preview?${params.toString()}`
  }, [type, language, company])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showClose={false}
        className="flex h-[90vh] w-[min(560px,95vw)] max-w-none flex-col gap-0 overflow-hidden p-0"
      >
        <div className="flex shrink-0 items-center justify-between gap-2 border-b border-border bg-card px-3 py-2">
          <div className="text-xs text-muted-foreground">
            Pré-visualização — como o cliente vai ver
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={() =>
                window.open(url, '_blank', 'noopener,noreferrer')
              }
              title="Abrir em nova aba (para compartilhar)"
            >
              <ExternalLink size={13} />
              Nova aba
            </Button>
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="rounded p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
              aria-label="Fechar preview"
            >
              <X size={16} />
            </button>
          </div>
        </div>
        <iframe
          src={url}
          title="Preview do briefing"
          className="h-full w-full flex-1 border-0 bg-background"
        />
      </DialogContent>
    </Dialog>
  )
}
