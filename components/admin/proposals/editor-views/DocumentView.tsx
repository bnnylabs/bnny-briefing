import { ArrowLeft } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import {
  formatProposalNumber,
  PROPOSAL_STATUS_LABELS_PT,
  proposalStatusVariant,
  type ProposalBlock,
  type ProposalStatus,
  type ProposalWithClient,
} from '@/lib/proposal-types'
import { fmtCurrency, fmtDate } from '@/lib/proposal-editor-utils'
import { BlockReadOnly } from '../BlockReadOnly'

/**
 * Read-only "document" preview of a proposal — what the operator sees
 * when they flip the editor's mode toggle from "Ficha" to "Documento".
 *
 * Mirrors the recipient public view (`/p/[slug]`) closely so the
 * operator can sanity-check rendering before sending. Differences from
 * the public page:
 *   - Has an "Editar" back-button to return to the editor.
 *   - Includes the proposal number + status badge in the top bar
 *     (the public page hides those — they're internal metadata).
 *   - Uses `BlockReadOnly` directly instead of going through the
 *     translation-aware wrapper, since the editor preview is always
 *     in the source language.
 *
 * Empty state: when there are no visible blocks, the body shows a
 * single inline "Editar" link to add content. This mirrors what the
 * recipient would see (an empty card) so the operator notices they
 * haven't published anything yet.
 */
export function DocumentView({
  proposal,
  blocks,
  status,
  onEdit,
}: {
  proposal: ProposalWithClient
  blocks: ProposalBlock[]
  status: ProposalStatus
  onEdit: () => void
}) {
  const visible = blocks.filter((b) => b.visible)

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-2xl px-6 pt-6">
        <div className="mb-6 flex items-center justify-between">
          <button
            onClick={onEdit}
            className="inline-flex items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft size={13} />Editar
          </button>
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs font-semibold tabular-nums text-muted-foreground">
              {formatProposalNumber(proposal.number, proposal.version_suffix)}
            </span>
            <Badge variant={proposalStatusVariant(status)} className="text-[11px]">
              {PROPOSAL_STATUS_LABELS_PT[status]}
            </Badge>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-2xl px-6 pb-16">
        <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
          <div className="border-b border-border px-8 py-7">
            {proposal.clients?.company && (
              <div className="mb-2 text-xs text-muted-foreground">{proposal.clients.company}</div>
            )}
            <h1 className="font-mono text-2xl font-bold tracking-tight">{proposal.title || 'Sem título'}</h1>
            <div className="mt-4 flex flex-wrap gap-x-5 gap-y-1.5 text-sm">
              {proposal.total_amount > 0 && (
                <div>
                  <span className="text-[10px] uppercase tracking-widest text-muted-foreground">Total </span>
                  <span className="font-mono font-semibold tabular-nums">{fmtCurrency(proposal.total_amount, proposal.currency)}</span>
                </div>
              )}
              {proposal.valid_until && (
                <div>
                  <span className="text-[10px] uppercase tracking-widest text-muted-foreground">Válida até </span>
                  <span className="font-medium">{fmtDate(proposal.valid_until)}</span>
                </div>
              )}
            </div>
          </div>
          {visible.length === 0 ? (
            <div className="px-8 py-12 text-center">
              <p className="text-sm text-muted-foreground">
                <button onClick={onEdit} className="text-primary hover:underline">Editar</button> para adicionar conteúdo.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {visible.map((b) => (
                <div key={b.id} className="px-8 py-7"><BlockReadOnly block={b} /></div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
