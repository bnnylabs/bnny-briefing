'use client'

/**
 * Card de notas internas — barra lateral direita do ProposalEditor.
 *
 * Texto livre privado usado pelo operador pra rastrear contexto de
 * negociação, lembretes, riscos. Nunca renderizado na proposta pública,
 * nunca incluído no PDF, nunca enviado ao cliente.
 *
 * Extraído do ProposalEditor.tsx na fase J (v0.10.97). Comportamento
 * idêntico ao original — só mudou de arquivo.
 */

import { useEffect, useState } from 'react'
import { Lock } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { cn } from '@/lib/utils'

export function InternalNotesCard({
  value,
  onChange,
}: {
  value: string | null
  onChange: (notes: string | null) => void
}) {
  const [draft, setDraft] = useState(value ?? '')

  // Keep local draft in sync if the proposal reloads with new server state.
  useEffect(() => {
    setDraft(value ?? '')
  }, [value])

  return (
    <Card className="p-5">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-1.5 text-[15px] font-bold tracking-tight">
          <Lock className="h-4 w-4 text-muted-foreground" />
          Notas internas
        </div>
        <span className="rounded-md border border-border bg-muted/60 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
          Privado
        </span>
      </div>

      <p className="mb-2 text-[11px] leading-relaxed text-muted-foreground">
        Anotações que só você vê. Não aparecem na proposta pública nem no PDF.
      </p>

      <textarea
        value={draft}
        onChange={(e) => {
          setDraft(e.target.value)
          // Save on every keystroke (debounced upstream by useAutoSave).
          // Empty string is normalized to null so the DB stays clean.
          onChange(e.target.value.trim() === '' ? null : e.target.value)
        }}
        placeholder="Contexto da negociação, lembretes, próximos passos…"
        rows={4}
        className={cn(
          'flex w-full resize-y rounded-md border border-border bg-secondary px-3 py-2.5',
          'text-xs text-foreground placeholder:text-muted-foreground/50',
          'focus:outline-none focus:ring-2 focus:ring-ring/30 focus:border-primary/30 transition-all',
        )}
      />
    </Card>
  )
}
