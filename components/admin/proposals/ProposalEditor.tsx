'use client'

import { useCallback, useMemo, useRef, useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import {
  ArrowLeft, Check, AlertCircle, Loader2, Eye, Plus, Trash2,
  ChevronDown, ChevronUp, FileText, DollarSign, List, AlignLeft, Clock,
  Sparkles,
} from 'lucide-react'

import { Badge }    from '@/components/ui/badge'
import { Button }   from '@/components/ui/button'
import { IconButton } from '@/components/ui/icon-button'
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
import { formatDistanceToNow } from 'date-fns'
import { ptBR } from 'date-fns/locale'

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

// ─── Constants ────────────────────────────────────────────────────────────

const STATUS_COLORS: Record<ProposalStatus, string> = {
  draft:    'border-border bg-muted text-muted-foreground',
  sent:     'border-info/30 bg-info/10 text-info',
  viewed:   'border-warning/30 bg-warning/10 text-warning',
  approved: 'border-success/30 bg-success/10 text-success',
  rejected: 'border-destructive/30 bg-destructive/10 text-destructive',
  revised:  'border-warning/30 bg-warning/10 text-warning',
  expired:  'border-border bg-muted text-muted-foreground/70',
}

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

  // Status changing
  const [editingStatus, setEditingStatus] = useState(false)
  const changeStatus = async (next: ProposalStatus) => {
    setEditingStatus(false)
    if (next === proposal.status) return
    setProposal((p) => ({ ...p, status: next }))
    const res = await fetch(`/api/proposals/${slug}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: next }),
    })
    if (!res.ok) { toast('Erro ao mudar status', 'error'); return }
    toast(`Status: ${PROPOSAL_STATUS_LABELS_PT[next]}`, 'success', 1500)
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

        {/* ── Page header ─────────────────────────────────────────────── */}
        <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
          <div className="flex min-w-0 flex-1 items-start gap-3">
            <IconButton
              icon={<ArrowLeft className="h-4 w-4" />}
              label="Voltar"
              size="icon"
              onClick={() => router.push('/admin/propostas')}
            />

            {/* Client avatar (or fallback icon) */}
            <div className="hidden h-12 w-12 shrink-0 overflow-hidden rounded-lg border border-border bg-muted/40 sm:block">
              {proposal.clients?.avatar_url ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={proposal.clients.avatar_url}
                  alt={proposal.clients.company}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-muted-foreground">
                  <FileText className="h-5 w-5" />
                </div>
              )}
            </div>

            <div className="min-w-0 flex-1">
              {/* Title alone on its row — no competing elements */}
              <Input
                value={proposal.title}
                onChange={(e) => patchProposal({ title: e.target.value })}
                placeholder="Sem título"
                className="h-auto w-full border-0 bg-transparent p-0 font-mono text-xl font-bold tracking-tight shadow-none focus-visible:ring-0 placeholder:text-muted-foreground/40"
              />

              {/* Metadata line with status pill + save indicator inline */}
              <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                <span className="font-mono tabular-nums">
                  {formatProposalNumber(proposal.number, proposal.version_suffix)}
                </span>

                <span>·</span>

                {/* Clickable status pill */}
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setEditingStatus((e) => !e)}
                    className={cn(
                      'inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[11px] font-medium transition-colors hover:opacity-80',
                      STATUS_COLORS[status],
                    )}
                  >
                    {PROPOSAL_STATUS_LABELS_PT[status]}
                    <ChevronDown size={10} className={cn('transition-transform', editingStatus && 'rotate-180')} />
                  </button>
                  {editingStatus && (
                    <div className="absolute left-0 top-full z-10 mt-1 w-40 overflow-hidden rounded-lg border border-border bg-card shadow-lg">
                      {(Object.keys(PROPOSAL_STATUS_LABELS_PT) as ProposalStatus[]).map((s) => (
                        <button
                          key={s}
                          type="button"
                          onClick={() => changeStatus(s)}
                          className={cn(
                            'flex w-full items-center gap-2 px-3 py-2 text-xs transition-colors hover:bg-muted',
                            status === s && 'font-semibold',
                          )}
                        >
                          <span className={cn('h-1.5 w-1.5 rounded-full border', STATUS_COLORS[s])} />
                          {PROPOSAL_STATUS_LABELS_PT[s]}
                          {status === s && <Check size={10} className="ml-auto" />}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {proposal.clients?.company && (<>
                  <span>·</span>
                  <span>para {proposal.clients.company}</span>
                </>)}
                <span>·</span>
                <span>criada {formatDistanceToNow(new Date(proposal.created_at), { locale: ptBR, addSuffix: true })}</span>

                {(combinedStatus !== 'idle' || combinedSavedAt) && (<>
                  <span>·</span>
                  <SaveIndicator status={combinedStatus} lastSavedAt={combinedSavedAt} />
                </>)}
              </div>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-3">
            <Button onClick={() => { proposalSave.flush(); blocksSave.flush(); setMode('document') }}>
              <Eye className="mr-1.5 h-4 w-4" />Visualizar proposta
            </Button>
          </div>
        </div>

        {/* ── 2-column layout ─────────────────────────────────────────── */}
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1fr_300px] lg:items-start">

          {/* ── Left column ──────────────────────────────────────────── */}
          <div className="flex flex-col gap-5">

            {/* IA Assistente — primary action, fills the content below */}
            <IACard
              proposal={proposal}
              onPersonalize={async (context) => {
                const res = await fetch('/api/proposals/generate', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    template_id: proposal.template_id,
                    client_id: proposal.client_id,
                    context,
                  }),
                })
                if (!res.ok) { toast('IA indisponível agora', 'error'); return }
                const data = await res.json()
                const overrides = data.content_overrides
                if (!overrides) return

                if (headerBlock && overrides.header) {
                  patchBlock(headerBlock.id, overrides.header)
                }
                if (phasesBlock && overrides.phases) {
                  // Preserve existing visible flags on phases (user toggles)
                  const oldPhases = (phasesBlock.content as { phases?: ProposalPhase[] }).phases ?? []
                  const newPhases = overrides.phases.phases.map((p: ProposalPhase, i: number) => ({
                    ...p,
                    visible: oldPhases[i]?.visible ?? true,
                  }))
                  patchBlock(phasesBlock.id, { phases: newPhases })
                }
                toast('Proposta personalizada com IA', 'success')
              }}
            />

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

            {/* Validade */}
            <Card className="p-5">
              <CardHeader icon={<Clock className="h-4 w-4" />} title="Validade" />
              <DatePicker
                value={parseIsoDate(proposal.valid_until)}
                onChange={(d) => patchProposal({ valid_until: toIsoDate(d) })}
                placeholder="Sem validade"
                disablePast
              />
            </Card>

            {/* Investimento */}
            {investmentBlock ? (
              <InvestimentoCard
                block={investmentBlock}
                onChange={(c) => patchBlock(investmentBlock.id, c)}
              />
            ) : (
              <MissingSection label="Investimento" type="investment" onAdd={addBlock} />
            )}

            {/* Detalhes */}
            <Card className="p-5">
              <CardHeader icon={<FileText className="h-4 w-4" />} title="Detalhes" />
              <div className="space-y-3 text-xs">
                <DetalheRow label="Criada em" value={fmtDateLong(proposal.created_at)} />
                <DetalheRow
                  label="Atualizada"
                  value={formatDistanceToNow(new Date(proposal.updated_at), { locale: ptBR, addSuffix: true })}
                />
                <DetalheRow label="Idioma" value={proposal.language === 'pt-BR' ? 'Português' : 'English'} />
              </div>
            </Card>

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

// ─── Detalhe row ──────────────────────────────────────────────────────────

function DetalheRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right text-foreground">{value}</span>
    </div>
  )
}

// ─── Date helper for Detalhes ─────────────────────────────────────────────

function fmtDateLong(iso: string): string {
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: '2-digit' })
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

  const [focused, setFocused] = useState(false)

  const updateTotal = (raw: string) => {
    // Strip everything except digits, comma, period
    const num = parseFloat(raw.replace(/[^\d,.-]/g, '').replace(/\./g, '').replace(',', '.'))
    onChange({ ...content, total_amount: isNaN(num) ? 0 : num })
  }

  const toggleTerm = (i: number) => {
    const next = terms.map((t, idx) =>
      idx === i ? { ...t, visible: (t as { visible?: boolean }).visible === false ? true : false } : t
    ) as PaymentTerm[]
    onChange({ ...content, payment_terms: next })
  }

  // Display: raw editable value when focused, formatted "3.000,00" when blurred
  const displayAmount = focused
    ? (content.total_amount > 0 ? String(content.total_amount).replace('.', ',') : '')
    : (content.total_amount > 0
        ? content.total_amount.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
        : '')

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
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
              placeholder="0,00"
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

// ─── IA Assistente card ──────────────────────────────────────────────────

function IACard({
  proposal, onPersonalize,
}: { proposal: ProposalWithClient; onPersonalize: (context: string) => Promise<void> }) {
  const [context, setContext] = useState('')
  const [loading, setLoading] = useState(false)
  const [expanded, setExpanded] = useState(false)

  // Always allow regen when there's a client (auto-context from cadastrado data)
  // — context typed by owner is just a bonus.
  const canSubmit = !loading && !!proposal.client_id

  const handleSubmit = async () => {
    if (!canSubmit) return
    setLoading(true)
    try {
      await onPersonalize(context)
      setContext('')
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
          {expanded
            ? <ChevronUp className="h-4 w-4 text-muted-foreground" />
            : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
        </div>
      </button>

      {expanded && (
        <div className="space-y-3">
          <p className="text-xs leading-relaxed text-muted-foreground">
            A IA usa os dados do cliente automaticamente (site, redes, perfil de IA salvo). Adicione contexto extra abaixo se quiser — notas da reunião, transcrição, detalhes específicos.
          </p>

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
            <Button
              onClick={handleSubmit}
              disabled={!canSubmit}
            >
              {loading ? (
                <><Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />Personalizando…</>
              ) : (
                <><Sparkles className="mr-1.5 h-3.5 w-3.5" />Personalizar</>
              )}
            </Button>
          </div>

          {!proposal.template_id && (
            <p className="text-[11px] text-warning">
              Esta proposta não tem modelo. A IA vai gerar do zero a partir do contexto e dos dados do cliente.
            </p>
          )}
        </div>
      )}
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
