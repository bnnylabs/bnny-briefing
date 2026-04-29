'use client'

import * as React from 'react'
import {
  Copy,
  ListChecks,
  Loader2,
  MoreHorizontal,
  Pencil,
  Plus,
  Sparkles,
  Star,
  Trash2,
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
import type { NextStepsPreset } from '@/lib/next-steps-presets'

type ToastFn = (
  message: string,
  type?: 'success' | 'error' | 'info',
  duration?: number,
) => void

interface ProximosPassosTabProps {
  toast: ToastFn
}

/**
 * Aba "Próximos passos" — biblioteca de presets de passos
 * pós-aprovação. Mesma estrutura do PagamentosTab/TermosTab, mas
 * o conteúdo é items[] (string[]) com editor de lista numerada.
 */
export function ProximosPassosTab({ toast }: ProximosPassosTabProps) {
  const [presets, setPresets] = React.useState<NextStepsPreset[]>([])
  const [loading, setLoading] = React.useState(true)

  const [editOpen, setEditOpen] = React.useState(false)
  const [editingId, setEditingId] = React.useState<string | null>(null)
  const [saving, setSaving] = React.useState(false)
  const [form, setForm] = React.useState<{
    name: string
    description: string
    type: string
    is_default: boolean
    items: string[]
  }>({
    name: '',
    description: '',
    type: '',
    is_default: false,
    items: [],
  })

  const [confirmDelete, setConfirmDelete] =
    React.useState<NextStepsPreset | null>(null)

  const [aiOpen, setAiOpen] = React.useState(false)
  const [aiName, setAiName] = React.useState('')
  const [aiDescription, setAiDescription] = React.useState('')
  const [aiBuilding, setAiBuilding] = React.useState(false)

  const load = React.useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/proposal-next-steps-presets', {
        cache: 'no-store',
      })
      if (res.ok) {
        const data = await res.json()
        setPresets((data.presets ?? []) as NextStepsPreset[])
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

  function openCreate() {
    setEditingId(null)
    setForm({
      name: '',
      description: '',
      type: '',
      is_default: false,
      items: [''],
    })
    setEditOpen(true)
  }

  function openEdit(p: NextStepsPreset) {
    setEditingId(p.id)
    setForm({
      name: p.name,
      description: p.description ?? '',
      type: p.type ?? '',
      is_default: p.is_default,
      items: p.items?.length ? [...p.items] : [''],
    })
    setEditOpen(true)
  }

  // Item mutators
  function updateItem(idx: number, value: string) {
    setForm((f) => ({
      ...f,
      items: f.items.map((it, i) => (i === idx ? value : it)),
    }))
  }
  function removeItem(idx: number) {
    setForm((f) => ({
      ...f,
      items: f.items.filter((_, i) => i !== idx),
    }))
  }
  function addItem() {
    setForm((f) => ({ ...f, items: [...f.items, ''] }))
  }

  async function save() {
    const name = form.name.trim()
    if (!name) {
      toast('Nome é obrigatório', 'error')
      return
    }
    // Filter empty items before persisting (defensive — same approach
    // as v0.10.83 for empty payment terms).
    const cleanedItems = form.items.map((s) => s.trim()).filter(Boolean)

    setSaving(true)
    try {
      const url = editingId
        ? `/api/proposal-next-steps-presets/${editingId}`
        : '/api/proposal-next-steps-presets'
      const method = editingId ? 'PATCH' : 'POST'
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          description: form.description.trim() || null,
          type: form.type.trim() || null,
          is_default: form.is_default,
          items: cleanedItems,
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

  async function deletePreset(id: string) {
    try {
      const res = await fetch(`/api/proposal-next-steps-presets/${id}`, {
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

  async function duplicatePreset(id: string) {
    try {
      const res = await fetch(
        `/api/proposal-next-steps-presets/${id}/duplicate`,
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
        `/api/proposal-next-steps-presets/${id}/set-default`,
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
      const res = await fetch('/api/proposal-next-steps-presets/build', {
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
      setEditingId(null)
      setForm({
        name: data.preset.name ?? '',
        description: data.preset.description ?? '',
        type: data.preset.type ?? '',
        is_default: false,
        items: data.preset.items?.length ? data.preset.items : [''],
      })
      setAiOpen(false)
      setEditOpen(true)
    } catch (e) {
      toast(`Erro de rede: ${(e as Error).message}`, 'error')
    } finally {
      setAiBuilding(false)
    }
  }

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
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">
          Biblioteca de checklists pós-aprovação reutilizáveis. Aplique em
          modelos de propostas.
        </p>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={openAi}
            className="gap-1.5"
          >
            <Sparkles className="h-3.5 w-3.5" />
            Construir com IA
          </Button>
          <Button size="sm" onClick={openCreate} className="gap-1.5">
            <Plus className="h-3.5 w-3.5" />
            Novo preset
          </Button>
        </div>
      </div>

      {presets.length === 0 ? (
        <Card className="p-12">
          <div className="mx-auto max-w-md text-center text-muted-foreground">
            <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-muted/40">
              <ListChecks className="h-9 w-9 opacity-40" />
            </div>
            <div className="mb-2 text-base font-semibold text-foreground">
              Nenhum preset ainda
            </div>
            <div className="text-sm">
              Crie checklists reutilizáveis (kickoff, acessos, cronograma)
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
              Defina nome, descrição e os passos pós-aprovação. Cada
              passo é uma linha curta e concreta.
            </DialogDescription>
          </DialogHeader>

          <div className="max-h-[60vh] space-y-4 overflow-y-auto px-6 pb-2">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="ns-name" className="text-[10px] uppercase tracking-widest text-muted-foreground">
                  Nome *
                </Label>
                <Input
                  id="ns-name"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="Ex: Kickoff Padrão"
                  disabled={saving}
                  autoFocus
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ns-type" className="text-[10px] uppercase tracking-widest text-muted-foreground">
                  Tipo
                </Label>
                <Input
                  id="ns-type"
                  value={form.type}
                  onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}
                  placeholder="padrao, identidade, retainer…"
                  disabled={saving}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ns-description" className="text-[10px] uppercase tracking-widest text-muted-foreground">
                Descrição
              </Label>
              <Input
                id="ns-description"
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
              <span>
                Marcar como padrão (usado automaticamente em novas propostas
                sem próximos passos definidos)
              </span>
            </label>

            {/* Items list editor */}
            <div className="space-y-2 pt-2">
              <Label className="text-[10px] uppercase tracking-widest text-muted-foreground">
                Passos
              </Label>
              {form.items.length === 0 ? (
                <p className="text-xs italic text-muted-foreground/70">
                  Nenhum passo ainda — adicione abaixo.
                </p>
              ) : (
                <div className="space-y-2">
                  {form.items.map((item, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <span className="shrink-0 font-mono text-[10px] tabular-nums text-muted-foreground/70">
                        {String(i + 1).padStart(2, '0')}.
                      </span>
                      <Input
                        value={item}
                        onChange={(e) => updateItem(i, e.target.value)}
                        placeholder="Ex: Reunião de kickoff em até 48h após aprovação"
                        disabled={saving}
                      />
                      <IconButton
                        icon={<Trash2 className="h-3.5 w-3.5" />}
                        label="Remover passo"
                        size="icon-sm"
                        variant="ghost"
                        className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                        onClick={() => removeItem(i)}
                        disabled={saving}
                      />
                    </div>
                  ))}
                </div>
              )}
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={addItem}
                disabled={saving}
                className="text-xs"
              >
                <Plus className="mr-1 h-3 w-3" />
                Adicionar passo
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

      {/* AI builder */}
      <Dialog open={aiOpen} onOpenChange={(o) => !aiBuilding && setAiOpen(o)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-4 w-4" />
              Construir preset com IA
            </DialogTitle>
            <DialogDescription>
              Descreva o preset em linguagem natural. A IA monta nome,
              descrição e a lista de passos.
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
                placeholder="Ex: Identidade Visual"
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
                placeholder="Ex: Pós aprovação de projetos pontuais. Reunião kickoff em 48h, acesso ao Notion, primeira parcela cobrada e cronograma semanal por email."
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

      <ConfirmDialog
        open={!!confirmDelete}
        onOpenChange={(o) => !o && setConfirmDelete(null)}
        title="Remover preset?"
        description={
          confirmDelete
            ? `O preset "${confirmDelete.name}" será removido. Templates que já o aplicaram mantêm sua cópia da lista — não há perda nesses templates.`
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

interface PresetRowProps {
  preset: NextStepsPreset
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
  const itemCount = (preset.items ?? []).filter((s) => s?.trim()).length
  return (
    <li>
      <Card
        className={cn(
          'flex items-center gap-3 p-4 transition-colors hover:border-primary/30',
          preset.is_default && 'border-primary/40 bg-primary/5',
        )}
      >
        <button type="button" onClick={onEdit} className="flex-1 text-left">
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
            {itemCount} {itemCount === 1 ? 'passo' : 'passos'}
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
