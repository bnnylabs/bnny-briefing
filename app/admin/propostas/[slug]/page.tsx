import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

import { getProposalBySlug } from '@/lib/proposals'
import {
  formatProposalNumber,
  PROPOSAL_STATUS_LABELS_PT,
  proposalStatusVariant,
  type ProposalStatus,
} from '@/lib/proposal-types'
import { Badge } from '@/components/ui/badge'

/**
 * Proposal editor — Phase 1 placeholder.
 *
 * Phase 2 will replace this with the drag-and-drop block editor + live
 * preview. For now we just confirm the proposal exists and show its
 * top-level metadata so the create flow has somewhere to land.
 */

interface PageProps {
  params: Promise<{ slug: string }>
}

function fmtDate(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

function fmtCurrency(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency,
      minimumFractionDigits: 2,
    }).format(amount)
  } catch {
    return `R$ ${amount.toFixed(2)}`
  }
}

export default async function ProposalEditorPage({ params }: PageProps) {
  const { slug } = await params
  const proposal = await getProposalBySlug(slug)
  if (!proposal) notFound()

  const status = proposal.status as ProposalStatus

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-4xl p-6">
        {/* Back link */}
        <Link
          href="/admin/propostas"
          className="mb-5 inline-flex items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft size={13} />
          Voltar para propostas
        </Link>

        {/* Header */}
        <div className="mb-6 flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="mb-1 font-mono text-xs font-semibold tabular-nums text-muted-foreground">
              {formatProposalNumber(proposal.number, proposal.version_suffix)}
            </div>
            <h1 className="font-mono text-2xl font-bold tracking-tight">
              {proposal.title}
            </h1>
            <div className="mt-1 text-sm text-muted-foreground">
              {proposal.clients?.company ?? '—'}
            </div>
          </div>
          <Badge
            variant={proposalStatusVariant(status)}
            className="text-[11px] font-medium"
          >
            {PROPOSAL_STATUS_LABELS_PT[status]}
          </Badge>
        </div>

        {/* Metadata grid */}
        <div className="grid grid-cols-2 gap-4 rounded-lg border border-border bg-card p-5 sm:grid-cols-4">
          <div>
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
              Total
            </div>
            <div className="mt-1 font-mono text-base font-semibold tabular-nums">
              {fmtCurrency(proposal.total_amount, proposal.currency)}
            </div>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
              Validade
            </div>
            <div className="mt-1 text-sm font-medium">
              {fmtDate(proposal.valid_until)}
            </div>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
              Criada
            </div>
            <div className="mt-1 text-sm font-medium">
              {fmtDate(proposal.created_at)}
            </div>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
              Idioma
            </div>
            <div className="mt-1 text-sm font-medium">
              {proposal.language === 'pt-BR' ? 'Português' : 'English'}
            </div>
          </div>
        </div>

        {/* Phase 1 placeholder notice */}
        <div className="mt-8 rounded-lg border border-dashed border-border bg-muted/30 p-8 text-center">
          <div className="mb-1 text-sm font-semibold text-foreground">
            Editor em construção
          </div>
          <div className="text-xs text-muted-foreground">
            O editor de blocos drag-and-drop chega na Fase 2 da v0.10.
            <br />
            Por enquanto, a proposta existe como rascunho e está pronta para receber conteúdo.
          </div>
        </div>
      </div>
    </div>
  )
}
