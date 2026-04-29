'use client'

/**
 * Primitivos visuais compartilhados pelos cards do ProposalEditor.
 *
 * - CardHeader: cabeçalho com ícone, título bold e action slot à direita.
 *   Padrão visual replicado do detalhe de cliente (consistência de UI).
 * - FieldLabel: rótulo pequeno em caixa-alta usado em cima de cada campo
 *   editável dentro dos cards.
 *
 * Extraídos do ProposalEditor.tsx na fase J (v0.10.97). PhasesCard,
 * InvestimentoCard e os cards principais consomem ambos.
 */

import type { ReactNode } from 'react'

export function CardHeader({
  icon,
  title,
  action,
}: {
  icon: ReactNode
  title: string
  action?: ReactNode
}) {
  return (
    <div className="mb-4 flex items-center justify-between gap-3">
      <div className="flex items-center gap-1.5 text-[15px] font-bold tracking-tight">
        <span className="text-muted-foreground">{icon}</span>
        {title}
      </div>
      {action}
    </div>
  )
}

export function FieldLabel({ children }: { children: ReactNode }) {
  return (
    <div className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
      {children}
    </div>
  )
}
