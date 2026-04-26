'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
  ArrowRight,
  Bot,
  Plus,
  Search,
  Trash2,
  User,
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

import { useToast, ToastContainer } from '@/components/toast'
import { cn } from '@/lib/utils'

interface ClientStats {
  total: number
  concluido: number
  last_at: string | null
}
interface Client {
  id: string
  name: string
  company: string
  email: string
  phone: string
  website: string | null
  analysis: Record<string, unknown> | null
  created_at: string
  stats: ClientStats
}
type Filter = 'all' | 'with_briefing' | 'no_briefing' | 'with_ai'
type SortKey = 'recent' | 'name' | 'briefings'

function SkeletonCard() {
  return (
    <Card className="p-4">
      <div className="flex items-center gap-3">
        <div className="h-9 w-9 shrink-0 animate-pulse rounded-lg bg-muted" />
        <div className="flex-1 space-y-2">
          <div className="h-3 w-2/5 animate-pulse rounded bg-muted" />
          <div className="h-2.5 w-3/5 animate-pulse rounded bg-muted" />
        </div>
        <div className="flex gap-2">
          <div className="h-8 w-9 animate-pulse rounded bg-muted" />
          <div className="h-8 w-9 animate-pulse rounded bg-muted" />
        </div>
      </div>
    </Card>
  )
}

