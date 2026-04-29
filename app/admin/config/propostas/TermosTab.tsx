'use client'

import * as React from 'react'
import {
  Copy,
  FileText,
  Loader2,
  MoreHorizontal,
  Pencil,
  Plus,
  Receipt,
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
import type { TermsPreset } from '@/lib/terms-presets'

type ToastFn = (
  message: string,
  type?: 'success' | 'error' | 'info',
  duration?: number,
) => void

interface TermosTabProps {
  toast: ToastFn
}

/**
 * Aba "Termos" — biblioteca de presets de termos e condições.
 *
 * Mesma estrutura do PagamentosTab (v0.10.85): list + dialog de
 * edição combinando create/edit + IA builder em dialog separado.
 *
 * Diff principal: o conteúdo é body_markdown (TEXT) em vez de
 * payment_terms[]. Editor é um <textarea> grande em vez de UI
 * de lista estruturada.
 */
export function TermosTab({ toast }: TermosTabProps) {
  const [presets, setPresets] = React.useState<TermsPreset[]>([])
  const [loading, setLoading] = React.useState(true)

  const [editOpen, setEditOpen] = React.useState(false)
  const [editingId, setEditingId] = React.useState<string | null>(null)
  const [saving, setSaving] = React.useState(false)
  const [form, setForm] = React.useState<{
    name: string
    description: string
    type: string
    is_default: boolean
    body_markdown: string
  }>({
    name: '',
    description: '',
    type: '',
    is_default: false,
    body_markdown: '',
  })

  const [confirmDelete, setConfirmDelete] = React.useState<TermsPreset | null>(
    null,
  )

  const [aiOpen, setAiOpen] = React.useState(false)
  const [aiName, setAiName] = React.useState('')
  const [aiDescription, setAiDescription] = React.useState('')
  const [aiBuilding, setAiBuilding] = React.useState(false)

  // ─── Load ─────────────────────────────────────────────────────────────
  const load = React.useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/proposal-terms-presets', {
        cache: 'no-store',
      })
      if (res.ok) {
        const data = await res.json()
        setPresets((data.presets ?? []) as TermsPreset[])
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
      body_markdown: '',
    })
    setEditOpen(true)
  }

  function openEdit(p: TermsPreset) {
    setEditingId(p.id)
    setForm({
      name: p.name,
      description: p.description ?? '',
      type: p.type ?? '',
      is_default: p.is_default,
      body_markdown: p.body_markdown ?? '',
    })
    setEditOpen(true)
  }

  async function save() {
    const name = form.name.trim()
    if (!name) {
      toast('Nome é obrigatório', 'error')
      return
    }

    setSaving(true)
    try {
      const url = editingId
        ? `/api/proposal-terms-presets/${editingId}`
        : '/api/proposal-terms-presets'
      const method = editingId ? 'PATCH' : 'POST'
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          description: form.description.trim() || null,
          type: form.type.trim() || null,
          is_default: form.is_default,
          body_markdown: form.body_markdown,
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
      const res = await fetch(`/api/proposal-terms-presets/${id}`, {
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
        `/api/proposal-terms-presets/${id}/duplicate`,
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
        `/api/proposal-terms-presets/${id}/set-default`,
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
      const res = await fetch('/api/proposal-terms-presets/build', {
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
        body_markdown: data.preset.body_markdown ?? '',
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
          Biblioteca de termos e condições reutilizáveis. Aplique em
          modelos de propostas com 1 clique.
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
              <Receipt className="h-9 w-9 opacity-40" />
            </div>
            <div className="mb-2 text-base font-semibold text-foreground">
              Nenhum preset ainda
            </div>
            <div className="text-sm">
              Crie presets reutilizáveis (vigência, propriedade intelectual,
              revisões, cancelamento) ou peça pra IA gerar a partir de uma
              descrição.
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
              Defina nome, descrição e o texto dos termos. Markdown aceito —
              use ## como subtítulos.
            </DialogDescription>
          </DialogHeader>

          <div className="max-h-[60vh] space-y-4 overflow-y-auto px-6 pb-2">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="terms-name" className="text-[10px] uppercase tracking-widest text-muted-foreground">
                  Nome *
                </Label>
                <Input
                  id="terms-name"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="Ex: Padrão B2B, Identidade Visual"
                  disabled={saving}
                  autoFocus
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="terms-type" className="text-[10px] uppercase tracking-widest text-muted-foreground">
                  Tipo
                </Label>
                <Input
                  id="terms-type"
                  value={form.type}
                  onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}
                  placeholder="padrao, identidade, retainer…"
                  disabled={saving}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="terms-description" className="text-[10px] uppercase tracking-widest text-muted-foreground">
                Descrição
              </Label>
              <Input
                id="terms-description"
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
                sem termos definidos)
              </span>
            </label>

            <div className="space-y-1.5 pt-2">
              <Label htmlFor="terms-body" className="text-[10px] uppercase tracking-widest text-muted-foreground">
                Texto (markdown aceito)
              </Label>
              <textarea
                id="terms-body"
                value={form.body_markdown}
                onChange={(e) => setForm((f) => ({ ...f, body_markdown: e.target.value }))}
                rows={14}
                placeholder="## Vigência&#10;&#10;Esta proposta é válida por 30 dias a partir da data de envio.&#10;&#10;## Propriedade intelectual&#10;&#10;Todos os direitos sobre os entregáveis…"
                className={cn(
                  'flex w-full resize-y rounded-md border border-border bg-secondary px-3 py-2.5',
                  'font-mono text-xs text-foreground placeholder:text-muted-foreground/50',
                  'focus:border-primary/30 focus:outline-none focus:ring-2 focus:ring-ring/30',
                )}
                disabled={saving}
              />
              <p className="text-[10px] text-muted-foreground/80">
                Use ## pra subtítulos (Vigência, Propriedade intelectual,
                Revisões, Cancelamento). Frases curtas funcionam melhor.
              </p>
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
              descrição e o texto dos termos. Você revisa antes de salvar.
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
                placeholder="Ex: Padrão B2B"
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
                placeholder="Ex: Termos pra projetos pontuais. Vigência 30 dias, propriedade após pagamento integral, 3 rodadas de revisão inclusas."
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
            ? `O preset "${confirmDelete.name}" será removido. Templates que já o aplicaram mantêm sua cópia dos termos — não há perda nesses templates.`
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
  preset: TermsPreset
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
  const charCount = (preset.body_markdown ?? '').trim().length
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
          <div className="mt-1 flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
            <FileText className="h-2.5 w-2.5" />
            {charCount} {charCount === 1 ? 'caractere' : 'caracteres'}
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
