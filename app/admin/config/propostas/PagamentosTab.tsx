'use client'

import * as React from 'react'
import {
  Copy,
  CreditCard,
  Loader2,
  MoreHorizontal,
  Pencil,
  Percent,
  Plus,
  Sparkles,
  Star,
  Trash2,
  X,
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { IconButton } from '@/components/ui/icon-button'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'
import type { PaymentTerm } from '@/lib/proposal-types'
import type { PaymentPreset } from '@/lib/payment-presets'

type ToastFn = (
  message: string,
  type?: 'success' | 'error' | 'info',
  duration?: number,
) => void

interface PagamentosTabProps {
  toast: ToastFn
}

/**
 * Aba "Pagamentos" — biblioteca de presets de condições de pagamento.
 *
 * v0.10.85 inicial: CRUD básico inline (sem rota separada como Modelos).
 * Cada preset tem name, description, type, payment_terms[]. Dialog de
 * edição lida com criação E edição (mesma estrutura).
 *
 * IA builder: dialog separado com textarea + "Construir com IA" — owner
 * descreve o preset em linguagem natural, IA preenche o draft, owner
 * revisa e salva.
 *
 * v0.10.86 (próximo) vai adicionar o "Aplicar preset" no editor de
 * modelo e na proposta individual.
 */
export function PagamentosTab({ toast }: PagamentosTabProps) {
  const [presets, setPresets] = React.useState<PaymentPreset[]>([])
  const [loading, setLoading] = React.useState(true)

  // Edit dialog (handles create + edit). When `editingId` is null, it's
  // create mode; otherwise edit mode. Form holds the working state.
  const [editOpen, setEditOpen] = React.useState(false)
  const [editingId, setEditingId] = React.useState<string | null>(null)
  const [saving, setSaving] = React.useState(false)
  const [form, setForm] = React.useState<{
    name: string
    description: string
    type: string
    is_default: boolean
    payment_terms: PaymentTerm[]
  }>({
    name: '',
    description: '',
    type: '',
    is_default: false,
    payment_terms: [],
  })

  // Delete confirm
  const [confirmDelete, setConfirmDelete] = React.useState<PaymentPreset | null>(
    null,
  )

  // AI builder dialog
  const [aiOpen, setAiOpen] = React.useState(false)
  const [aiName, setAiName] = React.useState('')
  const [aiDescription, setAiDescription] = React.useState('')
  const [aiBuilding, setAiBuilding] = React.useState(false)

  // ─── Load ─────────────────────────────────────────────────────────────
  const load = React.useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/proposal-payment-presets', {
        cache: 'no-store',
      })
      if (res.ok) {
        const data = await res.json()
        setPresets((data.presets ?? []) as PaymentPreset[])
      } else {
        toast('Erro ao carregar presets', 'error')
      }
    } catch {
      toast('Erro de rede', 'error')
    } finally {
      setLoading(false)
    }
  }, [toast])

  React.useEffect(() => {
    load()
  }, [load])

  // ─── Open dialogs ─────────────────────────────────────────────────────
  function openCreate() {
    setEditingId(null)
    setForm({
      name: '',
      description: '',
      type: '',
      is_default: false,
      payment_terms: [
        { type: 'text', label: '', description: '' },
      ],
    })
    setEditOpen(true)
  }

  function openEdit(p: PaymentPreset) {
    setEditingId(p.id)
    setForm({
      name: p.name,
      description: p.description ?? '',
      type: p.type ?? '',
      is_default: p.is_default,
      payment_terms: p.payment_terms ?? [],
    })
    setEditOpen(true)
  }

  // ─── Term mutations inside the dialog ─────────────────────────────────
  function addTerm() {
    setForm((f) => ({
      ...f,
      payment_terms: [
        ...f.payment_terms,
        { type: 'text', label: '', description: '' },
      ],
    }))
  }
  function removeTerm(i: number) {
    setForm((f) => ({
      ...f,
      payment_terms: f.payment_terms.filter((_, idx) => idx !== i),
    }))
  }
  function updateTerm(i: number, patch: Partial<PaymentTerm>) {
    setForm((f) => {
      const next = [...f.payment_terms]
      next[i] = { ...next[i], ...patch } as PaymentTerm
      return { ...f, payment_terms: next }
    })
  }

  // ─── Save ─────────────────────────────────────────────────────────────
  async function save() {
    const name = form.name.trim()
    if (!name) {
      toast('Nome é obrigatório', 'error')
      return
    }
    // Filter out empty payment terms before persisting (same defensive
    // approach as the PDF renderer in v0.10.83 — don't store empty rows).
    const cleaned = form.payment_terms.filter((t) => {
      const hasLabel = !!t.label?.trim()
      const hasDesc = !!t.description?.trim()
      return hasLabel || hasDesc
    })

    setSaving(true)
    try {
      const url = editingId
        ? `/api/proposal-payment-presets/${editingId}`
        : '/api/proposal-payment-presets'
      const method = editingId ? 'PATCH' : 'POST'
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          description: form.description.trim() || null,
          type: form.type.trim() || null,
          is_default: form.is_default,
          payment_terms: cleaned,
        }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        toast(data.error || 'Erro ao salvar', 'error')
        setSaving(false)
        return
      }
      toast(editingId ? 'Preset atualizado' : 'Preset criado', 'success')
      setEditOpen(false)
      await load()
    } catch (e) {
      toast(`Erro de rede: ${(e as Error).message}`, 'error')
    } finally {
      setSaving(false)
    }
  }

  // ─── Delete ───────────────────────────────────────────────────────────
  async function deletePreset(id: string) {
    try {
      const res = await fetch(`/api/proposal-payment-presets/${id}`, {
        method: 'DELETE',
      })
      if (!res.ok) {
        toast('Erro ao remover', 'error')
        return
      }
      toast('Preset removido', 'success')
      await load()
    } catch {
      toast('Erro de rede', 'error')
    } finally {
      setConfirmDelete(null)
    }
  }

  // ─── Duplicate / Set default ──────────────────────────────────────────
  async function duplicatePreset(id: string) {
    try {
      const res = await fetch(
        `/api/proposal-payment-presets/${id}/duplicate`,
        { method: 'POST' },
      )
      if (!res.ok) {
        toast('Erro ao duplicar', 'error')
        return
      }
      toast('Preset duplicado', 'success')
      await load()
    } catch {
      toast('Erro de rede', 'error')
    }
  }

  async function setDefaultPreset(id: string) {
    try {
      const res = await fetch(
        `/api/proposal-payment-presets/${id}/set-default`,
        { method: 'POST' },
      )
      if (!res.ok) {
        toast('Erro ao marcar como padrão', 'error')
        return
      }
      toast('Marcado como padrão', 'success')
      await load()
    } catch {
      toast('Erro de rede', 'error')
    }
  }

  // ─── AI builder ───────────────────────────────────────────────────────
  function openAi() {
    setAiName('')
    setAiDescription('')
    setAiOpen(true)
  }

  async function buildWithAi() {
    const description = aiDescription.trim()
    if (!description) {
      toast('Descreva o preset', 'error')
      return
    }
    setAiBuilding(true)
    try {
      const res = await fetch('/api/proposal-payment-presets/build', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          description,
          name: aiName.trim() || undefined,
        }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        toast(data.error || 'IA indisponível', 'error')
        setAiBuilding(false)
        return
      }
      const data = await res.json()
      // Pre-fill the edit form with the IA's output and let the owner
      // review/tweak before saving. This matches the ModelosTab pattern
      // (build → review → confirm).
      setEditingId(null)
      setForm({
        name: data.preset.name ?? '',
        description: data.preset.description ?? '',
        type: data.preset.type ?? '',
        is_default: false,
        payment_terms: data.preset.payment_terms ?? [],
      })
      setAiOpen(false)
      setEditOpen(true)
    } catch (e) {
      toast(`Erro de rede: ${(e as Error).message}`, 'error')
    } finally {
      setAiBuilding(false)
    }
  }

  // ─── Render ───────────────────────────────────────────────────────────
  if (loading) {
    return (
      <Card className="p-12">
        <div className="flex items-center justify-center text-sm text-muted-foreground">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          Carregando…
        </div>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      {/* Header actions */}
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">
          Biblioteca de condições de pagamento reutilizáveis. Aplique em
          modelos ou em propostas individuais.
        </p>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={openAi} className="gap-1.5">
            <Sparkles className="h-3.5 w-3.5" />
            Construir com IA
          </Button>
          <Button size="sm" onClick={openCreate} className="gap-1.5">
            <Plus className="h-3.5 w-3.5" />
            Novo preset
          </Button>
        </div>
      </div>

      {/* Empty state */}
      {presets.length === 0 ? (
        <Card className="p-12">
          <div className="mx-auto max-w-md text-center text-muted-foreground">
            <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-muted/40">
              <CreditCard className="h-9 w-9 opacity-40" />
            </div>
            <div className="mb-2 text-base font-semibold text-foreground">
              Nenhum preset ainda
            </div>
            <div className="text-sm">
              Crie presets reutilizáveis (à vista, parcelado, mensal etc.)
              ou peça pra IA gerar a partir de uma descrição.
            </div>
          </div>
        </Card>
      ) : (
        <ul className="space-y-2">
          {presets.map((p) => (
            <PresetRow
              key={p.id}
              preset={p}
              onEdit={() => openEdit(p)}
              onDuplicate={() => duplicatePreset(p.id)}
              onSetDefault={() => setDefaultPreset(p.id)}
              onDelete={() => setConfirmDelete(p)}
            />
          ))}
        </ul>
      )}

      {/* Edit dialog */}
      <Dialog open={editOpen} onOpenChange={(o) => !saving && setEditOpen(o)}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {editingId ? 'Editar preset' : 'Novo preset'}
            </DialogTitle>
            <DialogDescription>
              Defina nome, descrição e as opções de pagamento. Cada opção
              pode ter desconto opcional.
            </DialogDescription>
          </DialogHeader>

          <div className="max-h-[60vh] space-y-4 overflow-y-auto px-6 pb-2">
            {/* Metadata */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="preset-name" className="text-[10px] uppercase tracking-widest text-muted-foreground">
                  Nome *
                </Label>
                <Input
                  id="preset-name"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="Ex: Avulso, Mensal 12x"
                  disabled={saving}
                  autoFocus
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="preset-type" className="text-[10px] uppercase tracking-widest text-muted-foreground">
                  Tipo
                </Label>
                <Input
                  id="preset-type"
                  value={form.type}
                  onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}
                  placeholder="avulso, mensal, anual…"
                  disabled={saving}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="preset-description" className="text-[10px] uppercase tracking-widest text-muted-foreground">
                Descrição
              </Label>
              <Input
                id="preset-description"
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                placeholder="Quando usar este preset"
                disabled={saving}
              />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={form.is_default}
                onCheckedChange={(v) => setForm((f) => ({ ...f, is_default: !!v }))}
                disabled={saving}
              />
              <span>Marcar como padrão (usado automaticamente em novas propostas sem preset escolhido)</span>
            </label>

            {/* Payment terms editor */}
            <div className="space-y-2 pt-2">
              <Label className="text-[10px] uppercase tracking-widest text-muted-foreground">
                Opções de pagamento
              </Label>
              {form.payment_terms.length === 0 ? (
                <p className="text-xs italic text-muted-foreground/70">
                  Nenhuma opção adicionada ainda.
                </p>
              ) : (
                <div className="space-y-2">
                  {form.payment_terms.map((t, i) => {
                    const tt = t as Extract<PaymentTerm, { type: 'text' }>
                    return (
                      <div
                        key={i}
                        className="space-y-2 rounded-md border border-border bg-muted/30 p-3"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                            Opção {i + 1}
                          </span>
                          <button
                            type="button"
                            onClick={() => removeTerm(i)}
                            className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-destructive"
                            aria-label="Remover"
                            disabled={saving}
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </div>
                        <Input
                          value={tt.label ?? ''}
                          onChange={(e) => updateTerm(i, { label: e.target.value })}
                          placeholder="Label — Ex: À vista, Parcelado em 2x"
                          className="text-sm"
                          disabled={saving}
                        />
                        <Input
                          value={tt.description ?? ''}
                          onChange={(e) => updateTerm(i, { description: e.target.value })}
                          placeholder="Descrição — Ex: 50% de entrada, 50% na entrega final."
                          className="text-sm"
                          disabled={saving}
                        />
                        <div className="flex items-center gap-2">
                          <Percent size={12} className="text-muted-foreground" />
                          <Input
                            type="number"
                            min="0"
                            max="100"
                            value={tt.discount_percent ?? ''}
                            onChange={(e) => {
                              const val = e.target.value === '' ? undefined : Number(e.target.value)
                              updateTerm(i, { discount_percent: val })
                            }}
                            placeholder="Desconto % (opcional)"
                            className="w-40 text-xs tabular-nums"
                            disabled={saving}
                          />
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addTerm}
                disabled={saving}
                className="gap-1.5"
              >
                <Plus className="h-3.5 w-3.5" />
                Adicionar opção
              </Button>
            </div>
          </div>

          <DialogFooter className="p-6 pt-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setEditOpen(false)}
              disabled={saving}
            >
              Cancelar
            </Button>
            <Button onClick={save} disabled={saving} className="gap-2">
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              {saving ? 'Salvando…' : editingId ? 'Salvar' : 'Criar preset'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* AI builder dialog */}
      <Dialog open={aiOpen} onOpenChange={(o) => !aiBuilding && setAiOpen(o)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-4 w-4" />
              Construir preset com IA
            </DialogTitle>
            <DialogDescription>
              Descreva o preset em linguagem natural. A IA monta nome,
              descrição e as opções de pagamento. Você revisa antes de salvar.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 px-6 pb-2">
            <div className="space-y-1.5">
              <Label htmlFor="ai-name" className="text-[10px] uppercase tracking-widest text-muted-foreground">
                Nome (opcional)
              </Label>
              <Input
                id="ai-name"
                value={aiName}
                onChange={(e) => setAiName(e.target.value)}
                placeholder="Ex: Mensal 12x"
                disabled={aiBuilding}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ai-description" className="text-[10px] uppercase tracking-widest text-muted-foreground">
                Descrição *
              </Label>
              <textarea
                id="ai-description"
                value={aiDescription}
                onChange={(e) => setAiDescription(e.target.value)}
                placeholder="Ex: Pra projetos avulsos. À vista com 10% off ou parcelado em 2x sem juros (50% entrada, 50% entrega)."
                rows={4}
                className="flex w-full resize-y rounded-md border border-border bg-secondary px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-ring/30 transition-all"
                disabled={aiBuilding}
              />
            </div>
          </div>
          <DialogFooter className="p-6 pt-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setAiOpen(false)}
              disabled={aiBuilding}
            >
              Cancelar
            </Button>
            <Button onClick={buildWithAi} disabled={aiBuilding} className="gap-2">
              {aiBuilding ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="h-4 w-4" />
              )}
              {aiBuilding ? 'Construindo…' : 'Construir'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <ConfirmDialog
        open={!!confirmDelete}
        onOpenChange={(o) => !o && setConfirmDelete(null)}
        title="Remover preset?"
        description={
          confirmDelete
            ? `O preset "${confirmDelete.name}" será removido. Propostas que já aplicaram este preset mantêm sua cópia das condições — não há perda nessas propostas.`
            : ''
        }
        confirmLabel="Remover"
        cancelLabel="Cancelar"
        variant="destructive"
        onConfirm={() => {
          if (confirmDelete) deletePreset(confirmDelete.id)
        }}
      />
    </div>
  )
}

// ─── Row ─────────────────────────────────────────────────────────────────

interface PresetRowProps {
  preset: PaymentPreset
  onEdit: () => void
  onDuplicate: () => void
  onSetDefault: () => void
  onDelete: () => void
}

function PresetRow({
  preset,
  onEdit,
  onDuplicate,
  onSetDefault,
  onDelete,
}: PresetRowProps) {
  const termCount = (preset.payment_terms ?? []).filter((t) => {
    const hasLabel = !!t.label?.trim()
    const hasDesc = !!t.description?.trim()
    return hasLabel || hasDesc
  }).length
  return (
    <li>
      <Card
        className={cn(
          'flex items-center gap-3 p-4 transition-colors hover:border-primary/30',
          preset.is_default && 'border-primary/40 bg-primary/5',
        )}
      >
        <button
          type="button"
          onClick={onEdit}
          className="flex-1 text-left"
        >
          <div className="flex items-center gap-1.5">
            <span className="font-mono text-sm font-bold text-foreground">
              {preset.name}
            </span>
            {preset.is_default && (
              <Badge variant="outline" className="gap-1 border-primary/30 bg-primary/10 text-[10px]">
                <Star className="h-2.5 w-2.5 fill-current" />
                Padrão
              </Badge>
            )}
            {preset.type && (
              <Badge variant="secondary" className="font-mono text-[10px]">
                {preset.type}
              </Badge>
            )}
          </div>
          <div className="mt-0.5 text-xs text-muted-foreground">
            {preset.description || (
              <span className="italic opacity-60">Sem descrição</span>
            )}
          </div>
          <div className="mt-1 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
            {termCount} {termCount === 1 ? 'opção' : 'opções'}
          </div>
        </button>

        <div className="flex items-center gap-1">
          <IconButton
            icon={<Pencil className="h-3.5 w-3.5" />}
            label="Editar"
            size="sm"
            onClick={onEdit}
          />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <IconButton
                icon={<MoreHorizontal className="h-4 w-4" />}
                label="Mais"
                size="sm"
              />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              {!preset.is_default && (
                <DropdownMenuItem onClick={onSetDefault} className="cursor-pointer">
                  <Star className="mr-2 h-3.5 w-3.5" />
                  Marcar como padrão
                </DropdownMenuItem>
              )}
              <DropdownMenuItem onClick={onDuplicate} className="cursor-pointer">
                <Copy className="mr-2 h-3.5 w-3.5" />
                Duplicar
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={onDelete}
                className="cursor-pointer text-destructive"
              >
                <Trash2 className="mr-2 h-3.5 w-3.5" />
                Remover
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </Card>
    </li>
  )
}
