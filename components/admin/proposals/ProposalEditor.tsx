'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import {
  ArrowLeft, Check, AlertCircle, Loader2, Eye, Plus, Trash2,
} from 'lucide-react'

import { Badge }    from '@/components/ui/badge'
import { Button }   from '@/components/ui/button'
import { Input }    from '@/components/ui/input'
import {
  Dialog, DialogContent, DialogDescription,
  DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { useToast, ToastContainer } from '@/components/toast'
import { cn } from '@/lib/utils'
import { DatePicker, parseIsoDate, toIsoDate } from '@/components/ui/date-picker'

import {
  formatProposalNumber,
  PROPOSAL_STATUS_LABELS_PT,
  proposalStatusVariant,
  type ProposalBlock,
  type ProposalBlockContent,
  type ProposalBlockType,
  type ProposalStatus,
  type ProposalWithClient,
} from '@/lib/proposal-types'

import { formatSavedAgo, useAutoSave, type AutoSaveStatus } from './useAutoSave'
import { HeaderEditor } from './BlockHeader'
import { PhasesEditor } from './BlockPhases'
import { InvestmentEditor } from './BlockInvestment'
import { BlockReadOnly } from './BlockReadOnly'
import type { BlockContentInvestment } from '@/lib/proposal-types'

// ─── Types ────────────────────────────────────────────────────────────────

type EditorMode = 'form' | 'document'

// ─── Section label ────────────────────────────────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/70">
        {children}
      </span>
      <div className="flex-1 border-t border-border" />
    </div>
  )
}

// ─── Save indicator ───────────────────────────────────────────────────────

function SaveIndicator({ status, lastSavedAt }: { status: AutoSaveStatus; lastSavedAt: number | null }) {
  const [, force] = useState(0)
  useEffect(() => {
    if (status !== 'idle') return
    const t = setInterval(() => force((n) => n + 1), 5000)
    return () => clearInterval(t)
  }, [status])

  if (status === 'saving') return (
    <span className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground">
      <Loader2 className="h-3 w-3 animate-spin" />Salvando…
    </span>
  )
  if (status === 'saved') return (
    <span className="inline-flex items-center gap-1.5 text-[11px] text-success">
      <Check className="h-3 w-3" />Salvo
    </span>
  )
  if (status === 'error') return (
    <span className="inline-flex items-center gap-1.5 text-[11px] text-destructive">
      <AlertCircle className="h-3 w-3" />Erro ao salvar
    </span>
  )
  if (lastSavedAt) return (
    <span className="text-[11px] text-muted-foreground/70">{formatSavedAgo(lastSavedAt)}</span>
  )
  return null
}

// ─── Block section titles ─────────────────────────────────────────────────

const SECTION_LABEL: Partial<Record<ProposalBlockType, string>> = {
  header:     'Texto de abertura',
  phases:     'Fases do projeto',
  investment: 'Investimento',
  terms:      'Termos e condições',
  next_steps: 'Próximos passos',
  attachments:'Anexos',
  custom:     'Seção personalizada',
}

// ─── Main component ───────────────────────────────────────────────────────

interface ProposalEditorProps {
  initialProposal: ProposalWithClient
  initialBlocks: ProposalBlock[]
}

