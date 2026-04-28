'use client'

import { useCallback, useMemo, useRef, useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft, Check, AlertCircle, Loader2, Eye, Plus, Trash2,
  ChevronDown, ChevronUp, FileText, DollarSign, List, AlignLeft,
} from 'lucide-react'

import { Badge }    from '@/components/ui/badge'
import { Button }   from '@/components/ui/button'
import { Input }    from '@/components/ui/input'
import { Card }     from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
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
  type PaymentTerm,
  type ProposalBlock,
  type ProposalBlockContent,
  type ProposalBlockType,
  type ProposalPhase,
  type ProposalStatus,
  type ProposalWithClient,
} from '@/lib/proposal-types'

import { formatSavedAgo, useAutoSave, type AutoSaveStatus } from './useAutoSave'
import { BlockReadOnly } from './BlockReadOnly'
import type { BlockContentInvestment } from '@/lib/proposal-types'

// ─── Helpers ──────────────────────────────────────────────────────────────

function fmtCurrency(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency, minimumFractionDigits: 2 }).format(amount)
  } catch { return `R$ ${amount.toFixed(2)}` }
}

function fmtDate(iso: string | null): string {
  if (!iso) return '—'
  return new Date(`${iso}T00:00:00`).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })
}

// ─── Save indicator ───────────────────────────────────────────────────────

function SaveIndicator({ status, lastSavedAt }: { status: AutoSaveStatus; lastSavedAt: number | null }) {
  const [, force] = useState(0)
  useEffect(() => {
    if (status !== 'idle') return
    const t = setInterval(() => force((n) => n + 1), 5000)
    return () => clearInterval(t)
  }, [status])

  if (status === 'saving') return <span className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground"><Loader2 className="h-3 w-3 animate-spin" />Salvando…</span>
  if (status === 'saved')  return <span className="inline-flex items-center gap-1.5 text-[11px] text-success"><Check className="h-3 w-3" />Salvo</span>
  if (status === 'error')  return <span className="inline-flex items-center gap-1.5 text-[11px] text-destructive"><AlertCircle className="h-3 w-3" />Erro ao salvar</span>
  if (lastSavedAt) return <span className="text-[11px] text-muted-foreground/70">{formatSavedAgo(lastSavedAt)}</span>
  return null
}

// ─── Card section header (matches client detail pattern) ──────────────────

