'use client'

/**
 * Pequenos componentes auxiliares do ProposalEditor.
 *
 * - DetalheRow: linha label-valor da barra lateral "Detalhes".
 * - MissingSection: placeholder pontilhado quando um bloco opcional
 *   (Fases, Investimento, etc) ainda não foi adicionado.
 *
 * Extraídos do ProposalEditor.tsx na fase J (v0.10.97).
 */

import { Plus } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import type { ProposalBlockType } from '@/lib/proposal-types'

export function DetalheRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right text-foreground">{value}</span>
    </div>
  )
}

export function MissingSection({
  label,
  type,
  onAdd,
}: {
  label: string
  type: ProposalBlockType
  onAdd: (t: ProposalBlockType) => void
}) {
  return (
    <Card className="border-dashed p-5">
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">
          {label} não adicionado
        </span>
        <Button variant="ghost" size="sm" onClick={() => onAdd(type)}>
          <Plus className="mr-1 h-3.5 w-3.5" />
          Adicionar
        </Button>
      </div>
    </Card>
  )
}