export function ProposalEditor({ initialProposal, initialBlocks }: ProposalEditorProps) {
  const { toasts, toast, remove } = useToast()

  const [mode, setMode]       = useState<EditorMode>('form')
  const [proposal, setProposal] = useState<ProposalWithClient>(initialProposal)
  const [blocks, setBlocks]   = useState<ProposalBlock[]>(initialBlocks)
  const [deleteTarget, setDeleteTarget] = useState<ProposalBlock | null>(null)

  const slug = proposal.slug
  const proposalDirtyRef = useRef(false)
  const blockDirtyIdsRef = useRef<Set<string>>(new Set())

  // ── Auto-save: proposal meta ─────────────────────────────────────────

  const saveProposalMeta = useCallback(async () => {
    if (!proposalDirtyRef.current) return
    const res = await fetch(`/api/proposals/${slug}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title:         proposal.title,
        valid_until:   proposal.valid_until,
        total_amount:  proposal.total_amount,
        payment_terms: proposal.payment_terms,
      }),
    })
    if (!res.ok) throw new Error('save failed')
    proposalDirtyRef.current = false
  }, [slug, proposal.title, proposal.valid_until, proposal.total_amount, proposal.payment_terms])

  const proposalSave = useAutoSave(saveProposalMeta)

  // ── Auto-save: blocks ────────────────────────────────────────────────

  const saveBlocks = useCallback(async () => {
    if (blockDirtyIdsRef.current.size === 0) return
    const ids = Array.from(blockDirtyIdsRef.current)
    blockDirtyIdsRef.current.clear()
    const snapshot = blocks
    const errors: string[] = []
    await Promise.all(ids.map(async (id) => {
      const b = snapshot.find((x) => x.id === id)
      if (!b) return
      try {
        const res = await fetch(`/api/proposals/${slug}/blocks/${id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content: b.content, visible: b.visible }),
        })
        if (!res.ok) errors.push(id)
      } catch { errors.push(id) }
    }))
    if (errors.length > 0) {
      errors.forEach((id) => blockDirtyIdsRef.current.add(id))
      throw new Error('save failed')
    }
  }, [slug, blocks])

  const blocksSave = useAutoSave(saveBlocks)

  const combinedStatus: AutoSaveStatus = useMemo(() => {
    const order: AutoSaveStatus[] = ['error', 'saving', 'saved', 'idle']
    for (const s of order) {
      if (proposalSave.status === s || blocksSave.status === s) return s
    }
    return 'idle'
  }, [proposalSave.status, blocksSave.status])

  const combinedSavedAt = useMemo(() => {
    const max = Math.max(proposalSave.lastSavedAt ?? 0, blocksSave.lastSavedAt ?? 0)
    return max === 0 ? null : max
  }, [proposalSave.lastSavedAt, blocksSave.lastSavedAt])

  // ── Mutators ─────────────────────────────────────────────────────────

  const patchProposal = (patch: Partial<ProposalWithClient>) => {
    setProposal((p) => ({ ...p, ...patch }))
    proposalDirtyRef.current = true
    proposalSave.schedule()
  }

  const patchBlockContent = (id: string, content: ProposalBlockContent) => {
    setBlocks((arr) => arr.map((b) => (b.id === id ? { ...b, content } : b)))
    blockDirtyIdsRef.current.add(id)
    blocksSave.schedule()

    // Investment block syncs total_amount + payment_terms to proposal level.
    const block = blocks.find((b) => b.id === id)
    if (block?.type === 'investment') {
      const inv = content as BlockContentInvestment
      setProposal((p) => ({
        ...p,
        total_amount:  inv.total_amount  ?? p.total_amount,
        payment_terms: inv.payment_terms ?? p.payment_terms,
      }))
      proposalDirtyRef.current = true
      proposalSave.schedule()
    }
  }

  const confirmDeleteBlock = async () => {
    if (!deleteTarget) return
    const id = deleteTarget.id
    setDeleteTarget(null)
    const res = await fetch(`/api/proposals/${slug}/blocks/${id}`, { method: 'DELETE' })
    if (!res.ok) { toast('Erro ao excluir', 'error'); return }
    setBlocks((arr) => arr.filter((b) => b.id !== id))
    blockDirtyIdsRef.current.delete(id)
  }

  const addStandardBlock = async (type: ProposalBlockType) => {
    let initialContent: ProposalBlockContent | undefined
    if (type === 'investment') {
      initialContent = {
        intro: '', total_amount: proposal.total_amount,
        currency: proposal.currency, payment_terms: proposal.payment_terms,
      } as BlockContentInvestment
    }
    const res = await fetch(`/api/proposals/${slug}/blocks`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type, content: initialContent }),
    })
    if (!res.ok) { toast('Erro ao adicionar seção', 'error'); return }
    const data = await res.json()
    setBlocks((arr) => [...arr, data.block as ProposalBlock])
  }

  const enterDocument = () => {
    proposalSave.flush()
    blocksSave.flush()
    setMode('document')
  }

  const exitDocument = () => setMode('form')

  const status = proposal.status as ProposalStatus

  return (
    <div className="min-h-screen bg-background">
      <ToastContainer toasts={toasts} remove={remove} />

      {mode === 'form' ? (
        <FormView
          proposal={proposal}
          blocks={blocks}
          status={status}
          saveStatus={combinedStatus}
          savedAt={combinedSavedAt}
          onPatchProposal={patchProposal}
          onPatchBlockContent={patchBlockContent}
          onDeleteBlock={(b) => setDeleteTarget(b)}
          onAddBlock={addStandardBlock}
          onVisualize={enterDocument}
        />
      ) : (
        <DocumentView
          proposal={proposal}
          blocks={blocks}
          status={status}
          onEdit={exitDocument}
        />
      )}

      <Dialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Remover seção?</DialogTitle>
            <DialogDescription>
              Esta ação não pode ser desfeita.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="p-6 pt-0">
            <Button type="button" variant="ghost" onClick={() => setDeleteTarget(null)}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={confirmDeleteBlock}>Remover</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ─── Form view (default) ──────────────────────────────────────────────────

const STANDARD_BLOCKS: Array<{ type: ProposalBlockType; label: string }> = [
  { type: 'header',     label: 'Texto de abertura' },
  { type: 'phases',     label: 'Fases' },
  { type: 'investment', label: 'Investimento' },
]

interface FormViewProps {
  proposal: ProposalWithClient
  blocks: ProposalBlock[]
  status: ProposalStatus
  saveStatus: AutoSaveStatus
  savedAt: number | null
  onPatchProposal: (p: Partial<ProposalWithClient>) => void
  onPatchBlockContent: (id: string, c: ProposalBlockContent) => void
  onDeleteBlock: (b: ProposalBlock) => void
  onAddBlock: (t: ProposalBlockType) => void
  onVisualize: () => void
}

function FormView({
  proposal, blocks, status, saveStatus, savedAt,
  onPatchProposal, onPatchBlockContent, onDeleteBlock, onAddBlock, onVisualize,
}: FormViewProps) {
  const sortedBlocks = [...blocks].sort((a, b) => a.position - b.position)

  // Missing standard blocks the user can add
  const presentTypes = new Set(blocks.map((b) => b.type))
  const missingBlocks = STANDARD_BLOCKS.filter((b) => !presentTypes.has(b.type))

  return (
    <div className="mx-auto max-w-2xl px-6 py-8 space-y-8">
      {/* Top bar */}
      <div className="flex items-center justify-between">
        <Link
          href="/admin/propostas"
          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft size={13} />Propostas
        </Link>
        <div className="flex items-center gap-3">
          <SaveIndicator status={saveStatus} lastSavedAt={savedAt} />
          <Button size="sm" onClick={onVisualize}>
            <Eye className="mr-1.5 h-3.5 w-3.5" />Visualizar
          </Button>
        </div>
      </div>

      {/* Proposal identity */}
      <div className="space-y-1.5">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-xs font-semibold tabular-nums text-muted-foreground">
            {formatProposalNumber(proposal.number, proposal.version_suffix)}
          </span>
          <Badge variant={proposalStatusVariant(status)} className="text-[11px]">
            {PROPOSAL_STATUS_LABELS_PT[status]}
          </Badge>
          {proposal.clients?.company && (
            <span className="text-xs text-muted-foreground">· {proposal.clients.company}</span>
          )}
        </div>

        <Input
          value={proposal.title}
          onChange={(e) => onPatchProposal({ title: e.target.value })}
          placeholder="Título da proposta"
          className="h-auto border-0 bg-transparent px-0 font-mono text-xl font-bold tracking-tight shadow-none focus:ring-0 focus-visible:ring-0"
        />

        <div className="flex items-center gap-2 pt-1">
          <span className="text-[10px] uppercase tracking-widest text-muted-foreground">Validade</span>
          <div className="w-48">
            <DatePicker
              value={parseIsoDate(proposal.valid_until)}
              onChange={(d) => onPatchProposal({ valid_until: toIsoDate(d) })}
              placeholder="Sem validade"
              disablePast
            />
          </div>
        </div>
      </div>

      {/* Block sections — rendered as clean form areas, no block chrome */}
      {sortedBlocks.length === 0 && missingBlocks.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border bg-muted/20 px-6 py-10 text-center">
          <p className="text-sm font-medium text-foreground">Proposta em branco</p>
          <p className="mt-1 text-xs text-muted-foreground">Adicione as seções abaixo para montar o documento.</p>
        </div>
      ) : (
        sortedBlocks.map((block) => (
          <BlockFormSection
            key={block.id}
            block={block}
            onContentChange={(c) => onPatchBlockContent(block.id, c)}
            onDelete={() => onDeleteBlock(block)}
          />
        ))
      )}

      {/* Add missing standard sections */}
      {missingBlocks.length > 0 && (
        <div className="space-y-2">
          <SectionLabel>Adicionar seção</SectionLabel>
          <div className="flex flex-wrap gap-2">
            {missingBlocks.map((b) => (
              <Button
                key={b.type}
                variant="outline"
                size="sm"
                onClick={() => onAddBlock(b.type)}
              >
                <Plus className="mr-1 h-3.5 w-3.5" />{b.label}
              </Button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Block form section ───────────────────────────────────────────────────

function BlockFormSection({
  block, onContentChange, onDelete,
}: {
  block: ProposalBlock
  onContentChange: (c: ProposalBlockContent) => void
  onDelete: () => void
}) {
  const label = SECTION_LABEL[block.type]

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/70">
          {label ?? block.type}
        </span>
        <div className="flex-1 border-t border-border" />
        <button
          onClick={onDelete}
          className="text-[11px] text-muted-foreground/50 transition-colors hover:text-destructive"
          aria-label="Remover seção"
        >
          <Trash2 size={13} />
        </button>
      </div>

      <BlockFormContent block={block} onContentChange={onContentChange} />
    </div>
  )
}

function BlockFormContent({
  block, onContentChange,
}: {
  block: ProposalBlock
  onContentChange: (c: ProposalBlockContent) => void
}) {
  switch (block.type) {
    case 'header':
      return (
        <HeaderEditor
          content={block.content as { body: string }}
          onChange={onContentChange}
        />
      )
    case 'phases':
      return (
        <PhasesEditor
          content={block.content as { phases: never[] }}
          onChange={onContentChange}
        />
      )
    case 'investment':
      return (
        <InvestmentEditor
          content={block.content as BlockContentInvestment}
          onChange={onContentChange}
        />
      )
    default:
      return (
        <div className="rounded-md border border-dashed border-border bg-muted/20 px-4 py-4 text-center text-xs text-muted-foreground">
          Editor para este tipo de seção chega em breve.
        </div>
      )
  }
}

// ─── Document view (visualizar) ───────────────────────────────────────────

function fmtCurrency(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency', currency, minimumFractionDigits: 2,
    }).format(amount)
  } catch { return `R$ ${amount.toFixed(2)}` }
}

function fmtDate(iso: string | null): string {
  if (!iso) return '—'
  return new Date(`${iso}T00:00:00`).toLocaleDateString('pt-BR', {
    day: '2-digit', month: 'short', year: 'numeric',
  })
}

function DocumentView({
  proposal, blocks, status, onEdit,
}: {
  proposal: ProposalWithClient
  blocks: ProposalBlock[]
  status: ProposalStatus
  onEdit: () => void
}) {
  const visible = [...blocks]
    .filter((b) => b.visible)
    .sort((a, b) => a.position - b.position)

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
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-xs font-semibold tabular-nums text-muted-foreground">
                {formatProposalNumber(proposal.number, proposal.version_suffix)}
              </span>
              <Badge variant={proposalStatusVariant(status)} className="text-[11px]">
                {PROPOSAL_STATUS_LABELS_PT[status]}
              </Badge>
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-2xl px-6 pb-16">
        <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
          {/* Document header */}
          <div className="border-b border-border px-8 py-7">
            {proposal.clients?.company && (
              <div className="mb-2 text-xs text-muted-foreground">{proposal.clients.company}</div>
            )}
            <h1 className="font-mono text-2xl font-bold tracking-tight text-foreground">
              {proposal.title || 'Sem título'}
            </h1>
            <div className="mt-4 flex flex-wrap gap-x-5 gap-y-1.5 text-sm">
              <div>
                <span className="text-[10px] uppercase tracking-widest text-muted-foreground">Total </span>
                <span className="font-mono font-semibold tabular-nums">
                  {fmtCurrency(proposal.total_amount, proposal.currency)}
                </span>
              </div>
              {proposal.valid_until && (
                <div>
                  <span className="text-[10px] uppercase tracking-widest text-muted-foreground">Válida até </span>
                  <span className="font-medium">{fmtDate(proposal.valid_until)}</span>
                </div>
              )}
            </div>
          </div>

          {/* Blocks */}
          {visible.length === 0 ? (
            <div className="px-8 py-12 text-center">
              <p className="mb-1 text-sm font-medium text-foreground">Nenhum conteúdo ainda</p>
              <p className="text-xs text-muted-foreground">
                <button onClick={onEdit} className="text-primary hover:underline">Editar a proposta</button>
                {' '}para adicionar seções.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {visible.map((block) => (
                <div key={block.id} className="px-8 py-7">
                  <BlockReadOnly block={block} />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
