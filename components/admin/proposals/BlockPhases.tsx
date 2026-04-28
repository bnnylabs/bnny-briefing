'use client'

import { Plus, Trash2 } from 'lucide-react'
import { IconButton } from '@/components/ui/icon-button'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import type { BlockContentPhases, ProposalPhase } from '@/lib/proposal-types'

interface PhasesEditorProps {
  content: BlockContentPhases
  onChange: (content: BlockContentPhases) => void
}

/**
 * Phases block — numbered project phases with duration. Unifies what was
 * traditionally two sections (scope + timeline) into one source of truth.
 *
 * Matches the layout of the BNNY Horus orçamento PDF: each phase gets a
 * number ("1.0"), a title ("Briefing & Descoberta"), a duration label
 * ("3 a 4 dias úteis"), and a paragraph description.
 */
export function PhasesEditor({ content, onChange }: PhasesEditorProps) {
  const phases = content.phases ?? []

  const update = (i: number, patch: Partial<ProposalPhase>) => {
    const next = phases.map((p, idx) => (idx === i ? { ...p, ...patch } : p))
    onChange({ phases: next })
  }

  const remove = (i: number) => {
    onChange({ phases: phases.filter((_, idx) => idx !== i) })
  }

  const add = () => {
    // Default new phase number = next sequential "X.0"
    const nextNum = `${phases.length + 1}.0`
    onChange({
      phases: [
        ...phases,
        { number: nextNum, title: '', duration: '', description: '' },
      ],
    })
  }

  return (
    <div className="space-y-3">
      <label className="text-[10px] uppercase tracking-widest text-muted-foreground">
        Fases do projeto
      </label>

      {phases.length === 0 ? (
        <div className="rounded-md border border-dashed border-border bg-muted/20 px-4 py-6 text-center text-xs text-muted-foreground">
          Nenhuma fase adicionada
        </div>
      ) : (
        <div className="space-y-3">
          {phases.map((phase, i) => (
            <div
              key={i}
              className="space-y-2.5 rounded-md border border-border bg-card p-3"
            >
              <div className="flex items-start gap-2">
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
                  className="flex-1 font-semibold"
                />
                <IconButton
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => remove(i)}
                  icon={<Trash2 size={14} />}
                  label="Remover fase"
                  className="text-muted-foreground hover:text-destructive"
                />
              </div>
              <Input
                value={phase.duration}
                onChange={(e) => update(i, { duration: e.target.value })}
                placeholder="3 a 4 dias úteis"
                className="text-xs"
              />
              <textarea
                value={phase.description}
                onChange={(e) => update(i, { description: e.target.value })}
                placeholder="O que acontece nesta fase…"
                rows={2}
                className={cn(
                  'flex w-full resize-y rounded-md border border-border bg-secondary px-3 py-2',
                  'text-xs leading-relaxed text-foreground placeholder:text-muted-foreground/50',
                  'focus:outline-none focus:ring-2 focus:ring-ring/30 focus:border-primary/30',
                  'transition-all duration-150',
                )}
              />
            </div>
          ))}
        </div>
      )}

      <Button type="button" variant="outline" size="sm" onClick={add}>
        <Plus className="mr-1 h-3.5 w-3.5" />
        Adicionar fase
      </Button>
    </div>
  )
}

interface PhasesPreviewProps {
  content: BlockContentPhases
}

export function PhasesPreview({ content }: PhasesPreviewProps) {
  const phases = (content.phases ?? []).filter((p) => p.visible !== false)
  if (phases.length === 0) {
    return (
      <p className="text-sm italic text-muted-foreground/60">
        Adicione fases para vê-las aqui.
      </p>
    )
  }
  return (
    <div className="space-y-5">
      {phases.map((phase, i) => (
        <div key={i} className="space-y-1">
          <div className="font-mono text-xs tabular-nums text-muted-foreground">
            {phase.number || `${i + 1}.0`}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-base font-bold tracking-tight text-foreground">
              {phase.title || 'Sem título'}
            </h3>
            {phase.duration && (
              <span className="rounded bg-success/15 px-1.5 py-0.5 font-mono text-[10px] text-success">
                {phase.duration}
              </span>
            )}
          </div>
          {phase.description && (
            <p className="text-xs leading-relaxed text-muted-foreground">
              {phase.description}
            </p>
          )}
        </div>
      ))}
    </div>
  )
}
