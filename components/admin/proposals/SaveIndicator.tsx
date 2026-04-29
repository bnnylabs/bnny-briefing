'use client'

/**
 * Indicador de status do auto-save no header do ProposalEditor.
 *
 * Mostra um de quatro estados:
 *   - saving: spinner + "Salvando…"
 *   - saved:  check verde + "Salvo"
 *   - error:  alerta vermelho + "Erro ao salvar"
 *   - idle:   "há X segundos" (live, atualiza a cada 5s)
 *
 * O re-render periódico no estado idle é necessário porque
 * `formatSavedAgo()` é uma função pura que precisa ser re-executada pra
 * o "agora" mudar — sem o setInterval, o texto "há 3 segundos" ficaria
 * congelado até o próximo evento React.
 *
 * Extraído do ProposalEditor.tsx na fase J (v0.10.97).
 */

import { useEffect, useState } from 'react'
import { AlertCircle, Check, Loader2 } from 'lucide-react'
import { formatSavedAgo, type AutoSaveStatus } from './useAutoSave'

export function SaveIndicator({
  status,
  lastSavedAt,
}: {
  status: AutoSaveStatus
  lastSavedAt: number | null
}) {
  const [, force] = useState(0)
  useEffect(() => {
    if (status !== 'idle') return
    const t = setInterval(() => force((n) => n + 1), 5000)
    return () => clearInterval(t)
  }, [status])

  if (status === 'saving')
    return (
      <span className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground">
        <Loader2 className="h-3 w-3 animate-spin" />
        Salvando…
      </span>
    )
  if (status === 'saved')
    return (
      <span className="inline-flex items-center gap-1.5 text-[11px] text-success">
        <Check className="h-3 w-3" />
        Salvo
      </span>
    )
  if (status === 'error')
    return (
      <span className="inline-flex items-center gap-1.5 text-[11px] text-destructive">
        <AlertCircle className="h-3 w-3" />
        Erro ao salvar
      </span>
    )
  if (lastSavedAt)
    return (
      <span className="text-[11px] text-muted-foreground/70">
        {formatSavedAgo(lastSavedAt)}
      </span>
    )
  return null
}
