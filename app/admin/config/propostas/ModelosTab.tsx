'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import {
  Copy,
  FileText,
  MoreHorizontal,
  Pencil,
  Plus,
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
import type { ProposalTemplate } from '@/lib/proposal-types'

type ToastFn = (message: string, type?: 'success' | 'error' | 'info', duration?: number) => void

interface ModelosTabProps {
  toast: ToastFn
}

/**
 * Modelos (templates) tab — list view + metadata dialog.
 *
 * Block content editing happens on a separate route /admin/config/propostas/
 * modelos/[id] because the editor is heavy. This tab is the lobby: it
 * handles create, rename/redescribe (metadata only), set-default, duplicate,
 * delete, and routes to the block editor for full editing.
 */
export function ModelosTab({ toast }: ModelosTabProps) {
  const router = useRouter()
  const [templates, setTemplates] = React.useState<ProposalTemplate[]>([])
  const [loading, setLoading] = React.useState(true)

  // Metadata dialog state — same dialog handles create + rename/redescribe
  const [metaOpen, setMetaOpen] = React.useState(false)
  const [metaMode, setMetaMode] = React.useState<'create' | 'edit'>('create')
  const [metaSaving, setMetaSaving] = React.useState(false)
  const [metaForm, setMetaForm] = React.useState<{
    id: string | null
    name: string
    description: string
    type: string
    is_default: boolean
  }>({ id: null, name: '', description: '', type: '', is_default: false })

  // Delete confirm dialog
  const [confirmDelete, setConfirmDelete] = React.useState<ProposalTemplate | null>(null)

  // ─── Load ─────────────────────────────────────────────────────────────
  const load = React.useCallback(async () => {
    setLoading(true)
    const res = await fetch('/api/proposal-templates', { cache: 'no-store' })
    if (res.ok) {
      const data = await res.json()
      setTemplates((data.templates ?? []) as ProposalTemplate[])
    }
    setLoading(false)
  }, [])

  React.useEffect(() => {
    load()
  }, [load])

  // ─── Open dialog ───────────────────────────────────────────────────────
  function openCreate() {
    setMetaMode('create')
    setMetaForm({ id: null, name: '', description: '', type: '', is_default: false })
    setMetaOpen(true)
  }

  function openEditMeta(t: ProposalTemplate) {
    setMetaMode('edit')
    setMetaForm({
      id: t.id,
      name: t.name,
      description: t.description ?? '',
      type: t.type ?? '',
      is_default: t.is_default,
    })
    setMetaOpen(true)
  }

  // ─── Save metadata ─────────────────────────────────────────────────────
  async function saveMeta() {
    const name = metaForm.name.trim()
    if (!name) {
      toast('Nome é obrigatório', 'error')
      return
    }

    setMetaSaving(true)
    try {
      if (metaMode === 'create') {
        const res = await fetch('/api/proposal-templates', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name,
            description: metaForm.description.trim() || null,
            type: metaForm.type.trim() || null,
            is_default: metaForm.is_default,
          }),
        })
        if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'Falha ao criar')
        const data = await res.json()
        toast('Modelo criado', 'success')
        setMetaOpen(false)
        // Jump straight to the block editor so the owner can start composing
        router.push(`/admin/config/propostas/modelos/${data.template.id}`)
      } else if (metaForm.id) {
        const res = await fetch(`/api/proposal-templates/${metaForm.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name,
            description: metaForm.description.trim() || null,
            type: metaForm.type.trim() || null,
            is_default: metaForm.is_default,
          }),
        })
        if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'Falha ao salvar')
        toast('Modelo atualizado', 'success')
        setMetaOpen(false)
        await load()
      }
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Erro inesperado', 'error')
    } finally {
      setMetaSaving(false)
    }
  }

  // ─── Per-row actions ───────────────────────────────────────────────────
  async function setDefault(id: string) {
    const res = await fetch(`/api/proposal-templates/${id}/set-default`, { method: 'POST' })
    if (res.ok) {
      toast('Modelo definido como padrão', 'success')
      await load()
    } else {
      toast('Falha ao definir padrão', 'error')
    }
  }

  async function duplicate(id: string) {
    const res = await fetch(`/api/proposal-templates/${id}/duplicate`, { method: 'POST' })
    if (res.ok) {
      toast('Modelo duplicado', 'success')
      await load()
    } else {
      toast('Falha ao duplicar', 'error')
    }
  }

  async function doDelete() {
    if (!confirmDelete) return
    const res = await fetch(`/api/proposal-templates/${confirmDelete.id}`, { method: 'DELETE' })
    if (res.ok) {
      toast('Modelo excluído', 'success')
      setConfirmDelete(null)
      await load()
    } else {
      toast('Falha ao excluir', 'error')
    }
  }

  // ─── Render ────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex h-40 items-center justify-center">
        <div className="spinner" />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold tracking-tight">Modelos de propostas</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Estrutura padrão de blocos copiada quando você cria uma proposta nova
          </p>
        </div>
        <Button size="sm" onClick={openCreate} className="shrink-0">
          <Plus className="mr-1 h-3.5 w-3.5" />
          Novo modelo
        </Button>
      </div>

      {templates.length === 0 ? (
        <Card className="p-10">
          <div className="text-center text-muted-foreground">
            <FileText className="mx-auto mb-3 h-9 w-9 opacity-40" />
            <div className="mb-1 text-sm font-semibold text-foreground">Nenhum modelo</div>
            <div className="mb-4 text-xs">
              Crie um modelo pra reutilizar a estrutura em propostas futuras
            </div>
            <Button size="sm" onClick={openCreate}>
              <Plus className="mr-1 h-3.5 w-3.5" />
              Criar primeiro modelo
            </Button>
          </div>
        </Card>
      ) : (
        <div className="space-y-2">
          {templates.map((t) => (
            <TemplateRow
              key={t.id}
              template={t}
              onEditContent={() => router.push(`/admin/config/propostas/modelos/${t.id}`)}
              onEditMeta={() => openEditMeta(t)}
              onSetDefault={() => setDefault(t.id)}
              onDuplicate={() => duplicate(t.id)}
              onDelete={() => setConfirmDelete(t)}
            />
          ))}
        </div>
      )}

      {/* ─── Metadata dialog (create + edit) ─────────────────────────── */}
      <Dialog open={metaOpen} onOpenChange={setMetaOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{metaMode === 'create' ? 'Novo modelo' : 'Editar modelo'}</DialogTitle>
            <DialogDescription>
              {metaMode === 'create'
                ? 'Define os dados básicos. Em seguida você monta os blocos.'
                : 'Renomeia, redescreve e gerencia o status de padrão.'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 px-6 py-4">
            <FieldGroup label="Nome" required>
              <Input
                value={metaForm.name}
                onChange={(e) => setMetaForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="Identidade Visual"
                autoFocus
              />
            </FieldGroup>
            <FieldGroup
              label="Descrição"
              hint="Aparece no seletor de modelos quando você cria uma proposta"
            >
              <Input
                value={metaForm.description}
                onChange={(e) => setMetaForm((f) => ({ ...f, description: e.target.value }))}
                placeholder="Para projetos de identidade — logo, paleta, tipografia"
              />
            </FieldGroup>
            <FieldGroup
              label="Tipo"
              hint="Etiqueta livre — ex: identidade, social, site, retainer"
            >
              <Input
                value={metaForm.type}
                onChange={(e) => setMetaForm((f) => ({ ...f, type: e.target.value }))}
                placeholder="identidade"
              />
            </FieldGroup>
            <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-border bg-muted/30 p-3 transition-colors hover:bg-muted/50">
              <Checkbox
                checked={metaForm.is_default}
                onCheckedChange={(v) =>
                  setMetaForm((f) => ({ ...f, is_default: v === true }))
                }
                className="mt-0.5"
              />
              <div className="space-y-0.5 text-sm leading-tight">
                <div className="font-medium text-foreground">Definir como padrão</div>
                <div className="text-xs text-muted-foreground">
                  Pré-selecionado ao criar uma proposta nova. Só um modelo pode ser padrão.
                </div>
              </div>
            </label>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMetaOpen(false)} disabled={metaSaving}>
              Cancelar
            </Button>
            <Button onClick={saveMeta} disabled={metaSaving || !metaForm.name.trim()}>
              {metaSaving ? 'Salvando…' : metaMode === 'create' ? 'Criar e abrir editor' : 'Salvar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Delete confirm ──────────────────────────────────────────── */}
      <ConfirmDialog
        open={!!confirmDelete}
        onOpenChange={(o) => {
          if (!o) setConfirmDelete(null)
        }}
        title="Excluir este modelo?"
        description={
          confirmDelete && (
            <>
              <span className="font-medium text-foreground">{confirmDelete.name}</span>{' '}
              será removido permanentemente. Propostas que já usaram este modelo continuam intactas.
            </>
          )
        }
        confirmLabel="Excluir"
        onConfirm={doDelete}
      />
    </div>
  )
}

// ─── Sub-components ─────────────────────────────────────────────────────

interface TemplateRowProps {
  template: ProposalTemplate
  onEditContent: () => void
  onEditMeta: () => void
  onSetDefault: () => void
  onDuplicate: () => void
  onDelete: () => void
}

function TemplateRow({
  template,
  onEditContent,
  onEditMeta,
  onSetDefault,
  onDuplicate,
  onDelete,
}: TemplateRowProps) {
  const blockCount = Array.isArray(template.default_blocks) ? template.default_blocks.length : 0
  const paymentCount = Array.isArray(template.default_payment_terms)
    ? template.default_payment_terms.length
    : 0

  return (
    <Card
      className={cn(
        'group relative cursor-pointer p-4 transition-colors hover:border-foreground/20 hover:bg-muted/30',
      )}
      onClick={onEditContent}
    >
      <div className="flex items-start gap-3">
        <div className="mt-0.5 shrink-0 rounded-md border border-border bg-muted/40 p-2">
          <FileText className="h-4 w-4 text-muted-foreground" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-sm font-semibold text-foreground">{template.name}</span>
            {template.is_default && (
              <Badge variant="default" className="gap-1">
                <Star className="h-3 w-3 fill-current" />
                Padrão
              </Badge>
            )}
            {template.type && (
              <Badge variant="muted" className="font-mono text-[10px] uppercase">
                {template.type}
              </Badge>
            )}
          </div>
          {template.description && (
            <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
              {template.description}
            </p>
          )}
          <div className="mt-2 flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground">
            <span>
              {blockCount} {blockCount === 1 ? 'bloco' : 'blocos'}
            </span>
            <span className="opacity-50">·</span>
            <span>
              {paymentCount} {paymentCount === 1 ? 'opção de pagamento' : 'opções de pagamento'}
            </span>
          </div>
        </div>
        <div className="shrink-0" onClick={(e) => e.stopPropagation()}>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <IconButton
                icon={<MoreHorizontal className="h-4 w-4" />}
                label="Mais ações"
                size="icon"
                variant="ghost"
              />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuItem onSelect={onEditContent}>
                <Pencil className="mr-2 h-3.5 w-3.5" />
                Editar conteúdo
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={onEditMeta}>
                <FileText className="mr-2 h-3.5 w-3.5" />
                Renomear / descrever
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={onDuplicate}>
                <Copy className="mr-2 h-3.5 w-3.5" />
                Duplicar
              </DropdownMenuItem>
              {!template.is_default && (
                <DropdownMenuItem onSelect={onSetDefault}>
                  <Star className="mr-2 h-3.5 w-3.5" />
                  Definir como padrão
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onSelect={onDelete}
                className="text-destructive focus:bg-destructive/10 focus:text-destructive"
              >
                <Trash2 className="mr-2 h-3.5 w-3.5" />
                Excluir
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </Card>
  )
}

interface FieldGroupProps {
  label: string
  hint?: string
  required?: boolean
  children: React.ReactNode
}

function FieldGroup({ label, hint, required, children }: FieldGroupProps) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs uppercase tracking-wider text-muted-foreground">
        {label}
        {required && <span className="ml-0.5 text-destructive">*</span>}
      </Label>
      {children}
      {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  )
}
