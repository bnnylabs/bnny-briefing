'use client'

/**
 * IA card — collapsible card que dispara a regeneração da proposta com IA.
 *
 * Usa dados cadastrais do cliente automaticamente (site, redes, perfil de
 * IA salvo no `clients.ai_profile`). O operador pode adicionar:
 *   - Contexto extra (notas de reunião, transcrição, detalhes)
 *   - Override do destinatário ("Para quem é a abertura?") — útil quando
 *     a proposta vai pra alguém que não é o contato principal cadastrado;
 *     sem persistência, afeta só esta geração.
 *
 * Auto-collapsa após sucesso — operador raramente precisa do card aberto
 * depois que a IA fez seu trabalho.
 *
 * Extraído do ProposalEditor.tsx na fase J (v0.10.97).
 */

import { useState } from 'react'
import { ChevronDown, ChevronUp, Loader2, Sparkles } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { ProposalWithClient } from '@/lib/proposal-types'

export function IACard({
  proposal,
  onPersonalize,
}: {
  proposal: ProposalWithClient
  onPersonalize: (args: {
    context: string
    addresseeName: string
  }) => Promise<void>
}) {
  const [context, setContext] = useState('')
  const [addresseeName, setAddresseeName] = useState('')
  const [loading, setLoading] = useState(false)
  const [expanded, setExpanded] = useState(false)

  // Always allow regen when there's a client (auto-context from cadastrado data)
  // — context typed by owner is just a bonus.
  const canSubmit = !loading && !!proposal.client_id

  const handleSubmit = async () => {
    if (!canSubmit) return
    setLoading(true)
    try {
      await onPersonalize({ context, addresseeName })
      setContext('')
      setAddresseeName('')
      // Auto-collapse after success — owner doesn't need to keep the card
      // open after the AI did its job.
      setExpanded(false)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card className="p-5">
      {/* Clickable header — toggles the card open/closed */}
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className={cn(
          'flex w-full items-center justify-between gap-3 text-left',
          expanded ? 'mb-4' : 'mb-0',
        )}
      >
        <div className="flex items-center gap-1.5 text-[15px] font-bold tracking-tight">
          <Sparkles className="h-4 w-4 text-muted-foreground" />
          Personalizar com IA
        </div>
        <div className="flex items-center gap-2">
          {!expanded && (
            <span className="hidden text-[11px] text-muted-foreground sm:inline">
              Reescrever abertura e fases
            </span>
          )}
          {expanded ? (
            <ChevronUp className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          )}
        </div>
      </button>

      {expanded && (
        <div className="space-y-3">
          <p className="text-xs leading-relaxed text-muted-foreground">
            A IA usa os dados do cliente automaticamente (site, redes, perfil
            de IA salvo). Adicione contexto extra abaixo se quiser — notas da
            reunião, transcrição, detalhes específicos.
          </p>

          {/* Para quem é a abertura — override do contato primário pra
              casos onde a proposta vai pra alguém específico que não é
              (ou não deveria ser) o contato principal cadastrado. Sem
              persistência; só afeta esta geração. */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Para quem é a abertura? (opcional)
            </label>
            <input
              type="text"
              value={addresseeName}
              onChange={(e) => setAddresseeName(e.target.value)}
              placeholder="Ex: Gabriel — usa o contato principal se vazio"
              className={cn(
                'flex w-full rounded-md border border-border bg-secondary px-3 py-2',
                'text-sm text-foreground placeholder:text-muted-foreground/50',
                'focus:outline-none focus:ring-2 focus:ring-ring/30 transition-all',
              )}
            />
          </div>

          <textarea
            value={context}
            onChange={(e) => setContext(e.target.value)}
            placeholder="Notas, transcrição, contexto adicional (opcional)…"
            rows={3}
            className={cn(
              'flex w-full resize-y rounded-md border border-border bg-secondary px-3 py-2.5',
              'text-sm text-foreground placeholder:text-muted-foreground/50',
              'focus:outline-none focus:ring-2 focus:ring-ring/30 transition-all',
            )}
          />

          <div className="flex justify-end">
            <Button onClick={handleSubmit} disabled={!canSubmit}>
              {loading ? (
                <>
                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                  Personalizando…
                </>
              ) : (
                <>
                  <Sparkles className="mr-1.5 h-3.5 w-3.5" />
                  Personalizar
                </>
              )}
            </Button>
          </div>

          {!proposal.template_id && (
            <p className="text-[11px] text-warning">
              Esta proposta não tem modelo. A IA vai gerar do zero a partir
              do contexto e dos dados do cliente.
            </p>
          )}
        </div>
      )}
    </Card>
  )
}