function CardHeader({
  icon, title, action,
}: { icon: React.ReactNode; title: string; action?: React.ReactNode }) {
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

// ─── Field label ──────────────────────────────────────────────────────────

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
      {children}
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────

interface ProposalEditorProps {
  initialProposal: ProposalWithClient
  initialBlocks: ProposalBlock[]
}

export function ProposalEditor({ initialProposal, initialBlocks }: ProposalEditorProps) {
  const { toasts, toast, remove } = useToast()
  const router = useRouter()

  const [mode, setMode]           = useState<'ficha' | 'document'>('ficha')
  const [proposal, setProposal]   = useState<ProposalWithClient>(initialProposal)
  const [blocks, setBlocks]       = useState<ProposalBlock[]>(initialBlocks)
  const [deleteTarget, setDeleteTarget] = useState<ProposalBlock | null>(null)

  const slug = proposal.slug
  const proposalDirtyRef = useRef(false)
  const blockDirtyIdsRef = useRef<Set<string>>(new Set())

  // ── Auto-save ─────────────────────────────────────────────────────────

  const saveProposalMeta = useCallback(async () => {
    if (!proposalDirtyRef.current) return
    const res = await fetch(`/api/proposals/${slug}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: proposal.title,
        valid_until: proposal.valid_until,
        total_amount: proposal.total_amount,
        payment_terms: proposal.payment_terms,
      }),
    })
    if (!res.ok) throw new Error('save failed')
    proposalDirtyRef.current = false
  }, [slug, proposal.title, proposal.valid_until, proposal.total_amount, proposal.payment_terms])

  const proposalSave = useAutoSave(saveProposalMeta)

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
    for (const s of order) if (proposalSave.status === s || blocksSave.status === s) return s
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

  const patchBlock = (id: string, content: ProposalBlockContent) => {
    setBlocks((arr) => arr.map((b) => (b.id === id ? { ...b, content } : b)))
    blockDirtyIdsRef.current.add(id)
    blocksSave.schedule()

    const block = blocks.find((b) => b.id === id)
    if (block?.type === 'investment') {
      const inv = content as BlockContentInvestment
      setProposal((p) => ({
        ...p,
        total_amount: inv.total_amount ?? p.total_amount,
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
    if (!res.ok) { toast('Erro ao remover', 'error'); return }
    setBlocks((arr) => arr.filter((b) => b.id !== id))
    blockDirtyIdsRef.current.delete(id)
  }

  const addBlock = async (type: ProposalBlockType) => {
    let content: ProposalBlockContent | undefined
    if (type === 'investment') {
      content = { intro: '', total_amount: proposal.total_amount, currency: proposal.currency, payment_terms: proposal.payment_terms } as BlockContentInvestment
    }
    const res = await fetch(`/api/proposals/${slug}/blocks`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type, content }),
    })
    if (!res.ok) { toast('Erro ao adicionar seção', 'error'); return }
    const data = await res.json()
    setBlocks((arr) => [...arr, data.block as ProposalBlock])
  }

  const status = proposal.status as ProposalStatus
  const sorted = [...blocks].sort((a, b) => a.position - b.position)

  const headerBlock     = sorted.find((b) => b.type === 'header')
  const phasesBlock     = sorted.find((b) => b.type === 'phases')
  const investmentBlock = sorted.find((b) => b.type === 'investment')

  // ── Render ────────────────────────────────────────────────────────────

  if (mode === 'document') {
    return (
      <DocumentView
        proposal={proposal}
        blocks={sorted}
        status={status}
        onEdit={() => setMode('ficha')}
      />
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <ToastContainer toasts={toasts} remove={remove} />

      <div className="mx-auto max-w-5xl p-6">
        {/* Page header */}
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push('/admin/propostas')}
              className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
            <div>
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
              <SaveIndicator status={combinedStatus} lastSavedAt={combinedSavedAt} />
            </div>
          </div>
          <Button onClick={() => { proposalSave.flush(); blocksSave.flush(); setMode('document') }}>
            <Eye className="mr-1.5 h-4 w-4" />Visualizar proposta
          </Button>
        </div>

        {/* Two-column layout matching client detail */}
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1fr_300px] lg:items-start">

          {/* ── Left column ──────────────────────────────────────────── */}
          <div className="flex flex-col gap-5">

            {/* Informações */}
            <Card className="p-5">
              <CardHeader icon={<FileText className="h-4 w-4" />} title="Informações" />
              <div className="space-y-4">
                <div>
                  <FieldLabel>Título do projeto</FieldLabel>
                  <Input
                    value={proposal.title}
                    onChange={(e) => patchProposal({ title: e.target.value })}
                    placeholder="Ex: Identidade Visual — 2026"
                    className="mt-1.5"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <FieldLabel>Cliente</FieldLabel>
                    <div className="mt-1.5 text-sm font-medium text-foreground">
                      {proposal.clients?.company ?? '—'}
                    </div>
                  </div>
                  <div>
                    <FieldLabel>Validade</FieldLabel>
                    <div className="mt-1.5">
                      <DatePicker
                        value={parseIsoDate(proposal.valid_until)}
                        onChange={(d) => patchProposal({ valid_until: toIsoDate(d) })}
                        placeholder="Sem validade"
                        disablePast
                      />
                    </div>
                  </div>
                </div>
              </div>
            </Card>

            {/* Texto de abertura */}
            {headerBlock ? (
              <Card className="p-5">
                <CardHeader icon={<AlignLeft className="h-4 w-4" />} title="Texto de abertura" />
                <textarea
                  value={(headerBlock.content as { body?: string }).body ?? ''}
                  onChange={(e) => patchBlock(headerBlock.id, { body: e.target.value })}
                  placeholder="Foi um prazer conversar com você…"
                  rows={4}
                  className={cn(
                    'flex w-full resize-y rounded-md border border-border bg-secondary px-3 py-2.5',
                    'text-sm text-foreground placeholder:text-muted-foreground/50',
                    'focus:outline-none focus:ring-2 focus:ring-ring/30 focus:border-primary/30',
                    'transition-all duration-150',
                  )}
                />
              </Card>
            ) : (
              <MissingSection label="Texto de abertura" type="header" onAdd={addBlock} />
            )}

            {/* Fases */}
            {phasesBlock ? (
              <PhasesCard
                block={phasesBlock}
                onChange={(c) => patchBlock(phasesBlock.id, c)}
              />
            ) : (
              <MissingSection label="Fases do projeto" type="phases" onAdd={addBlock} />
            )}
          </div>

          {/* ── Right column ─────────────────────────────────────────── */}
          <div className="flex flex-col gap-5">

            {/* Investimento */}
            {investmentBlock ? (
              <InvestimentoCard
                block={investmentBlock}
                onChange={(c) => patchBlock(investmentBlock.id, c)}
              />
            ) : (
              <MissingSection label="Investimento" type="investment" onAdd={addBlock} />
            )}

          </div>
        </div>
      </div>

      <Dialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Remover seção?</DialogTitle>
            <DialogDescription>Esta ação não pode ser desfeita.</DialogDescription>
          </DialogHeader>
          <DialogFooter className="p-6 pt-0">
            <Button type="button" variant="ghost" onClick={() => setDeleteTarget(null)}>Cancelar</Button>
            <Button variant="destructive" onClick={confirmDeleteBlock}>Remover</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ─── Missing section placeholder ──────────────────────────────────────────

function MissingSection({ label, type, onAdd }: { label: string; type: ProposalBlockType; onAdd: (t: ProposalBlockType) => void }) {
  return (
    <Card className="border-dashed p-5">
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">{label} não adicionado</span>
        <Button variant="ghost" size="sm" onClick={() => onAdd(type)}>
          <Plus className="mr-1 h-3.5 w-3.5" />Adicionar
        </Button>
      </div>
    </Card>
  )
}

// ─── Phases card ──────────────────────────────────────────────────────────

function PhasesCard({ block, onChange }: { block: ProposalBlock; onChange: (c: ProposalBlockContent) => void }) {
  const [expanded, setExpanded] = useState<number | null>(null)
  const content = block.content as { phases?: ProposalPhase[] }
  const phases: ProposalPhase[] = content.phases ?? []

  const update = (i: number, patch: Partial<ProposalPhase>) => {
    const next = phases.map((p, idx) => idx === i ? { ...p, ...patch } : p)
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
    onChange({ phases: [...phases, { number: nextNum, title: '', duration: '', description: '', visible: true }] })
    setExpanded(phases.length)
  }

  return (
    <Card className="p-5">
      <CardHeader
        icon={<List className="h-4 w-4" />}
        title="Fases do projeto"
        action={
          <Button variant="ghost" size="sm" onClick={add}>
            <Plus className="mr-1 h-3.5 w-3.5" />Fase
          </Button>
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
              <div key={i} className={cn('rounded-lg border border-border transition-colors', !isVisible && 'opacity-50')}>
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
                  <span className="font-mono text-xs tabular-nums text-muted-foreground">{phase.number || `${i + 1}.0`}</span>
                  <span className="flex-1 truncate text-sm font-medium text-foreground">{phase.title || 'Sem título'}</span>
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

// ─── Investment card (right sidebar) ─────────────────────────────────────

function InvestimentoCard({ block, onChange }: { block: ProposalBlock; onChange: (c: ProposalBlockContent) => void }) {
  const content = block.content as BlockContentInvestment
  const terms = (content.payment_terms as PaymentTerm[] | undefined) ?? []

  const updateTotal = (raw: string) => {
    const num = parseFloat(raw.replace(/\./g, '').replace(',', '.'))
    onChange({ ...content, total_amount: isNaN(num) ? 0 : num })
  }

  const toggleTerm = (i: number) => {
    const next = terms.map((t, idx) =>
      idx === i ? { ...t, visible: (t as { visible?: boolean }).visible === false ? true : false } : t
    ) as PaymentTerm[]
    onChange({ ...content, payment_terms: next })
  }

  const displayAmount = content.total_amount > 0 ? String(content.total_amount).replace('.', ',') : ''

  return (
    <Card className="p-5">
      <CardHeader icon={<DollarSign className="h-4 w-4" />} title="Investimento" />

      <div className="space-y-5">
        {/* Total */}
        <div>
          <FieldLabel>Valor total</FieldLabel>
          <div className="mt-1.5 flex items-center gap-2">
            <span className="font-mono text-sm text-muted-foreground">R$</span>
            <Input
              value={displayAmount}
              onChange={(e) => updateTotal(e.target.value)}
              placeholder="3.000,00"
              className="font-mono text-lg font-bold tabular-nums"
            />
          </div>
        </div>

        {/* Payment terms */}
        {terms.length > 0 && (
          <div>
            <FieldLabel>Condições de pagamento</FieldLabel>
            <div className="mt-2 space-y-2">
              {terms.map((term, i) => {
                const t = term as { label?: string; description?: string; discount_percent?: number; visible?: boolean }
                const active = t.visible !== false
                return (
                  <label
                    key={i}
                    className={cn(
                      'flex cursor-pointer items-start gap-3 rounded-lg border border-border p-3 transition-colors',
                      active ? 'bg-card' : 'opacity-50',
                    )}
                  >
                    <Checkbox
                      checked={active}
                      onCheckedChange={() => toggleTerm(i)}
                      className="mt-0.5 shrink-0 data-[state=checked]:bg-foreground data-[state=checked]:border-foreground data-[state=checked]:text-background"
                    />
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-foreground">{t.label || 'Sem título'}</div>
                      {t.description && (
                        <div className="text-xs leading-relaxed text-muted-foreground">{t.description}</div>
                      )}
                      {t.discount_percent && (
                        <div className="mt-1 inline-flex rounded bg-success/15 px-1.5 py-0.5 font-mono text-[10px] text-success">
                          {t.discount_percent}% de desconto
                        </div>
                      )}
                    </div>
                  </label>
                )
              })}
            </div>
          </div>
        )}
      </div>
    </Card>
  )
}

// ─── Document view ────────────────────────────────────────────────────────

function DocumentView({
  proposal, blocks, status, onEdit,
}: { proposal: ProposalWithClient; blocks: ProposalBlock[]; status: ProposalStatus; onEdit: () => void }) {
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
