'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { FileText, Plus, Send, Eye, CheckCircle2, XCircle, Clock, RefreshCw } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
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

// ─── Helpers ──────────────────────────────────────────────────────────────

interface ClientLite {
  id: string
  name: string
  company: string
  avatar_url: string | null
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

  // Special sentinel meaning "start blank, no template".
  const TEMPLATE_BLANK = '__blank__'

  const [form, setForm] = useState({
    client_id: '',
    title: '',
    valid_until: '',
    template_id: '' as string, // empty until we set the default after templates load
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
          (c: { id: string; name: string; company: string; avatar_url: string | null }) => ({
            id: c.id,
            name: c.name,
            company: c.company,
            avatar_url: c.avatar_url,
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
    // Default to the first default template if available, else blank.
    const defaultTemplate = templates.find((t) => t.is_default) ?? templates[0]
    setForm({
      client_id: '',
      title: '',
      valid_until: '',
      template_id: defaultTemplate?.id ?? TEMPLATE_BLANK,
    })
    setShowNew(true)
  }

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.client_id || !form.title.trim()) {
      toast('Preencha cliente e título', 'error')
      return
    }
    setSaving(true)
    try {
      const res = await fetch('/api/proposals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_id: form.client_id,
          title: form.title.trim(),
          valid_until: form.valid_until || null,
          template_id:
            form.template_id && form.template_id !== TEMPLATE_BLANK
              ? form.template_id
              : null,
        }),
      })
      if (res.ok) {
        const data = await res.json()
        setShowNew(false)
        toast('Proposta criada', 'success')
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
        <div className="mb-6 flex items-center justify-between">
          <h1 className="font-mono text-xl font-bold tracking-tight">Propostas</h1>
          <Button onClick={openNew}>
            <Plus className="mr-1.5 h-4 w-4" />
            Nova proposta
          </Button>
        </div>

        {/* List */}
        {loading ? (
          <div className="flex flex-col gap-2">
            {[1, 2, 3].map((i) => (
              <SkeletonCard key={i} />
            ))}
          </div>
        ) : proposals.length === 0 ? (
          <div className="py-16 text-center text-muted-foreground">
            <FileText className="mx-auto mb-3 h-10 w-10 opacity-40" />
            <div className="mb-1.5 text-base font-semibold text-foreground">
              Nenhuma proposta ainda
            </div>
            <div className="mb-5 text-sm">
              Crie sua primeira proposta para começar
            </div>
            <Button onClick={openNew}>
              <Plus className="mr-1.5 h-4 w-4" />
              Criar primeira proposta
            </Button>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {proposals.map((p) => (
              <Card
                key={p.id}
                className={cn(
                  'group cursor-pointer overflow-hidden p-0 transition-colors',
                  'hover:border-border/70 hover:bg-muted/30',
                )}
                onClick={() => router.push(`/admin/propostas/${p.slug}`)}
              >
                <div className="flex items-center gap-3 px-4 py-3">
                  <div className="flex min-w-0 flex-1 items-center gap-3">
                    <div className="font-mono text-xs font-semibold tabular-nums text-muted-foreground">
                      {formatProposalNumber(p.number, p.version_suffix)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-semibold text-foreground">
                        {p.title}
                      </div>
                      <div className="mt-0.5 truncate text-xs text-muted-foreground">
                        {p.clients?.company ?? '—'}
                      </div>
                    </div>
                  </div>

                  <div className="flex shrink-0 items-center gap-3">
                    <div className="hidden text-right sm:block">
                      <div className="font-mono text-sm font-semibold tabular-nums text-foreground">
                        {fmtCurrency(p.total_amount, p.currency)}
                      </div>
                      <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
                        {p.valid_until ? `válida até ${fmtDate(p.valid_until)}` : 'sem validade'}
                      </div>
                    </div>
                    <StatusBadge status={p.status} />
                  </div>
                </div>
              </Card>
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
                  <SelectValue placeholder="Selecione um modelo" />
                </SelectTrigger>
                <SelectContent>
                  {templates.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
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
                  <SelectItem value={TEMPLATE_BLANK}>
                    <div className="flex flex-col gap-0.5 py-0.5">
                      <span className="text-sm font-medium leading-tight">
                        Em branco
                      </span>
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

            <DialogFooter className="!p-0 !pt-2">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setShowNew(false)}
                disabled={saving}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? 'Criando…' : 'Criar rascunho'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
