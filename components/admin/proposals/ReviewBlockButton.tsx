'use client'

import { useState } from 'react'
import { Wand2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { ReviewBlockDialog } from './ReviewBlockDialog'
import type {
  ProposalBlock,
  ProposalBlockContent,
} from '@/lib/proposal-types'

/**
 * Compact "Revisar" button — sits in a card header next to TranslationPill
 * (and, in some cards, next to RewriteButton). Click opens the
 * ReviewBlockDialog. Self-contained: owns its own open/close state.
 *
 * Visual signature: Wand2 icon in muted tone by default, primary on
 * hover. Distinct from RewriteButton (Sparkles, "Reescrever") — same
 * visual scale but different verb and icon to avoid confusion.
 *
 * Difference recap:
 *   RewriteButton  → reescreve UM campo de texto livre
 *                    (header_body, phase_description, investment_intro)
 *   ReviewButton   → revisa o BLOCO inteiro com diff + accept/reject
 *
 * The two coexist on purpose. Per-field rewriting stays useful for
 * targeted edits ("só essa frase"); per-block review handles the
 * holistic case of "passa um pente no bloco todo".
 */
export function ReviewBlockButton({
  slug,
  block,
  blockLabel,
  onApplied,
  onError,
  className,
}: {
  slug: string
  block: Pick<ProposalBlock, 'id' | 'type' | 'content'>
  /** Label de UI mostrado no header do Dialog. Ex: "Texto de abertura". */
  blockLabel: string
  /**
   * Aplica a revisão. Parent normalmente faz patchBlock(block.id, revised)
   * + auto-save dispara (mesmo caminho de qualquer edição manual).
   */
  onApplied: (revised: ProposalBlockContent) => void
  onError?: (message: string) => void
  className?: string
}) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={() => setOpen(true)}
        className={cn(
          'h-7 gap-1 px-2 text-[11px] text-muted-foreground hover:text-primary',
          className,
        )}
        aria-label="Revisar bloco com IA"
        title="Revisar bloco com IA"
      >
        <Wand2 className="h-3 w-3" />
        Revisar
      </Button>
      <ReviewBlockDialog
        open={open}
        onOpenChange={setOpen}
        slug={slug}
        block={block}
        blockLabel={blockLabel}
        onAccept={onApplied}
        onError={onError}
      />
    </>
  )
}
