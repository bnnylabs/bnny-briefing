'use client'

import { useState } from 'react'
import { Loader2 } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import type { ProposalLanguage } from '@/lib/proposal-types'

/**
 * Confirmation + trigger dialog for the per-proposal master translation.
 *
 * Hits POST /api/proposals/[slug]/translate (the v0.10.92 master endpoint),
 * which translates scalars (title + payment_terms) plus every visible
 * block in parallel. The endpoint already implements skip-if-fresh, so
 * a second click on a fully-translated proposal is a near-no-op cost-wise.
 *
 * The endpoint returns only a summary, not the full new state. Reloading
 * the editor's local state from a partial response would be brittle; the
 * parent calls router.refresh() in onTranslated to re-pull blocks +
 * proposal from the server. That route is fast (server components +
 * Supabase select) and guarantees consistency including any per-block
 * translations that already existed and weren't touched by this call.
 *
 * UX shape:
 *   - Title + 1-line description (target language + block count)
 *   - "Re-traduzir blocos já atualizados" toggle (force flag)
 *   - Confirm + Cancel buttons
 *   - On confirm: spinner, then close + parent toast + parent refresh
 *
 * The dialog itself doesn't render the menu trigger — the parent owns the
 * DropdownMenuItem and the open state. Decoupled because Radix DropdownMenu
 * closes on item click, which would unmount a co-located dialog.
 */

export interface TranslationSummary {
  targetLang: ProposalLanguage
  sourceLang: ProposalLanguage
  blocks: {
    translated: number
    skipped_fresh: number
    skipped_invisible: number
    failed: number
  }
  scalars: string
}

export interface MasterTranslateDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  slug: string
  /** Language being translated to. */
  targetLang: ProposalLanguage
  /** How many visible blocks the parent expects to be processed. */
  blockCount: number
  /** Called after a successful run with the server's summary. */
  onTranslated: (summary: TranslationSummary) => void
  onError?: (message: string) => void
}

const LANG_LABEL: Record<ProposalLanguage, string> = {
  'pt-BR': 'Português',
  'en-US': 'English',
}

export function MasterTranslateDialog({
  open,
  onOpenChange,
  slug,
  targetLang,
  blockCount,
  onTranslated,
  onError,
}: MasterTranslateDialogProps) {
  const [force, setForce] = useState(false)
  const [loading, setLoading] = useState(false)

  const langLabel = LANG_LABEL[targetLang]

  const handleConfirm = async () => {
    if (loading) return
    setLoading(true)
    try {
      const res = await fetch(`/api/proposals/${slug}/translate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetLang, force }),
      })
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string }
        throw new Error(data.error || 'Falha ao traduzir')
      }
      const data = (await res.json()) as {
        ok?: boolean
        summary?: TranslationSummary
      }
      if (!data.summary) {
        throw new Error('Resposta inesperada do servidor')
      }
      onTranslated(data.summary)
      onOpenChange(false)
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Falha ao traduzir'
      onError?.(msg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !loading && onOpenChange(v)}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Traduzir proposta para {langLabel}</DialogTitle>
          <DialogDescription>
            Traduz o título, condições de pagamento e {blockCount}{' '}
            {blockCount === 1 ? 'bloco visível' : 'blocos visíveis'} usando IA.
            Blocos invisíveis são pulados. A tradução fica salva e pode ser
            refeita depois sem custo extra para blocos já atualizados.
          </DialogDescription>
        </DialogHeader>

        <div className="px-6 pb-2">
          <label className="flex items-start gap-2 text-sm">
            <input
              type="checkbox"
              checked={force}
              onChange={(e) => setForce(e.target.checked)}
              className="mt-1 h-3.5 w-3.5 rounded border-border accent-primary"
              disabled={loading}
            />
            <div>
              <div className="text-foreground">
                Re-traduzir blocos já atualizados
              </div>
              <div className="text-xs text-muted-foreground">
                Por padrão, blocos com tradução em sincronia com a fonte são
                pulados. Marque para forçar nova tradução em todos.
              </div>
            </div>
          </label>
        </div>

        <DialogFooter className="p-6 pt-2">
          <Button
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={loading}
          >
            Cancelar
          </Button>
          <Button onClick={handleConfirm} disabled={loading}>
            {loading ? (
              <>
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                Traduzindo…
              </>
            ) : (
              `Traduzir para ${langLabel}`
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