export default function ClientesPage() {
  const router = useRouter()
  const { toasts, toast, remove } = useToast()
  const [clients, setClients] = useState<Client[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<Filter>('all')
  const [sort, setSort] = useState<SortKey>('recent')
  const [showNew, setShowNew] = useState(false)
  const [newForm, setNewForm] = useState({
    name: '',
    company: '',
    email: '',
    phone: '',
    website: '',
  })
  const [saving, setSaving] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [deleteTarget, setDeleteTarget] = useState<Client | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [batchDeleteConfirm, setBatchDeleteConfirm] = useState(false)
  const [batchDeleting, setBatchDeleting] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    const res = await fetch('/api/admin/clients')
    if (res.ok) {
      const d = await res.json()
      setClients(d.clients || [])
    } else if (res.status === 401) {
      router.push('/admin')
    }
    setLoading(false)
  }, [router])

  useEffect(() => {
    load()
  }, [load])

  async function createClient(e: React.FormEvent) {
    e.preventDefault()
    if (!newForm.name || !newForm.company) return
    setSaving(true)
    const res = await fetch('/api/admin/clients', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newForm),
    })
    if (res.ok) {
      const d = await res.json()
      setShowNew(false)
      setNewForm({ name: '', company: '', email: '', phone: '', website: '' })
      toast(`${newForm.company} criado`, 'success')
      router.push(`/admin/clientes/${d.client.id}`)
    } else {
      toast('Erro ao criar cliente', 'error')
    }
    setSaving(false)
  }

  async function deleteClient() {
    if (!deleteTarget) return
    setDeleting(true)
    const res = await fetch(`/api/admin/clients/${deleteTarget.id}`, {
      method: 'DELETE',
    })
    if (res.ok) {
      toast(`${deleteTarget.company} excluído`, 'success')
      setDeleteTarget(null)
      load()
    } else {
      const d = await res.json()
      toast(d.error || 'Erro ao excluir', 'error')
      setDeleteTarget(null)
    }
    setDeleting(false)
  }

  async function batchDelete() {
    const ids = Array.from(selectedIds)
    setBatchDeleting(true)
    const res = await fetch('/api/admin/clients/batch-delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids }),
    })
    if (res.ok) {
      toast(
        `${ids.length} cliente${ids.length > 1 ? 's' : ''} excluído${ids.length > 1 ? 's' : ''}`,
        'success',
      )
      setSelectedIds(new Set())
      setBatchDeleteConfirm(false)
      load()
    } else {
      toast('Erro ao excluir', 'error')
    }
    setBatchDeleting(false)
  }

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const n = new Set(prev)
      if (n.has(id)) n.delete(id)
      else n.add(id)
      return n
    })
  }

  const filterFns: Record<Filter, (c: Client) => boolean> = {
    all: () => true,
    with_briefing: (c) => c.stats.total > 0,
    no_briefing: (c) => c.stats.total === 0,
    with_ai: (c) => !!c.analysis && Object.keys(c.analysis).length > 0,
  }
  const sortFns: Record<SortKey, (a: Client, b: Client) => number> = {
    recent: (a, b) =>
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
    name: (a, b) => a.company.localeCompare(b.company),
    briefings: (a, b) => b.stats.total - a.stats.total,
  }

  const filtered = clients
    .filter(filterFns[filter])
    .filter(
      (c) =>
        !search ||
        [c.company, c.name, c.email].some((v) =>
          v?.toLowerCase().includes(search.toLowerCase()),
        ),
    )
    .sort(sortFns[sort])

  const filterLabels: { key: Filter; label: React.ReactNode; count: number }[] = [
    { key: 'all', label: 'Todos', count: clients.length },
    {
      key: 'with_briefing',
      label: 'Com briefing',
      count: clients.filter(filterFns.with_briefing).length,
    },
    {
      key: 'no_briefing',
      label: 'Sem briefing',
      count: clients.filter(filterFns.no_briefing).length,
    },
    {
      key: 'with_ai',
      label: (
        <span className="inline-flex items-center gap-1">
          Com IA <Bot size={11} />
        </span>
      ),
      count: clients.filter(filterFns.with_ai).length,
    },
  ]

  const newClientFields: {
    label: string
    key: keyof typeof newForm
    placeholder: string
  }[] = [
    { label: 'Empresa *', key: 'company', placeholder: 'Nome da empresa' },
    { label: 'Nome do contato *', key: 'name', placeholder: 'Nome completo' },
    { label: 'Email', key: 'email', placeholder: 'email@empresa.com' },
    { label: 'WhatsApp', key: 'phone', placeholder: '+55 47 99999-9999' },
    { label: 'Site', key: 'website', placeholder: 'https://empresa.com' },
  ]

  return (
    <div className="min-h-screen bg-background">
      <ToastContainer toasts={toasts} remove={remove} />

      <div className="mx-auto max-w-5xl p-6">
        {/* Page header */}
        <div className="mb-6 flex items-center justify-between">
          <h1 className="font-mono text-xl font-bold tracking-tight">
            Clientes
          </h1>
          <Button onClick={() => setShowNew(true)}>
            <Plus className="mr-1.5 h-4 w-4" />
            Novo cliente
          </Button>
        </div>

        {/* Stats */}
        <div className="mb-6 grid grid-cols-3 gap-3">
          {[
            { label: 'Total de clientes', value: clients.length },
            {
              label: 'Com briefing',
              value: clients.filter((c) => c.stats.total > 0).length,
            },
            {
              label: 'Briefings concluídos',
              value: clients.reduce((a, c) => a + c.stats.concluido, 0),
            },
          ].map((s) => (
            <Card key={s.label} className="p-4">
              <div className="font-mono text-2xl font-bold">{s.value}</div>
              <div className="mt-1 text-xs uppercase tracking-wider text-muted-foreground">
                {s.label}
              </div>
            </Card>
          ))}
        </div>

        {/* Search + Sort */}
        <div className="mb-3 flex gap-2">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar empresa, nome ou email..."
              className="pl-9"
            />
          </div>
          <Select value={sort} onValueChange={(v) => setSort(v as SortKey)}>
            <SelectTrigger className="w-44 shrink-0">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="recent">Mais recentes</SelectItem>
              <SelectItem value="name">A → Z</SelectItem>
              <SelectItem value="briefings">Mais briefings</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Filter pills */}
        <div className="mb-4 flex flex-wrap gap-2">
          {filterLabels.map(({ key, label, count }) => (
            <button
              key={key}
              onClick={() => setFilter(key)}
              className={cn(
                'inline-flex items-center gap-1 rounded-full border px-3 py-1.5 text-xs transition-colors',
                filter === key
                  ? 'border-foreground/20 bg-muted font-medium text-foreground'
                  : 'border-border bg-transparent text-muted-foreground hover:bg-muted/40 hover:text-foreground',
              )}
            >
              {label} <span className="opacity-70">({count})</span>
            </button>
          ))}
        </div>

        {/* Batch bar */}
        {selectedIds.size > 0 && (
          <Card className="mb-3 flex flex-wrap items-center justify-between gap-3 border-destructive/30 bg-destructive/5 p-3">
            <span className="text-sm text-muted-foreground">
              <strong className="text-foreground">{selectedIds.size}</strong>{' '}
              selecionado{selectedIds.size > 1 ? 's' : ''}
            </span>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSelectedIds(new Set())}
              >
                Cancelar
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={() => setBatchDeleteConfirm(true)}
              >
                <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                Excluir {selectedIds.size}
              </Button>
            </div>
          </Card>
        )}

        {/* Select all */}
        {!loading && filtered.length > 1 && (
          <div className="mb-3 flex items-center gap-2 px-1">
            <Checkbox
              id="select-all"
              checked={selectedIds.size === filtered.length}
              onCheckedChange={(checked) =>
                checked === true
                  ? setSelectedIds(new Set(filtered.map((c) => c.id)))
                  : setSelectedIds(new Set())
              }
            />
            <Label
              htmlFor="select-all"
              className="cursor-pointer text-xs font-normal text-muted-foreground"
            >
              {selectedIds.size === filtered.length
                ? 'Desmarcar todos'
                : 'Selecionar todos'}{' '}
              ({filtered.length})
            </Label>
          </div>
        )}

        {/* List */}
        {loading ? (
          <div className="flex flex-col gap-2">
            {[1, 2, 3, 4].map((i) => (
              <SkeletonCard key={i} />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-16 text-center text-muted-foreground">
            <User className="mx-auto mb-3 h-10 w-10 opacity-40" />
            <div className="mb-1.5 text-base font-semibold text-foreground">
              {search
                ? 'Nenhum resultado'
                : filter !== 'all'
                ? 'Nenhum cliente neste filtro'
                : 'Nenhum cliente ainda'}
            </div>
            <div className="mb-5 text-sm">
              {!search &&
                filter === 'all' &&
                'Crie seu primeiro cliente para começar'}
            </div>
            {!search && filter === 'all' && (
              <Button onClick={() => setShowNew(true)}>
                <Plus className="mr-1.5 h-4 w-4" />
                Criar primeiro cliente
              </Button>
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {filtered.map((c) => (
              <Card
                key={c.id}
                className={cn(
                  'p-4 transition-colors',
                  selectedIds.has(c.id) && 'border-primary/40 bg-primary/5',
                )}
              >
                <div className="flex items-center gap-3">
                  <Checkbox
                    checked={selectedIds.has(c.id)}
                    onCheckedChange={() => toggleSelect(c.id)}
                  />
                  <div
                    className="flex min-w-0 flex-1 cursor-pointer items-center gap-3"
                    onClick={() => router.push(`/admin/clientes/${c.id}`)}
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 truncate text-sm font-semibold">
                        <span className="truncate">{c.company}</span>
                        {c.analysis &&
                          Object.keys(c.analysis).length > 0 && (
                            <Bot className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                          )}
                      </div>
                      <div className="truncate text-xs text-muted-foreground">
                        {c.name}
                        {c.email && ` · ${c.email}`}
                      </div>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    <div className="min-w-[32px] text-center">
                      <div className="font-mono text-base font-bold">
                        {c.stats.total}
                      </div>
                      <div className="text-[9px] uppercase tracking-wider text-muted-foreground">
                        brief.
                      </div>
                    </div>
                    <div className="min-w-[28px] text-center">
                      <div
                        className={cn(
                          'font-mono text-base font-bold',
                          c.stats.concluido > 0
                            ? 'text-primary'
                            : 'text-muted-foreground',
                        )}
                      >
                        {c.stats.concluido}
                      </div>
                      <div className="text-[9px] uppercase tracking-wider text-muted-foreground">
                        ok
                      </div>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => router.push(`/admin/clientes/${c.id}`)}
                    >
                      Ver
                      <ArrowRight className="ml-1 h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={(e) => {
                        e.stopPropagation()
                        setDeleteTarget(c)
                      }}
                      className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* NEW CLIENT */}
      <Dialog open={showNew} onOpenChange={setShowNew}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Novo cliente</DialogTitle>
          </DialogHeader>
          <form onSubmit={createClient} className="space-y-4">
            {newClientFields.map((f) => (
              <div key={f.key} className="space-y-1.5">
                <Label
                  htmlFor={`field-${f.key}`}
                  className="text-xs uppercase tracking-wider text-muted-foreground"
                >
                  {f.label}
                </Label>
                <Input
                  id={`field-${f.key}`}
                  value={newForm[f.key]}
                  onChange={(e) =>
                    setNewForm((p) => ({ ...p, [f.key]: e.target.value }))
                  }
                  placeholder={f.placeholder}
                />
              </div>
            ))}
            <DialogFooter className="gap-2 pt-2 sm:gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowNew(false)}
                className="flex-1"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={saving || !newForm.name || !newForm.company}
                className="flex-1"
              >
                {saving ? 'Criando...' : 'Criar e ver perfil →'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* DELETE CONFIRM */}
      <Dialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
      >
        <DialogContent className="max-w-md">
          <div className="py-2 text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
              <Trash2 className="h-6 w-6 text-destructive" />
            </div>
            <DialogTitle className="mb-2">Excluir cliente?</DialogTitle>
            <div className="mb-1.5 text-sm font-semibold text-foreground">
              {deleteTarget?.company}
            </div>
            <div className="mb-6 text-xs leading-relaxed text-muted-foreground">
              {deleteTarget && deleteTarget.stats.total > 0
                ? `Este cliente tem ${deleteTarget.stats.total} briefing${deleteTarget.stats.total > 1 ? 's' : ''} que também serão excluídos.`
                : 'Esta ação não pode ser desfeita.'}
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => setDeleteTarget(null)}
                className="flex-1"
              >
                Cancelar
              </Button>
              <Button
                variant="destructive"
                onClick={deleteClient}
                disabled={deleting}
                className="flex-1"
              >
                {deleting ? 'Excluindo...' : 'Excluir'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* BATCH DELETE */}
      <Dialog open={batchDeleteConfirm} onOpenChange={setBatchDeleteConfirm}>
        <DialogContent className="max-w-md">
          <div className="py-2 text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
              <Trash2 className="h-6 w-6 text-destructive" />
            </div>
            <DialogTitle className="mb-2">
              Excluir {selectedIds.size} clientes?
            </DialogTitle>
            <div className="mb-6 text-xs leading-relaxed text-muted-foreground">
              Todos os briefings associados também serão excluídos. Esta ação
              não pode ser desfeita.
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => setBatchDeleteConfirm(false)}
                className="flex-1"
              >
                Cancelar
              </Button>
              <Button
                variant="destructive"
                onClick={batchDelete}
                disabled={batchDeleting}
                className="flex-1"
              >
                {batchDeleting ? 'Excluindo...' : `Excluir ${selectedIds.size}`}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
