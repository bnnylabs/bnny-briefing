'use client'

import { useState } from 'react'
import { Globe, Loader2 } from 'lucide-react'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { getTranslationStatus, type Lang } from '@/lib/translate'
import type {
  ProposalBlock,
  ProposalLanguage,
  TranslationStatus,
} from '@/lib/proposal-types'

/**
 * Per-block translation status pill.
 *
 * Sits inline on the block's CardHeader, next to other actions like
 * RewriteButton. The pill colour communicates state at a glance:
 *
 *   missing  → muted (no translation exists for targetLang yet)
 *   stale    → warning (source was edited after the last translation)
 *   fresh    → success (translation matches current source)
 *
 * Click → Popover with the appropriate action for the state. The
 * action calls POST /api/proposals/[slug]/blocks/[blockId]/translate
 * (the v0.10.92 per-block endpoint) with `force=true` only when the
 * existing translation is fresh — otherwise the endpoint's skip-if-fresh
 * logic would no-op and the operator would see no change.
 *
 * On success, the parent receives the updated translations + meta via
 * onTranslated and patches state locally — no full reload. The pill
 * re-renders with the new (fresh) status.
 *
 * Excluir tradução isn't here yet — saved for a follow-up bump together
 * with a side-by-side viewer. The current ask flow is generation only.
 */

type PillKind = TranslationStatus

const LANG_LABEL: Record<Lang, string> = {
  'pt-BR': 'Português',
  'en-US': 'English',
}

const STATUS_LABEL: Record<PillKind, string> = {
  missing: 'sem tradução',
  stale: 'desatualizada',
  fresh: 'atualizada',
}

/** Tailwind classes for each pill state — uses the existing brand tokens. */
const PILL_CLASSES: Record<PillKind, string> = {
  missing:
    'bg-muted text-muted-foreground hover:bg-muted/80 ring-1 ring-border',
  stale:
    'bg-yellow-500/15 text-yellow-700 hover:bg-yellow-500/25 ring-1 ring-yellow-500/30 dark:text-yellow-400',
  fresh:
    'bg-primary/15 text-foreground hover:bg-primary/25 ring-1 ring-primary/30',
}

export interface TranslationPillProps {
  block: Pick<ProposalBlock, 'id' | 'content' | 'translations' | 'translations_meta'>
  /** Source language of the parent proposal. */
  sourceLang: ProposalLanguage
  /** Target language being managed by this pill. */
  targetLang: ProposalLanguage
  /** Slug of the parent proposal — used to build the API path. */
  slug: string
  /** Called with the new translations + meta after a successful generation. */
  onTranslated: (next: {
    translations: ProposalBlock['translations']
    translations_meta: ProposalBlock['translations_meta']
  }) => void
  onError?: (message: string) => void
}

export function TranslationPill({
  block,
  sourceLang,
  targetLang,
  slug,
  onTranslated,
  onError,
}: TranslationPillProps) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)

  // Source language always renders as fresh — pill not shown for it.
  // Caller already filters but defensive nonetheless.
  if (sourceLang === targetLang) return null

  const status = getTranslationStatus(
    block.content,
    block.translations,
    block.translations_meta,
    targetLang,
  )

  const langLabel = LANG_LABEL[targetLang]

  const actionLabel: Record<PillKind, string> = {
    missing: `Traduzir para ${langLabel}`,
    stale: 'Atualizar tradução',
    fresh: 'Re-traduzir',
  }

  const handleAction = async () => {
    if (loading) return
    setLoading(true)
    try {
      const res = await fetch(
        `/api/proposals/${slug}/blocks/${block.id}/translate`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            targetLang,
            // Only force when the current state is fresh — otherwise the
            // endpoint will translate naturally (missing/stale always run).
            force: status === 'fresh',
          }),
        },
      )
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string }
        throw new Error(data.error || 'Falha ao traduzir')
      }
      const data = (await res.json()) as {
        block: {
          translations: ProposalBlock['translations']
          translations_meta: ProposalBlock['translations_meta']
        }
      }
      onTranslated({
        translations: data.block.translations,
        translations_meta: data.block.translations_meta,
      })
      setOpen(false)
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Falha ao traduzir'
      onError?.(msg)
    } finally {
      setLoading(false)
    }
  }

  // ── Delete: 2-click confirmation pattern ──────────────────────────
  // First click flips the button into a "confirm" red state. Second
  // click within the same popover session fires the DELETE. Cheaper
  // and less interruptive than a full ConfirmDialog for a low-stakes
  // action that's also reversible (operator can re-translate later).
  // The confirm state is reset whenever the popover reopens.
  const [confirmingDelete, setConfirmingDelete] = useState(false)

  const handleDelete = async () => {
    if (loading) return
    if (!confirmingDelete) {
      setConfirmingDelete(true)
      return
    }
    setLoading(true)
    try {
      const res = await fetch(
        `/api/proposals/${slug}/blocks/${block.id}/translate?lang=${encodeURIComponent(targetLang)}`,
        { method: 'DELETE' },
      )
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string }
        throw new Error(data.error || 'Falha ao excluir tradução')
      }
      const data = (await res.json()) as {
        block: {
          translations: ProposalBlock['translations']
          translations_meta: ProposalBlock['translations_meta']
        }
      }
      onTranslated({
        translations: data.block.translations,
        translations_meta: data.block.translations_meta,
      })
      setConfirmingDelete(false)
      setOpen(false)
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Falha ao excluir tradução'
      onError?.(msg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Popover
      open={open}
      onOpenChange={(v) => {
        setOpen(v)
        if (!v) setConfirmingDelete(false)
      }}
    >
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide transition-colors',
            PILL_CLASSES[status],
          )}
          aria-label={`Tradução ${langLabel}: ${STATUS_LABEL[status]}`}
        >
          <Globe className="h-2.5 w-2.5" />
          {targetLang === 'en-US' ? 'EN' : 'PT'}
          {status === 'stale' && <span aria-hidden>•</span>}
          {status === 'fresh' && <span aria-hidden>✓</span>}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-64 p-3">
        <div className="space-y-2">
          <div className="text-xs">
            <div className="font-semibold text-foreground">
              Tradução {langLabel}
            </div>
            <div className="mt-0.5 text-muted-foreground">
              {status === 'missing' && 'Este bloco ainda não foi traduzido.'}
              {status === 'stale' &&
                'A fonte foi editada depois da última tradução. Conteúdo desatualizado.'}
              {status === 'fresh' && 'Tradução em sincronia com a fonte.'}
            </div>
          </div>
          <Button
            type="button"
            size="sm"
            className="w-full"
            onClick={handleAction}
            disabled={loading}
            variant={status === 'fresh' ? 'outline' : 'default'}
          >
            {loading && !confirmingDelete ? (
              <>
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                Traduzindo…
              </>
            ) : (
              actionLabel[status]
            )}
          </Button>
          {status !== 'missing' && (
            <Button
              type="button"
              size="sm"
              className="w-full"
              onClick={handleDelete}
              disabled={loading}
              variant={confirmingDelete ? 'destructive' : 'ghost'}
            >
              {loading && confirmingDelete ? (
                <>
                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                  Excluindo…
                </>
              ) : confirmingDelete ? (
                'Confirmar exclusão'
              ) : (
                'Excluir tradução'
              )}
            </Button>
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}
