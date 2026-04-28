'use client'

import * as React from 'react'
import { useParams, useRouter } from 'next/navigation'
import {
  ArrowLeft,
  Check,
  CircleAlert,
  CreditCard,
  FileText,
  GitBranch,
  Layers,
  ListChecks,
  Loader2,
  Plus,
  Trash2,
  Type,
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { IconButton } from '@/components/ui/icon-button'
import { Breadcrumbs } from '@/components/ui/breadcrumbs'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { useToast, ToastContainer } from '@/components/toast'
import { cn } from '@/lib/utils'

import { HeaderEditor } from '@/components/admin/proposals/BlockHeader'
import { PhasesEditor } from '@/components/admin/proposals/BlockPhases'
import { InvestmentEditor } from '@/components/admin/proposals/BlockInvestment'
import {
  formatSavedAgo,
  useAutoSave,
  type AutoSaveStatus,
} from '@/components/admin/proposals/useAutoSave'

import type {
  BlockContentCustom,
  BlockContentHeader,
  BlockContentInvestment,
  BlockContentNextSteps,
  BlockContentPhases,
  BlockContentTerms,
  ProposalBlockContent,
  ProposalBlockType,
  ProposalTemplate,
} from '@/lib/proposal-types'

// ─── Block ordering ─────────────────────────────────────────────────────
//
// We use the same lexorank-style positions as the real proposal editor
// (POSITION_STEP=1024) so when a proposal is created from a template,
// the blocks land in the expected order without renumbering.
const BLOCK_ORDER: ProposalBlockType[] = [
  'header',
  'phases',
  'investment',
  'terms',
  'next_steps',
  'custom',
]

const BLOCK_POSITION: Record<ProposalBlockType, number> = {
  header: 1024,
  phases: 2048,
  investment: 3072,
  terms: 4096,
  next_steps: 5120,
  custom: 6144,
  attachments: 7168,
}

const BLOCK_LABEL: Record<ProposalBlockType, string> = {
  header: 'Abertura',
  phases: 'Fases do projeto',
  investment: 'Investimento',
  terms: 'Termos e condições',
  next_steps: 'Próximos passos',
  custom: 'Bloco livre',
  attachments: 'Anexos',
}

const BLOCK_DESCRIPTION: Record<ProposalBlockType, string> = {
  header: 'Texto curto de boas-vindas que abre a proposta',
  phases: 'Fases numeradas com duração e descrição',
  investment: 'Valor total e opções de pagamento padrão',
  terms: 'Cláusulas padrão em texto corrido',
  next_steps: 'Lista de passos pós-aprovação',
  custom: 'Bloco com título e corpo livre',
  attachments: 'Lista de arquivos vinculados',
}

const BLOCK_ICON: Record<ProposalBlockType, React.ComponentType<{ className?: string }>> = {
  header: Type,
  phases: GitBranch,
  investment: CreditCard,
  terms: FileText,
  next_steps: ListChecks,
  custom: Layers,
  attachments: FileText,
}

function defaultContentForType(type: ProposalBlockType): ProposalBlockContent {
  switch (type) {
    case 'header':
      return { body: '' }
    case 'phases':
      return { phases: [] }
    case 'investment':
      return { intro: '', total_amount: 0, currency: 'BRL', payment_terms: [] }
    case 'terms':
      return { body_markdown: '' }
    case 'next_steps':
      return { items: [] }
    case 'attachments':
      return { files: [] }
    case 'custom':
      return { title: '', body_markdown: '' }
  }
}

// Block shape stored inside ProposalTemplate.default_blocks
interface TemplateBlock {
  type: ProposalBlockType
  position: number
  visible: boolean
  content: ProposalBlockContent
}

export default function ModeloEditorPage() {
  const params = useParams<{ id: string }>()
  const id = params.id
  const router = useRouter()
  const { toasts, toast, remove } = useToast()

  const [template, setTemplate] = React.useState<ProposalTemplate | null>(null)
  const [blocks, setBlocks] = React.useState<TemplateBlock[]>([])
  const [loading, setLoading] = React.useState(true)
  const [notFound, setNotFound] = React.useState(false)
  const [confirmDelete, setConfirmDelete] = React.useState<ProposalBlockType | null>(null)

  // ─── Initial load ─────────────────────────────────────────────────────
  React.useEffect(() => {
    let cancelled = false
    async function load() {
      const res = await fetch(`/api/proposal-templates/${id}`, { cache: 'no-store' })
      if (cancelled) return
      if (res.status === 404) {
        setNotFound(true)
        setLoading(false)
        return
      }
      if (!res.ok) {
        toast('Erro ao carregar modelo', 'error')
        setLoading(false)
        return
      }
      const data = await res.json()
      const t = data.template as ProposalTemplate
      setTemplate(t)
      setBlocks((Array.isArray(t.default_blocks) ? t.default_blocks : []) as TemplateBlock[])
      setLoading(false)
    }
    load()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  // ─── Auto-save (debounced PATCH) ──────────────────────────────────────
  const blocksRef = React.useRef(blocks)
  React.useEffect(() => {
    blocksRef.current = blocks
  }, [blocks])

  const save = React.useCallback(async () => {
    const res = await fetch(`/api/proposal-templates/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ default_blocks: blocksRef.current }),
    })
    if (!res.ok) throw new Error('save failed')
  }, [id])

  const { status: saveStatus, lastSavedAt, schedule } = useAutoSave(save, { delay: 800 })

  function mutateBlocks(next: TemplateBlock[]) {
    setBlocks(next)
    schedule()
  }

  // ─── Block lifecycle ──────────────────────────────────────────────────
  function addBlock(type: ProposalBlockType) {
    if (blocks.find((b) => b.type === type)) return
    const next = [
      ...blocks,
      {
        type,
        position: BLOCK_POSITION[type],
        visible: true,
        content: defaultContentForType(type),
      },
    ].sort((a, b) => a.position - b.position)
    mutateBlocks(next)
  }

  function removeBlock(type: ProposalBlockType) {
    mutateBlocks(blocks.filter((b) => b.type !== type))
    setConfirmDelete(null)
  }

  function updateBlock(type: ProposalBlockType, content: ProposalBlockContent) {
    mutateBlocks(blocks.map((b) => (b.type === type ? { ...b, content } : b)))
  }

  // ─── Render ───────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="spinner" />
      </div>
    )
  }

  if (notFound || !template) {
    return (
      <div className="mx-auto max-w-3xl p-6">
        <ToastContainer toasts={toasts} remove={remove} />
        <Card className="p-10 text-center">
          <CircleAlert className="mx-auto mb-3 h-9 w-9 text-muted-foreground/50" />
          <div className="mb-2 text-sm font-semibold">Modelo não encontrado</div>
          <Button variant="outline" size="sm" onClick={() => router.push('/admin/config/propostas')}>
            Voltar pra lista
          </Button>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <ToastContainer toasts={toasts} remove={remove} />

      <div className="mx-auto max-w-3xl p-6">
        <Breadcrumbs
          className="mb-3"
          items={[
            { label: 'Propostas', href: '/admin/propostas' },
            { label: 'Configurações', href: '/admin/config/propostas' },
            { label: template.name },
          ]}
        />

        <div className="mb-6 flex items-start gap-2">
          <IconButton
            icon={<ArrowLeft className="h-4 w-4" />}
            label="Voltar"
            size="icon"
            onClick={() => router.push('/admin/config/propostas')}
          />
          <div className="min-w-0 flex-1">
            <h1 className="font-mono text-xl font-bold tracking-tight">{template.name}</h1>
            {template.description && (
              <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
                {template.description}
              </p>
            )}
          </div>
          <SaveBadge status={saveStatus} lastSavedAt={lastSavedAt} />
        </div>

        <div className="space-y-3">
          {BLOCK_ORDER.map((type) => {
            const block = blocks.find((b) => b.type === type)
            if (block) {
              return (
                <BlockCard
                  key={type}
                  type={type}
                  block={block}
                  onChange={(c) => updateBlock(type, c)}
                  onRemove={() => setConfirmDelete(type)}
                  onError={(msg) => toast(msg, 'error')}
                />
              )
            }
            return <BlockSlot key={type} type={type} onAdd={() => addBlock(type)} />
          })}
        </div>

        <p className="mt-6 text-center text-[11px] text-muted-foreground">
          As alterações são salvas automaticamente. Quando você cria uma proposta com este modelo,
          a estrutura acima é copiada e personalizada pela IA.
        </p>
      </div>

      <ConfirmDialog
        open={!!confirmDelete}
        onOpenChange={(o) => {
          if (!o) setConfirmDelete(null)
        }}
        title="Remover este bloco do modelo?"
        description={
          confirmDelete && (
            <>
              O bloco{' '}
              <span className="font-medium text-foreground">{BLOCK_LABEL[confirmDelete]}</span>{' '}
              será removido. Você pode adicioná-lo de novo a qualquer momento — propostas que já
              foram criadas com este modelo não são afetadas.
            </>
          )
        }
        confirmLabel="Remover"
        onConfirm={() => {
          if (confirmDelete) removeBlock(confirmDelete)
        }}
      />
    </div>
  )
}

// ─── Save status badge ──────────────────────────────────────────────────

function SaveBadge({
  status,
  lastSavedAt,
}: {
  status: AutoSaveStatus
  lastSavedAt: number | null
}) {
  if (status === 'saving') {
    return (
      <span className="flex shrink-0 items-center gap-1.5 text-xs text-muted-foreground">
        <Loader2 className="h-3 w-3 animate-spin" />
        Salvando…
      </span>
    )
  }
  if (status === 'error') {
    return (
      <span className="flex shrink-0 items-center gap-1.5 text-xs text-destructive">
        <CircleAlert className="h-3 w-3" />
        Falha ao salvar
      </span>
    )
  }
  if (status === 'saved' || lastSavedAt) {
    return (
      <span className="flex shrink-0 items-center gap-1.5 text-xs text-muted-foreground">
        <Check className="h-3 w-3 text-success" />
        {formatSavedAgo(lastSavedAt)}
      </span>
    )
  }
  return null
}

// ─── Empty slot (for blocks not yet added) ──────────────────────────────

function BlockSlot({ type, onAdd }: { type: ProposalBlockType; onAdd: () => void }) {
  const Icon = BLOCK_ICON[type]
  return (
    <Card className="border-dashed p-4">
      <div className="flex items-center gap-3">
        <div className="shrink-0 rounded-md border border-dashed border-border bg-muted/20 p-2">
          <Icon className="h-4 w-4 text-muted-foreground/60" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-medium text-muted-foreground">{BLOCK_LABEL[type]}</div>
          <div className="text-[11px] text-muted-foreground/70">{BLOCK_DESCRIPTION[type]}</div>
        </div>
        <Button variant="ghost" size="sm" onClick={onAdd}>
          <Plus className="mr-1 h-3.5 w-3.5" />
          Adicionar
        </Button>
      </div>
    </Card>
  )
}

// ─── Block card (per type) ──────────────────────────────────────────────

interface BlockCardProps {
  type: ProposalBlockType
  block: TemplateBlock
  onChange: (content: ProposalBlockContent) => void
  onRemove: () => void
  onError: (msg: string) => void
}

function BlockCard({ type, block, onChange, onRemove, onError }: BlockCardProps) {
  const Icon = BLOCK_ICON[type]
  return (
    <Card className="p-4">
      <div className="mb-3 flex items-center gap-3">
        <div className="shrink-0 rounded-md border border-border bg-muted/40 p-2">
          <Icon className="h-4 w-4 text-foreground/80" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 text-sm font-semibold">
            {BLOCK_LABEL[type]}
            <span className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground">
              · template
            </span>
          </div>
          <div className="text-[11px] text-muted-foreground">{BLOCK_DESCRIPTION[type]}</div>
        </div>
        <IconButton
          icon={<Trash2 className="h-3.5 w-3.5" />}
          label="Remover bloco"
          size="icon-sm"
          variant="ghost"
          className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
          onClick={onRemove}
        />
      </div>

      <BlockBody type={type} block={block} onChange={onChange} onError={onError} />
    </Card>
  )
}

interface BlockBodyProps {
  type: ProposalBlockType
  block: TemplateBlock
  onChange: (content: ProposalBlockContent) => void
  onError: (msg: string) => void
}

function BlockBody({ type, block, onChange, onError }: BlockBodyProps) {
  // For templates, clientId is always null — there's no client context.
  switch (type) {
    case 'header':
      return (
        <HeaderEditor
          content={block.content as BlockContentHeader}
          onChange={(c) => onChange(c)}
          clientId={null}
          onRewriteError={onError}
        />
      )
    case 'phases':
      return (
        <PhasesEditor
          content={block.content as BlockContentPhases}
          onChange={(c) => onChange(c)}
          clientId={null}
          onRewriteError={onError}
        />
      )
    case 'investment':
      return (
        <InvestmentEditor
          content={block.content as BlockContentInvestment}
          onChange={(c) => onChange(c)}
          clientId={null}
          onRewriteError={onError}
        />
      )
    case 'terms':
      return <TermsBody content={block.content as BlockContentTerms} onChange={onChange} />
    case 'next_steps':
      return <NextStepsBody content={block.content as BlockContentNextSteps} onChange={onChange} />
    case 'custom':
      return <CustomBody content={block.content as BlockContentCustom} onChange={onChange} />
    case 'attachments':
      return (
        <p className="text-xs text-muted-foreground">
          Anexos são gerenciados em cada proposta — não fazem parte do modelo.
        </p>
      )
  }
}

// ─── Lightweight editors for terms / next_steps / custom ────────────────

function TermsBody({
  content,
  onChange,
}: {
  content: BlockContentTerms
  onChange: (c: BlockContentTerms) => void
}) {
  return (
    <div className="space-y-2">
      <Label className="text-[10px] uppercase tracking-widest text-muted-foreground">
        Texto (markdown aceito)
      </Label>
      <textarea
        value={content.body_markdown ?? ''}
        onChange={(e) => onChange({ body_markdown: e.target.value })}
        rows={8}
        placeholder="## Vigência&#10;&#10;Esta proposta é válida por 30 dias…"
        className={cn(
          'flex w-full resize-y rounded-md border border-border bg-secondary px-3 py-2.5',
          'font-mono text-xs text-foreground placeholder:text-muted-foreground/50',
          'focus:border-primary/30 focus:outline-none focus:ring-2 focus:ring-ring/30',
        )}
      />
    </div>
  )
}

function NextStepsBody({
  content,
  onChange,
}: {
  content: BlockContentNextSteps
  onChange: (c: BlockContentNextSteps) => void
}) {
  const items = Array.isArray(content.items) ? content.items : []

  function update(idx: number, value: string) {
    onChange({ items: items.map((it, i) => (i === idx ? value : it)) })
  }
  function remove(idx: number) {
    onChange({ items: items.filter((_, i) => i !== idx) })
  }
  function add() {
    onChange({ items: [...items, ''] })
  }

  return (
    <div className="space-y-2">
      {items.length === 0 && (
        <p className="text-xs italic text-muted-foreground/70">
          Nenhum passo ainda — adicione abaixo.
        </p>
      )}
      {items.map((item, i) => (
        <div key={i} className="flex items-center gap-2">
          <span className="shrink-0 font-mono text-[10px] tabular-nums text-muted-foreground/70">
            {String(i + 1).padStart(2, '0')}.
          </span>
          <Input
            value={item}
            onChange={(e) => update(i, e.target.value)}
            placeholder="Ex: Reunião de kickoff em 24h após aprovação"
          />
          <IconButton
            icon={<Trash2 className="h-3.5 w-3.5" />}
            label="Remover passo"
            size="icon-sm"
            variant="ghost"
            className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
            onClick={() => remove(i)}
          />
        </div>
      ))}
      <Button variant="ghost" size="sm" onClick={add} className="text-xs">
        <Plus className="mr-1 h-3 w-3" />
        Adicionar passo
      </Button>
    </div>
  )
}

function CustomBody({
  content,
  onChange,
}: {
  content: BlockContentCustom
  onChange: (c: BlockContentCustom) => void
}) {
  return (
    <div className="space-y-3">
      <div className="space-y-1.5">
        <Label className="text-[10px] uppercase tracking-widest text-muted-foreground">
          Título do bloco
        </Label>
        <Input
          value={content.title ?? ''}
          onChange={(e) => onChange({ ...content, title: e.target.value })}
          placeholder="Ex: Por que a Bnny Labs"
        />
      </div>
      <div className="space-y-1.5">
        <Label className="text-[10px] uppercase tracking-widest text-muted-foreground">
          Corpo (markdown aceito)
        </Label>
        <textarea
          value={content.body_markdown ?? ''}
          onChange={(e) => onChange({ ...content, body_markdown: e.target.value })}
          rows={6}
          placeholder="Texto livre em markdown…"
          className={cn(
            'flex w-full resize-y rounded-md border border-border bg-secondary px-3 py-2.5',
            'font-mono text-xs text-foreground placeholder:text-muted-foreground/50',
            'focus:border-primary/30 focus:outline-none focus:ring-2 focus:ring-ring/30',
          )}
        />
      </div>
    </div>
  )
}
