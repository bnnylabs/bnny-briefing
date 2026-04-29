'use client'

/**
 * Phases card — coluna principal do ProposalEditor.
 *
 * Lista de fases do projeto com expand-on-click. Cada fase tem:
 *   - número (1.0, 2.0…) editável
 *   - título
 *   - duração (string livre: "3 a 4 dias úteis")
 *   - descrição com RewriteButton
 *   - checkbox de visibilidade (oculta no PDF/recipient sem deletar)
 *
 * O `headerExtra` slot é usado pra encaixar TranslationPill +
 * ReviewBlockButton da fase G+ no header do card, ao lado do botão
 * "+ Fase" — sem que o card precise saber de tradução/revisão.
 *
 * Extraído do ProposalEditor.tsx na fase J (v0.10.97). Comportamento
 * idêntico ao original.
 */

import type { ReactNode } from 'react'
import { useState } from 'react'
import { ChevronDown, ChevronUp, List, Plus, Trash2 } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { cn } from '@/lib/utils'
import { CardHeader } from './EditorPrimitives'
import { RewriteButton } from '../RewriteButton'
import type {
  ProposalBlock,
  ProposalBlockContent,
  ProposalPhase,
} from '@/lib/proposal-types'

export function PhasesCard({
  block,
  onChange,
  clientId,
  onRewriteError,
  headerExtra,
}: {
  block: ProposalBlock
  onChange: (c: ProposalBlockContent) => void
  clientId?: string | null
  onRewriteError?: (msg: string) => void
  headerExtra?: ReactNode
}) {
  const [expanded, setExpanded] = useState<number | null>(null)
  const content = block.content as { phases?: ProposalPhase[] }
  const phases: ProposalPhase[] = content.phases ?? []

  const update = (i: number, patch: Partial<ProposalPhase>) => {
    const next = phases.map((p, idx) => (idx === i ? { ...p, ...patch } : p))
    onChange({ phases: next })
  }

  const toggleVisible = (i: number) => {
    update(i, { visible: phases[i].visible === false ? true : false })
  }

  const remove = (i: number) => {
    onChange({ phases: phases.filter((_, idx) => idx !== i) })
    if (expanded === i) setExpanded(null)
  }

  const add = () => {
    const nextNum = `${phases.length + 1}.0`
    onChange({
      phases: [
        ...phases,
        { number: nextNum, title: '', duration: '', description: '', visible: true },
      ],
    })
    setExpanded(phases.length)
  }

  return (
    <Card className="p-5">
      <CardHeader
        icon={<List className="h-4 w-4" />}
        title="Fases do projeto"
        action={
          <div className="flex items-center gap-2">
            {headerExtra}
            <Button variant="ghost" size="sm" onClick={add}>
              <Plus className="mr-1 h-3.5 w-3.5" />Fase
            </Button>
          </div>
        }
      />

      {phases.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhuma fase adicionada.</p>
      ) : (
        <div className="space-y-1">
          {phases.map((phase, i) => {
            const isExpanded = expanded === i
            const isVisible = phase.visible !== false
            return (
              <div
                key={i}
                className={cn(
                  'rounded-lg border border-border transition-colors',
                  !isVisible && 'opacity-50',
                )}
              >
                {/* Compact row */}
                <div
                  className="flex cursor-pointer items-center gap-3 px-3 py-2.5 hover:bg-muted/30"
                  onClick={() => setExpanded(isExpanded ? null : i)}
                >
                  <Checkbox
                    checked={isVisible}
                    onCheckedChange={() => toggleVisible(i)}
                    onClick={(e) => e.stopPropagation()}
                    className="shrink-0 data-[state=checked]:bg-foreground data-[state=checked]:border-foreground data-[state=checked]:text-background"
                  />
                  <span className="font-mono text-xs tabular-nums text-muted-foreground">
                    {phase.number || `${i + 1}.0`}
                  </span>
                  <span className="flex-1 truncate text-sm font-medium text-foreground">
                    {phase.title || 'Sem título'}
                  </span>
                  {phase.duration && (
                    <span className="hidden shrink-0 rounded bg-success/15 px-1.5 py-0.5 font-mono text-[10px] text-success sm:block">
                      {phase.duration}
                    </span>
                  )}
                  <span className="text-muted-foreground/50">
                    {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                  </span>
                </div>

                {/* Expanded editing */}
                {isExpanded && (
                  <div className="space-y-2.5 border-t border-border bg-muted/20 px-3 py-3">
                    <div className="flex gap-2">
                      <Input
                        value={phase.number}
                        onChange={(e) => update(i, { number: e.target.value })}
                        placeholder="1.0"
                        className="w-16 font-mono text-xs tabular-nums"
                      />
                      <Input
                        value={phase.title}
                        onChange={(e) => update(i, { title: e.target.value })}
                        placeholder="Título da fase"
                        className="flex-1"
                      />
                    </div>
                    <Input
                      value={phase.duration}
                      onChange={(e) => update(i, { duration: e.target.value })}
                      placeholder="3 a 4 dias úteis"
                      className="text-sm"
                    />
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] uppercase tracking-widest text-muted-foreground">
                        Descrição
                      </span>
                      <RewriteButton
                        value={phase.description}
                        kind="phase_description"
                        clientId={clientId}
                        onRewritten={(text) => update(i, { description: text })}
                        onError={onRewriteError}
                        extraContext={`Esta é a fase "${phase.title || phase.number}", com duração de ${phase.duration || 'não especificada'}.`}
                      />
                    </div>
                    <textarea
                      value={phase.description}
                      onChange={(e) => update(i, { description: e.target.value })}
                      placeholder="O que acontece nesta fase…"
                      rows={2}
                      className={cn(
                        'flex w-full resize-y rounded-md border border-border bg-secondary px-3 py-2',
                        'text-xs leading-relaxed text-foreground placeholder:text-muted-foreground/50',
                        'focus:outline-none focus:ring-2 focus:ring-ring/30 transition-all',
                      )}
                    />
                    <div className="flex justify-end">
                      <button
                        onClick={() => remove(i)}
                        className="text-[11px] text-muted-foreground/50 hover:text-destructive transition-colors"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </Card>
  )
}
