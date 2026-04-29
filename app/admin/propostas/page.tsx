'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import {
  FileText, Plus, Search, MoreHorizontal,
  Inbox, Send, CheckCircle2, DollarSign,
  Eye, XCircle, Clock, RefreshCw, ArrowRight,
  Settings,
} from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { ptBR } from 'date-fns/locale'

import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { IconButton } from '@/components/ui/icon-button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { DatePicker, parseIsoDate, toIsoDate } from '@/components/ui/date-picker'

import { useToast, ToastContainer } from '@/components/toast'
import { cn } from '@/lib/utils'
import {
  formatProposalNumber,
  proposalStatusVariant,
  PROPOSAL_STATUS_LABELS_PT,
  type ProposalStatus,
  type ProposalTemplate,
  type ProposalWithClient,
} from '@/lib/proposal-types'

// ─── Constants ────────────────────────────────────────────────────────────

const STATUS_FILTER_ORDER: ProposalStatus[] = [
  'draft', 'sent', 'viewed', 'approved', 'rejected', 'revised', 'expired',
]

// Compact label for filter chips (rascunho stays full, others kept short)
const STATUS_CHIP_LABEL: Record<ProposalStatus, string> = {
  draft: 'Rascunho',
  sent: 'Enviada',
  viewed: 'Visualizada',
  approved: 'Aprovada',
  rejected: 'Recusada',
  revised: 'Revisada',
  expired: 'Expirada',
}

// ─── Helpers ──────────────────────────────────────────────────────────────

interface ClientLite {
  id: string
  name: string
  company: string
  avatar_url: string | null
  primary_contact?: { name: string; email: string | null } | null
}

function fmtDate(iso: string | null): string {
  if (!iso) return '—'
  // Append T00:00:00 to avoid UTC→local TZ shift that pushes the date one day back.
  return new Date(`${iso}T00:00:00`).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
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

function StatusIcon({ status, size = 11 }: { status: ProposalStatus; size?: number }) {
  switch (status) {
    case 'draft':
      return <FileText size={size} />
    case 'sent':
      return <Send size={size} />
    case 'viewed':
      return <Eye size={size} />
    case 'approved':
      return <CheckCircle2 size={size} />
    case 'rejected':
      return <XCircle size={size} />
    case 'expired':
      return <Clock size={size} />
    case 'revised':
      return <RefreshCw size={size} />
  }
}

function StatusBadge({ status }: { status: ProposalStatus }) {
  return (
    <Badge
      variant={proposalStatusVariant(status)}
      className="text-[11px] font-medium whitespace-nowrap"
    >
      <StatusIcon status={status} />
      {PROPOSAL_STATUS_LABELS_PT[status]}
    </Badge>
  )
}

function SkeletonCard() {
  return (
    <Card className="overflow-hidden p-0">
      <div className="flex items-center gap-3 px-4 py-3">
        <div className="h-9 w-9 shrink-0 animate-pulse rounded-full bg-muted" />
        <div className="flex-1 space-y-1.5">
          <div className="h-4 w-3/5 animate-pulse rounded bg-muted" />
          <div className="h-3 w-1/3 animate-pulse rounded bg-muted/60" />
        </div>
      </div>
    </Card>
  )
}

// ─── Helpers ──────────────────────────────────────────────────────────────

/** Compact currency for metric cards: R$ 12k, R$ 3.5k, R$ 850, R$ 1.2M */
function fmtCurrencyShort(amount: number): string {
  if (!amount || amount === 0) return 'R$ 0'
  const abs = Math.abs(amount)
  if (abs >= 1_000_000) return `R$ ${(amount / 1_000_000).toFixed(1).replace('.', ',')}M`
  if (abs >= 10_000)    return `R$ ${Math.round(amount / 1000)}k`
  if (abs >= 1_000)     return `R$ ${(amount / 1000).toFixed(1).replace('.', ',')}k`
  return `R$ ${Math.round(amount)}`
}

/** Relative time helper, returns 'há 2h', 'hoje', 'há 3 dias' (PT-BR). */
function relativeTime(iso: string | null | undefined): string {
  if (!iso) return ''
  try {
    return formatDistanceToNow(new Date(iso), { addSuffix: true, locale: ptBR })
  } catch { return '' }
}

// ─── Reusable presentational components ──────────────────────────────────

function MetricCard({
  icon, label, value, active = false, highlight = false,
}: {
  icon: React.ReactNode
  label: string
  value: string
  active?: boolean
  highlight?: boolean
}) {
  return (
    <Card
      className={cn(
        'p-4 transition-colors',
        active     && 'border-foreground/40 bg-muted/40',
        highlight  && 'border-success/40 bg-success/5',
      )}
    >
      <div className="mb-2 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
        <span className={cn(highlight && 'text-success')}>{icon}</span>
        {label}
      </div>
      <div className={cn(
        'font-mono text-2xl font-bold tabular-nums tracking-tight',
        highlight ? 'text-success' : 'text-foreground',
      )}>
        {value}
      </div>
    </Card>
  )
}

function ProposalRow({
  proposal, selected, onSelectToggle, onClick,
}: {
  proposal: ProposalWithClient
  selected: boolean
  onSelectToggle: (checked: boolean) => void
  onClick: () => void
}) {
  const num     = formatProposalNumber(proposal.number, proposal.version_suffix)
  const valid   = proposal.valid_until ? fmtDate(proposal.valid_until) : null
  const created = relativeTime(proposal.created_at)
  const company = proposal.clients?.company ?? '—'
  const initials = company.slice(0, 2).toUpperCase()

  return (
    <Card
      className={cn(
        'group cursor-pointer overflow-hidden p-0 transition-colors',
        selected
          ? 'border-foreground/40 bg-muted/40'
          : 'hover:border-border/70 hover:bg-muted/30',
      )}
      onClick={onClick}
    >
      <div className="flex items-center gap-3 px-4 py-3">
        {/* Checkbox — stop propagation so clicking it doesn't navigate */}
        <div onClick={(e) => e.stopPropagation()}>
          <Checkbox
            checked={selected}
            onCheckedChange={(checked) => onSelectToggle(checked === true)}
            className="data-[state=checked]:border-foreground data-[state=checked]:bg-foreground data-[state=checked]:text-background"
          />
        </div>

        {/* Avatar — client logo or initials fallback */}
        <div className="shrink-0">
          {proposal.clients?.avatar_url ? (
            <Image
              src={proposal.clients.avatar_url}
              alt={company}
              width={36}
              height={36}
              className="h-9 w-9 rounded-md object-cover"
            />
          ) : (
            <div className="flex h-9 w-9 items-center justify-center rounded-md bg-muted text-[10px] font-semibold text-muted-foreground">
              {initials}
            </div>
          )}
        </div>

        {/* Main column */}
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2">
            <span className="truncate text-sm font-semibold text-foreground">
              {proposal.title}
            </span>
            <span className="hidden truncate text-xs text-muted-foreground sm:inline">
              · {company}
            </span>
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-muted-foreground">
            <StatusBadge status={proposal.status} />
            <span className="font-mono tabular-nums">{num}</span>
            {created && <><span>·</span><span>criada {created}</span></>}
            {valid    && <><span className="hidden sm:inline">·</span><span className="hidden sm:inline">válida até {valid}</span></>}
          </div>
        </div>

        {/* Right side: amount + actions */}
        <div className="flex shrink-0 items-center gap-3">
          <div className="text-right">
            <div className="font-mono text-sm font-semibold tabular-nums text-foreground">
              {fmtCurrency(proposal.total_amount, proposal.currency)}
            </div>
            {valid && (
              <div className="text-[10px] uppercase tracking-widest text-muted-foreground sm:hidden">
                até {valid}
              </div>
            )}
          </div>
          <div
            className="hidden items-center gap-0.5 sm:flex"
            onClick={(e) => e.stopPropagation()}
          >
            <IconButton
              icon={<MoreHorizontal className="h-4 w-4" />}
              label="Mais opções"
            />
          </div>

          {/* Discoverability chevron — only on row hover. The whole card
              is clickable; this gives a clear visual hint without
              cluttering the resting state. */}
          <ArrowRight
            className="ml-0.5 hidden h-3.5 w-3.5 shrink-0 text-muted-foreground/50 opacity-0 transition-opacity group-hover:opacity-100 sm:block"
            aria-hidden="true"
          />
        </div>
      </div>
    </Card>
  )
}

function EmptyStateNoProposals({ onCreate }: { onCreate: () => void }) {
  return (
    <Card className="p-12">
      <div className="text-center text-muted-foreground">
        <FileText className="mx-auto mb-3 h-10 w-10 opacity-40" />
        <div className="mb-1.5 text-base font-semibold text-foreground">
          Nenhuma proposta ainda
        </div>
        <div className="mb-5 text-sm">
          Crie sua primeira proposta para começar
        </div>
        <Button onClick={onCreate}>
          <Plus className="mr-1.5 h-4 w-4" />
          Criar primeira proposta
        </Button>
      </div>
    </Card>
  )
}

function EmptyStateNoResults({ onClear }: { onClear: () => void }) {
  return (
    <Card className="p-10">
      <div className="text-center text-sm text-muted-foreground">
        <div className="mb-3">Nenhuma proposta corresponde aos filtros.</div>
        <button
          type="button"
          onClick={onClear}
          className="text-xs font-medium text-foreground underline-offset-2 hover:underline"
        >
          Limpar filtros
        </button>
      </div>
    </Card>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────

export default function PropostasPage() {
  const router = useRouter()
  const { toasts, toast, remove } = useToast()

  const [proposals, setProposals] = useState<ProposalWithClient[]>([])
  const [clients, setClients] = useState<ClientLite[]>([])
  const [templates, setTemplates] = useState<ProposalTemplate[]>([])
  const [loading, setLoading] = useState(true)

  const [showNew, setShowNew] = useState(false)
  const [saving, setSaving] = useState(false)
  const [generating, setGenerating] = useState(false)

  // ─── List filtering / sorting state ────────────────────────────────────
  const [search, setSearch]               = useState('')
  const [sortBy, setSortBy]               = useState<'recent' | 'amount' | 'alpha'>('recent')
  const [activeStatusFilters, setActiveStatusFilters] = useState<Set<ProposalStatus>>(new Set())
  const [selected, setSelected]           = useState<Set<string>>(new Set())

  // ─── Derived metrics ───────────────────────────────────────────────────
  const metrics = useMemo(() => {
    const total      = proposals.length
    const draft      = proposals.filter((p) => p.status === 'draft').length
    const inPipeline = proposals.filter((p) => p.status === 'sent' || p.status === 'viewed').length
    const approved   = proposals.filter((p) => p.status === 'approved')
    const approvedCount = approved.length
    const approvedSum   = approved.reduce((acc, p) => acc + (p.total_amount ?? 0), 0)
    return { total, draft, inPipeline, approvedCount, approvedSum }
  }, [proposals])

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase()
    let list = proposals.filter((p) => {
      if (s) {
        const hay = `${p.title} ${p.clients?.company ?? ''} ${formatProposalNumber(p.number, p.version_suffix)}`.toLowerCase()
        if (!hay.includes(s)) return false
      }
      if (activeStatusFilters.size > 0 && !activeStatusFilters.has(p.status as ProposalStatus)) {
        return false
      }
      return true
    })
    if (sortBy === 'amount') {
      list = list.slice().sort((a, b) => (b.total_amount ?? 0) - (a.total_amount ?? 0))
    } else if (sortBy === 'alpha') {
      list = list.slice().sort((a, b) => a.title.localeCompare(b.title, 'pt-BR'))
    } else {
      // 'recent' — default: by number desc (which equals creation order)
      list = list.slice().sort((a, b) => b.number - a.number)
    }
    return list
  }, [proposals, search, activeStatusFilters, sortBy])

  const toggleStatusFilter = (s: ProposalStatus) => {
    setActiveStatusFilters((prev) => {
      const next = new Set(prev)
      if (next.has(s)) next.delete(s)
      else next.add(s)
      return next
    })
  }

  const clearFilters = () => {
    setSearch('')
    setActiveStatusFilters(new Set())
    setSortBy('recent')
  }

  const toggleSelect = (id: string, checked: boolean) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (checked) next.add(id); else next.delete(id)
      return next
    })
  }

  const toggleSelectAll = (checked: boolean) => {
    setSelected(checked ? new Set(filtered.map((p) => p.id)) : new Set())
  }

  const hasFilters = search.trim().length > 0 || activeStatusFilters.size > 0

  // Special sentinel meaning "start blank, no template".
  const TEMPLATE_BLANK = '__blank__'

  const [form, setForm] = useState({
    client_id: '',
    title: '',
    valid_until: '',
    template_id: '' as string,
    context: '',
    addressee_name: '',
  })

  const fetchProposals = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/proposals', { cache: 'no-store' })
      if (res.status === 401) {
        router.push('/admin')
        return
      }
      if (res.ok) {
        const data = await res.json()
        setProposals(data.proposals ?? [])
      } else {
        toast('Erro ao carregar propostas', 'error')
      }
    } catch {
      toast('Erro de rede', 'error')
    } finally {
      setLoading(false)
    }
  }, [router, toast])

  const fetchClients = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/clients', { cache: 'no-store' })
      if (res.ok) {
        const data = await res.json()
        // Existing endpoint returns { clients: [...] } with full Client objects;
        // we only need a lite view for the dropdown.
        const list: ClientLite[] = (data.clients ?? []).map(
          (c: { id: string; name: string; company: string; avatar_url: string | null; primary_contact?: { name: string; email: string | null } | null }) => ({
            id: c.id,
            name: c.name,
            company: c.company,
            avatar_url: c.avatar_url,
            primary_contact: c.primary_contact ?? null,
          }),
        )
        setClients(list)
      }
    } catch {
      // Silent — the modal will just show empty client list
    }
  }, [])

  const fetchTemplates = useCallback(async () => {
    try {
      const res = await fetch('/api/proposal-templates', { cache: 'no-store' })
      if (res.ok) {
        const data = await res.json()
        setTemplates(data.templates ?? [])
      }
    } catch {
      // Silent — modal falls back to "Em branco" only
    }
  }, [])

  useEffect(() => {
    fetchProposals()
    fetchClients()
    fetchTemplates()
  }, [fetchProposals, fetchClients, fetchTemplates])

  const openNew = () => {
    const defaultTemplate = templates.find((t) => t.is_default) ?? templates[0]
    setForm({
      client_id: '',
      title: '',
      valid_until: '',
      template_id: defaultTemplate?.id ?? TEMPLATE_BLANK,
      context: '',
      addressee_name: '',
    })
    setShowNew(true)
  }

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.client_id || !form.title.trim()) {
      toast('Preencha cliente e título', 'error')
      return
    }
    const useTemplate = form.template_id && form.template_id !== TEMPLATE_BLANK
    // AI runs whenever a template is selected and a client is set —
    // the client's saved data (site, redes, perfil de IA) already provides
    // enough context, even without notes typed by the owner.
    const useAI = useTemplate && form.client_id

    // Step 1: AI generation
    let contentOverrides: Record<string, unknown> | undefined
    if (useAI) {
      setGenerating(true)
      try {
        const genRes = await fetch('/api/proposals/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            template_id: form.template_id,
            client_id: form.client_id,
            context: form.context,
            addressee_name: form.addressee_name.trim() || null,
          }),
        })
        if (genRes.ok) {
          const genData = await genRes.json()
          contentOverrides = genData.content_overrides
        } else {
          toast('IA indisponível — usando template padrão', 'error')
        }
      } catch {
        toast('IA indisponível — usando template padrão', 'error')
      } finally {
        setGenerating(false)
      }
    }

    // Step 2: Create the proposal
    setSaving(true)
    try {
      const res = await fetch('/api/proposals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_id: form.client_id,
          title: form.title.trim(),
          valid_until: form.valid_until || null,
          template_id: useTemplate ? form.template_id : null,
          content_overrides: contentOverrides,
        }),
      })
      if (res.ok) {
        const data = await res.json()
        setShowNew(false)
        toast(contentOverrides ? 'Proposta personalizada com IA' : 'Proposta criada', 'success')
        router.push(`/admin/propostas/${data.proposal.slug}`)
      } else {
        const data = await res.json().catch(() => ({}))
        toast(data.error || 'Erro ao criar proposta', 'error')
      }
    } catch {
      toast('Erro de rede', 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <ToastContainer toasts={toasts} remove={remove} />

      <div className="mx-auto max-w-5xl p-6">
        {/* Page header */}
        <div className="mb-5 flex items-center justify-between">
          <h1 className="font-mono text-xl font-bold tracking-tight">Propostas</h1>
          <div className="flex items-center gap-2">
            <IconButton
              icon={<Settings className="h-4 w-4" />}
              label="Configurações de Propostas"
              size="icon"
              variant="outline"
              onClick={() => router.push('/admin/config/propostas')}
            />
            <Button onClick={openNew}>
              <Plus className="mr-1.5 h-4 w-4" />
              Nova proposta
            </Button>
          </div>
        </div>

        {/* Metric cards */}
        <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          <MetricCard
            icon={<Inbox className="h-3.5 w-3.5" />}
            label="Total"
            value={String(metrics.total)}
            active
          />
          <MetricCard
            icon={<FileText className="h-3.5 w-3.5" />}
            label="Rascunho"
            value={String(metrics.draft)}
          />
          <MetricCard
            icon={<Send className="h-3.5 w-3.5" />}
            label="Em pipeline"
            value={String(metrics.inPipeline)}
          />
          <MetricCard
            icon={<CheckCircle2 className="h-3.5 w-3.5" />}
            label="Aprovadas"
            value={String(metrics.approvedCount)}
          />
          <MetricCard
            icon={<DollarSign className="h-3.5 w-3.5" />}
            label="Receita aprovada"
            value={fmtCurrencyShort(metrics.approvedSum)}
            highlight
          />
        </div>

        {/* Search + sort */}
        <div className="mb-3 flex flex-col gap-2 sm:flex-row">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/60" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar título, cliente ou número…"
              className="pl-9"
            />
          </div>
          <Select value={sortBy} onValueChange={(v) => setSortBy(v as typeof sortBy)}>
            <SelectTrigger className="sm:w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="recent">Mais recentes</SelectItem>
              <SelectItem value="amount">Maior valor</SelectItem>
              <SelectItem value="alpha">A → Z</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Status filter chips + bulk select */}
        {!loading && proposals.length > 0 && (
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <label className="mr-2 inline-flex cursor-pointer items-center gap-2 text-xs text-muted-foreground">
              <Checkbox
                checked={selected.size > 0 && selected.size === filtered.length}
                onCheckedChange={(checked) => toggleSelectAll(checked === true)}
                className="data-[state=checked]:border-foreground data-[state=checked]:bg-foreground data-[state=checked]:text-background"
              />
              Selecionar todos ({filtered.length})
            </label>
            <div className="hidden h-4 w-px bg-border sm:block" />
            {STATUS_FILTER_ORDER.map((s) => {
              const isActive = activeStatusFilters.has(s)
              return (
                <button
                  key={s}
                  type="button"
                  onClick={() => toggleStatusFilter(s)}
                  className={cn(
                    'rounded-md border px-2 py-0.5 text-[11px] font-medium transition-colors',
                    isActive
                      ? 'border-foreground bg-foreground text-background'
                      : 'border-border bg-card text-muted-foreground hover:border-foreground/30 hover:text-foreground',
                  )}
                >
                  {STATUS_CHIP_LABEL[s]}
                </button>
              )
            })}
            {hasFilters && (
              <button
                type="button"
                onClick={clearFilters}
                className="ml-auto text-[11px] text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
              >
                Limpar filtros
              </button>
            )}
          </div>
        )}

        {/* List */}
        {loading ? (
          <div className="flex flex-col gap-2">
            {[1, 2, 3].map((i) => <SkeletonCard key={i} />)}
          </div>
        ) : proposals.length === 0 ? (
          <EmptyStateNoProposals onCreate={openNew} />
        ) : filtered.length === 0 ? (
          <EmptyStateNoResults onClear={clearFilters} />
        ) : (
          <div className="flex flex-col gap-2">
            {filtered.map((p) => (
              <ProposalRow
                key={p.id}
                proposal={p}
                selected={selected.has(p.id)}
                onSelectToggle={(checked) => toggleSelect(p.id, checked)}
                onClick={() => router.push(`/admin/propostas/${p.slug}`)}
              />
            ))}
          </div>
        )}
      </div>

      {/* New proposal modal */}
      <Dialog open={showNew} onOpenChange={setShowNew}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Nova proposta</DialogTitle>
            <DialogDescription>
              Comece com o essencial. Edição completa abre em seguida.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleCreate} className="space-y-4 p-6 pt-4">
            <div className="space-y-1.5">
              <Label
                htmlFor="template_id"
                className="text-[10px] uppercase tracking-widest text-muted-foreground"
              >
                Modelo
              </Label>
              <Select
                value={form.template_id}
                onValueChange={(v) => setForm((f) => ({ ...f, template_id: v }))}
              >
                <SelectTrigger id="template_id">
                  {/* Render name manually — SelectValue would display full SelectItem content */}
                  <span className={form.template_id ? 'text-foreground' : 'text-muted-foreground/60'}>
                    {form.template_id === TEMPLATE_BLANK
                      ? 'Em branco'
                      : form.template_id
                        ? (templates.find((t) => t.id === form.template_id)?.name ?? 'Selecione um modelo')
                        : 'Selecione um modelo'}
                  </span>
                </SelectTrigger>
                <SelectContent>
                  {templates.map((t) => (
                    <SelectItem key={t.id} value={t.id} textValue={t.name}>
                      <div className="flex flex-col gap-0.5 py-0.5">
                        <span className="text-sm font-medium leading-tight">
                          {t.name}
                        </span>
                        {t.description && (
                          <span className="text-[11px] leading-tight text-muted-foreground">
                            {t.description}
                          </span>
                        )}
                      </div>
                    </SelectItem>
                  ))}
                  <SelectItem value={TEMPLATE_BLANK} textValue="Em branco">
                    <div className="flex flex-col gap-0.5 py-0.5">
                      <span className="text-sm font-medium leading-tight">Em branco</span>
                      <span className="text-[11px] leading-tight text-muted-foreground">
                        Começar do zero
                      </span>
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
              {form.template_id && form.template_id !== TEMPLATE_BLANK && (
                <p className="text-[11px] leading-relaxed text-muted-foreground/80">
                  A proposta abrirá com o cabeçalho e as fases já preenchidas.
                  Você só ajusta o que for diferente.
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label
                htmlFor="client_id"
                className="text-[10px] uppercase tracking-widest text-muted-foreground"
              >
                Cliente
              </Label>
              <Select
                value={form.client_id}
                onValueChange={(v) => setForm((f) => ({ ...f, client_id: v }))}
              >
                <SelectTrigger id="client_id">
                  <SelectValue placeholder="Selecione um cliente" />
                </SelectTrigger>
                <SelectContent>
                  {clients.length === 0 ? (
                    <div className="px-2 py-1.5 text-xs text-muted-foreground">
                      Nenhum cliente cadastrado
                    </div>
                  ) : (
                    clients.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.company}
                        {c.name && c.name !== c.company ? ` · ${c.name}` : ''}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label
                htmlFor="title"
                className="text-[10px] uppercase tracking-widest text-muted-foreground"
              >
                Título
              </Label>
              <Input
                id="title"
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                placeholder="Identidade Visual — 2026"
                autoFocus
              />
            </div>

            <div className="space-y-1.5">
              <Label
                htmlFor="valid_until"
                className="text-[10px] uppercase tracking-widest text-muted-foreground"
              >
                Validade <span className="text-muted-foreground/60">(opcional)</span>
              </Label>
              <DatePicker
                value={parseIsoDate(form.valid_until)}
                onChange={(d) =>
                  setForm((f) => ({ ...f, valid_until: toIsoDate(d) ?? '' }))
                }
                placeholder="Sem validade"
                disablePast
              />
            </div>

            {/* Separator */}
            <div className="border-t border-border pt-1">
              <div className="mb-2 text-[10px] uppercase tracking-widest text-muted-foreground">
                Personalização com IA <span className="text-muted-foreground/60">(opcional)</span>
              </div>
            </div>

            {/* Addressee override — sobrescreve o contato primário só
                pra esta geração. Útil quando a proposta vai pra alguém
                específico que não é (ou não deveria ser) o primário
                cadastrado. Vazio = usa contato primário (default). */}
            <div className="space-y-1.5">
              <Label
                htmlFor="addressee_name"
                className="text-[10px] uppercase tracking-widest text-muted-foreground"
              >
                Para quem é a abertura?
              </Label>
              <Input
                id="addressee_name"
                value={form.addressee_name}
                onChange={(e) =>
                  setForm((f) => ({ ...f, addressee_name: e.target.value }))
                }
                placeholder="Ex: Gabriel — usa o contato principal se vazio"
              />
            </div>

            <div className="space-y-1.5">
              <Label
                htmlFor="context"
                className="text-[10px] uppercase tracking-widest text-muted-foreground"
              >
                Contexto
              </Label>
              <textarea
                id="context"
                value={form.context}
                onChange={(e) => setForm((f) => ({ ...f, context: e.target.value }))}
                placeholder="Notas da reunião, transcrição, ou qualquer detalhe extra sobre o projeto…"
                rows={3}
                className="flex w-full resize-y rounded-md border border-border bg-secondary px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-ring/30 focus:border-primary/30 transition-all duration-150"
              />
            </div>

            {form.template_id !== TEMPLATE_BLANK && form.client_id && (
              <p className="text-[11px] leading-relaxed text-success/90">
                ✦ A IA usará os dados do cliente automaticamente (site, redes, perfil) {form.context.trim() && 'e o contexto acima'}.
              </p>
            )}

            <DialogFooter className="!p-0 !pt-2">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setShowNew(false)}
                disabled={saving || generating}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={saving || generating}>
                {generating ? 'Personalizando…' : saving ? 'Criando…' : form.client_id && form.template_id !== TEMPLATE_BLANK ? 'Criar com IA' : 'Criar rascunho'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
