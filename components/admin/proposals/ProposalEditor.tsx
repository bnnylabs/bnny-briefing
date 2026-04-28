'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import {
  ArrowLeft,
  ArrowDown,
  ArrowUp,
  ChevronDown,
  Eye,
  EyeOff,
  Pencil,
  Plus,
  Trash2,
  AlertCircle,
  Check,
  Loader2,
} from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { IconButton } from '@/components/ui/icon-button'
import { Input } from '@/components/ui/input'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { DatePicker, parseIsoDate, toIsoDate } from '@/components/ui/date-picker'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useToast, ToastContainer } from '@/components/toast'
import { cn } from '@/lib/utils'

import {
  formatProposalNumber,
  PROPOSAL_STATUS_LABELS_PT,
  proposalStatusVariant,
  type ProposalBlock,
  type ProposalBlockContent,
  type ProposalBlockType,
  type ProposalStatus,
  type ProposalWithClient,
} from '@/lib/proposal-types'

import { formatSavedAgo, useAutoSave, type AutoSaveStatus } from './useAutoSave'
import { HeaderEditor, HeaderPreview } from './BlockHeader'
import { PhasesEditor, PhasesPreview } from './BlockPhases'

// ─── Block type catalog (Phase 2a only ships header + phases) ────────────

interface BlockTypeMeta {
  type: ProposalBlockType
  label: string
  description: string
  /** Whether this type is available in the current phase. */
  available: boolean
}

const BLOCK_TYPES: BlockTypeMeta[] = [
  {
    type: 'header',
    label: 'Cabeçalho',
    description: 'Texto de abertura da proposta.',
    available: true,
  },
  {
    type: 'phases',
    label: 'Fases',
    description: 'Etapas numeradas com prazo (escopo + cronograma).',
    available: true,
  },
  {
    type: 'investment',
    label: 'Investimento',
    description: 'Valor total e condições de pagamento.',
    available: false,
  },
  {
    type: 'terms',
    label: 'Termos',
    description: 'Termos e condições do projeto.',
    available: false,
  },
  {
    type: 'next_steps',
    label: 'Próximos passos',
    description: 'Lista do que acontece após aprovação.',
    available: false,
  },
  {
    type: 'attachments',
    label: 'Anexos',
    description: 'Links para arquivos adicionais.',
    available: false,
  },
  {
    type: 'custom',
    label: 'Bloco livre',
    description: 'Título + texto em markdown.',
    available: false,
  },
]

const BLOCK_LABEL: Record<ProposalBlockType, string> = Object.fromEntries(
  BLOCK_TYPES.map((b) => [b.type, b.label]),
) as Record<ProposalBlockType, string>

// ─── Save status indicator ───────────────────────────────────────────────

function SaveIndicator({
  status,
  lastSavedAt,
}: {
  status: AutoSaveStatus
  lastSavedAt: number | null
}) {
  // Tick every 5s so "salvo há Xs" stays fresh.
  const [, force] = useState(0)
  useEffect(() => {
    if (status !== 'idle') return
    const t = setInterval(() => force((n) => n + 1), 5000)
    return () => clearInterval(t)
  }, [status])

  if (status === 'saving') {
    return (
      <span className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground">
        <Loader2 className="h-3 w-3 animate-spin" />
        Salvando…
      </span>
    )
  }
  if (status === 'saved') {
    return (
      <span className="inline-flex items-center gap-1.5 text-[11px] text-success">
        <Check className="h-3 w-3" />
        Salvo
      </span>
    )
  }
  if (status === 'error') {
    return (
      <span className="inline-flex items-center gap-1.5 text-[11px] text-destructive">
        <AlertCircle className="h-3 w-3" />
        Erro ao salvar
      </span>
    )
  }
  // idle
  if (lastSavedAt) {
    return (
      <span className="text-[11px] text-muted-foreground/70">
        {formatSavedAgo(lastSavedAt)}
      </span>
    )
  }
  return null
}

// ─── Per-block editor switch ──────────────────────────────────────────────

interface BlockEditorSwitchProps {
  block: ProposalBlock
  onContentChange: (content: ProposalBlockContent) => void
}

function BlockEditorSwitch({ block, onContentChange }: BlockEditorSwitchProps) {
  switch (block.type) {
    case 'header':
      return (
        <HeaderEditor
          content={block.content as { body: string }}
          onChange={onContentChange}
        />
      )
    case 'phases':
      return (
        <PhasesEditor
          content={block.content as { phases: never[] }}
          onChange={onContentChange}
        />
      )
    default:
      return (
        <div className="rounded-md border border-dashed border-border bg-muted/20 px-4 py-6 text-center text-xs text-muted-foreground">
          Editor para "{BLOCK_LABEL[block.type]}" chega na Fase 2b.
        </div>
      )
  }
}

interface BlockPreviewSwitchProps {
  block: ProposalBlock
}

function BlockPreviewSwitch({ block }: BlockPreviewSwitchProps) {
  switch (block.type) {
    case 'header':
      return <HeaderPreview content={block.content as { body: string }} />
    case 'phases':
      return <PhasesPreview content={block.content as { phases: never[] }} />
    default:
      return (
        <p className="text-sm italic text-muted-foreground/60">
          Preview deste bloco chega na Fase 2b.
        </p>
      )
  }
}

// ─── Main editor ──────────────────────────────────────────────────────────

interface ProposalEditorProps {
  initialProposal: ProposalWithClient
  initialBlocks: ProposalBlock[]
}

export function ProposalEditor({
  initialProposal,
  initialBlocks,
}: ProposalEditorProps) {
  const { toasts, toast, remove } = useToast()

  // Local state — single source of truth while user edits.
  const [proposal, setProposal] = useState<ProposalWithClient>(initialProposal)
  const [blocks, setBlocks] = useState<ProposalBlock[]>(initialBlocks)
  const [deleteTarget, setDeleteTarget] = useState<ProposalBlock | null>(null)

  const slug = proposal.slug

  // Track which fields are dirty so the save sends only what changed.
  // For Phase 2a we just send the editable meta on every save call —
  // the API patch only updates supplied fields anyway.
  const proposalDirtyRef = useRef(false)
  const blockDirtyIdsRef = useRef<Set<string>>(new Set())

  // ── Save: proposal meta ────────────────────────────────────────────────
  const saveProposalMeta = useCallback(async () => {
    if (!proposalDirtyRef.current) return
    const res = await fetch(`/api/proposals/${slug}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: proposal.title,
        valid_until: proposal.valid_until,
      }),
    })
    if (!res.ok) throw new Error('save failed')
    proposalDirtyRef.current = false
  }, [slug, proposal.title, proposal.valid_until])

  const proposalSave = useAutoSave(saveProposalMeta)

  // ── Save: blocks (one call per dirty block) ────────────────────────────
  const saveBlocks = useCallback(async () => {
    if (blockDirtyIdsRef.current.size === 0) return
    const idsToSave = Array.from(blockDirtyIdsRef.current)
    blockDirtyIdsRef.current.clear()

    // Snapshot blocks at save-call time. If a block was deleted between
    // dirty-marking and save firing, skip it silently.
    const snapshot = blocks
    const errors: string[] = []
    await Promise.all(
      idsToSave.map(async (id) => {
        const b = snapshot.find((x) => x.id === id)
        if (!b) return
        try {
          const res = await fetch(`/api/proposals/${slug}/blocks/${id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ content: b.content, visible: b.visible }),
          })
          if (!res.ok) errors.push(id)
        } catch {
          errors.push(id)
        }
      }),
    )
    if (errors.length > 0) {
      // Re-mark failed ones as dirty so next save retries them.
      errors.forEach((id) => blockDirtyIdsRef.current.add(id))
      throw new Error('save failed')
    }
  }, [slug, blocks])

  const blocksSave = useAutoSave(saveBlocks)

  // Combined save status — show whichever is more "active".
  const combinedStatus: AutoSaveStatus = useMemo(() => {
    const order: AutoSaveStatus[] = ['error', 'saving', 'saved', 'idle']
    for (const s of order) {
      if (proposalSave.status === s || blocksSave.status === s) return s
    }
    return 'idle'
  }, [proposalSave.status, blocksSave.status])

  const combinedSavedAt = useMemo(() => {
    const a = proposalSave.lastSavedAt ?? 0
    const b = blocksSave.lastSavedAt ?? 0
    const max = Math.max(a, b)
    return max === 0 ? null : max
  }, [proposalSave.lastSavedAt, blocksSave.lastSavedAt])

  // ── Local mutators ─────────────────────────────────────────────────────

  const patchProposal = (patch: Partial<ProposalWithClient>) => {
    setProposal((p) => ({ ...p, ...patch }))
    proposalDirtyRef.current = true
    proposalSave.schedule()
  }

  const patchBlockContent = (id: string, content: ProposalBlockContent) => {
    setBlocks((arr) =>
      arr.map((b) => (b.id === id ? { ...b, content } : b)),
    )
    blockDirtyIdsRef.current.add(id)
    blocksSave.schedule()
  }

  const toggleBlockVisible = async (id: string) => {
    setBlocks((arr) =>
      arr.map((b) => (b.id === id ? { ...b, visible: !b.visible } : b)),
    )
    blockDirtyIdsRef.current.add(id)
    blocksSave.schedule()
  }

  // ── Block creation / deletion / reorder ────────────────────────────────

  const addBlock = async (type: ProposalBlockType) => {
    const res = await fetch(`/api/proposals/${slug}/blocks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type }),
    })
    if (!res.ok) {
      toast('Erro ao adicionar bloco', 'error')
      return
    }
    const data = await res.json()
    setBlocks((arr) => [...arr, data.block as ProposalBlock])
  }

  const confirmDeleteBlock = async () => {
    if (!deleteTarget) return
    const id = deleteTarget.id
    setDeleteTarget(null)
    const res = await fetch(`/api/proposals/${slug}/blocks/${id}`, {
      method: 'DELETE',
    })
    if (!res.ok) {
      toast('Erro ao excluir bloco', 'error')
      return
    }
    setBlocks((arr) => arr.filter((b) => b.id !== id))
    blockDirtyIdsRef.current.delete(id)
  }

  /**
   * Move a block up or down by swapping positions with the neighbor.
   * Persists both new positions immediately (no debounce) since reorders
   * are discrete user actions, not typing.
   */
  const moveBlock = async (id: string, direction: 'up' | 'down') => {
    const idx = blocks.findIndex((b) => b.id === id)
    if (idx === -1) return
    const neighborIdx = direction === 'up' ? idx - 1 : idx + 1
    if (neighborIdx < 0 || neighborIdx >= blocks.length) return

    const a = blocks[idx]
    const b = blocks[neighborIdx]

    // Swap positions optimistically.
    const next = [...blocks]
    next[idx] = { ...a, position: b.position }
    next[neighborIdx] = { ...b, position: a.position }
    next.sort((x, y) => x.position - y.position)
    setBlocks(next)

    // Persist both. Errors revert.
    try {
      await Promise.all([
        fetch(`/api/proposals/${slug}/blocks/${a.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ position: b.position }),
        }),
        fetch(`/api/proposals/${slug}/blocks/${b.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ position: a.position }),
        }),
      ])
    } catch {
      toast('Erro ao reordenar', 'error')
      setBlocks(blocks) // revert
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────

  const status = proposal.status as ProposalStatus

  return (
    <div className="min-h-screen bg-background">
      <ToastContainer toasts={toasts} remove={remove} />

      <div className="mx-auto max-w-6xl p-6">
        {/* Top bar: back link + save indicator */}
        <div className="mb-5 flex items-center justify-between">
          <Link
            href="/admin/propostas"
            className="inline-flex items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft size={13} />
            Voltar para propostas
          </Link>
          <SaveIndicator status={combinedStatus} lastSavedAt={combinedSavedAt} />
        </div>

        {/* Header: number, title, status, validity */}
        <div className="mb-6 space-y-3">
          <div className="flex items-center gap-3">
            <span className="font-mono text-xs font-semibold tabular-nums text-muted-foreground">
              {formatProposalNumber(proposal.number, proposal.version_suffix)}
            </span>
            <Badge
              variant={proposalStatusVariant(status)}
              className="text-[11px] font-medium"
            >
              {PROPOSAL_STATUS_LABELS_PT[status]}
            </Badge>
            {proposal.clients?.company && (
              <span className="truncate text-xs text-muted-foreground">
                · {proposal.clients.company}
              </span>
            )}
          </div>

          <Input
            value={proposal.title}
            onChange={(e) => patchProposal({ title: e.target.value })}
            placeholder="Título da proposta"
            className="h-auto border-0 bg-transparent px-0 font-mono text-2xl font-bold tracking-tight shadow-none focus:ring-0 focus-visible:ring-0"
          />

          <div className="flex flex-wrap items-center gap-3">
            <label className="text-[10px] uppercase tracking-widest text-muted-foreground">
              Validade
            </label>
            <div className="w-56">
              <DatePicker
                value={parseIsoDate(proposal.valid_until)}
                onChange={(d) => patchProposal({ valid_until: toIsoDate(d) })}
                placeholder="Sem validade"
                disablePast
              />
            </div>
          </div>
        </div>

        {/* Body — desktop split, mobile tabs */}
        <div className="lg:hidden">
          <Tabs defaultValue="editor">
            <TabsList className="mb-4 w-full">
              <TabsTrigger value="editor" className="flex-1">
                <Pencil className="mr-1.5 h-3.5 w-3.5" />
                Editor
              </TabsTrigger>
              <TabsTrigger value="preview" className="flex-1">
                <Eye className="mr-1.5 h-3.5 w-3.5" />
                Preview
              </TabsTrigger>
            </TabsList>
            <TabsContent value="editor">
              <EditorColumn
                blocks={blocks}
                onPatchContent={patchBlockContent}
                onToggleVisible={toggleBlockVisible}
                onMoveUp={(id) => moveBlock(id, 'up')}
                onMoveDown={(id) => moveBlock(id, 'down')}
                onDelete={(b) => setDeleteTarget(b)}
                onAddBlock={addBlock}
              />
            </TabsContent>
            <TabsContent value="preview">
              <PreviewColumn blocks={blocks} />
            </TabsContent>
          </Tabs>
        </div>

        <div className="hidden gap-6 lg:grid lg:grid-cols-2">
          <EditorColumn
            blocks={blocks}
            onPatchContent={patchBlockContent}
            onToggleVisible={toggleBlockVisible}
            onMoveUp={(id) => moveBlock(id, 'up')}
            onMoveDown={(id) => moveBlock(id, 'down')}
            onDelete={(b) => setDeleteTarget(b)}
            onAddBlock={addBlock}
          />
          <PreviewColumn blocks={blocks} sticky />
        </div>
      </div>

      {/* Delete block confirmation */}
      <Dialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
      >
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Excluir bloco?</DialogTitle>
            <DialogDescription>
              {deleteTarget
                ? `O bloco "${BLOCK_LABEL[deleteTarget.type]}" será removido. Esta ação não pode ser desfeita.`
                : ''}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="p-6 pt-0">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setDeleteTarget(null)}
            >
              Cancelar
            </Button>
            <Button variant="destructive" onClick={confirmDeleteBlock}>
              Excluir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ─── Editor + preview columns (extracted for desktop/mobile reuse) ───────

interface EditorColumnProps {
  blocks: ProposalBlock[]
  onPatchContent: (id: string, content: ProposalBlockContent) => void
  onToggleVisible: (id: string) => void
  onMoveUp: (id: string) => void
  onMoveDown: (id: string) => void
  onDelete: (block: ProposalBlock) => void
  onAddBlock: (type: ProposalBlockType) => void
}

function EditorColumn({
  blocks,
  onPatchContent,
  onToggleVisible,
  onMoveUp,
  onMoveDown,
  onDelete,
  onAddBlock,
}: EditorColumnProps) {
  return (
    <div className="space-y-3">
      {blocks.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border bg-muted/20 px-6 py-10 text-center">
          <div className="mb-1 text-sm font-semibold text-foreground">
            Sem blocos ainda
          </div>
          <div className="mb-4 text-xs text-muted-foreground">
            Adicione um bloco para começar a montar a proposta.
          </div>
          <AddBlockMenu onAdd={onAddBlock} />
        </div>
      ) : (
        <>
          {blocks.map((block, i) => (
            <BlockCard
              key={block.id}
              block={block}
              isFirst={i === 0}
              isLast={i === blocks.length - 1}
              onPatchContent={(c) => onPatchContent(block.id, c)}
              onToggleVisible={() => onToggleVisible(block.id)}
              onMoveUp={() => onMoveUp(block.id)}
              onMoveDown={() => onMoveDown(block.id)}
              onDelete={() => onDelete(block)}
            />
          ))}
          <div className="pt-2">
            <AddBlockMenu onAdd={onAddBlock} />
          </div>
        </>
      )}
    </div>
  )
}

interface BlockCardProps {
  block: ProposalBlock
  isFirst: boolean
  isLast: boolean
  onPatchContent: (content: ProposalBlockContent) => void
  onToggleVisible: () => void
  onMoveUp: () => void
  onMoveDown: () => void
  onDelete: () => void
}

function BlockCard({
  block,
  isFirst,
  isLast,
  onPatchContent,
  onToggleVisible,
  onMoveUp,
  onMoveDown,
  onDelete,
}: BlockCardProps) {
  return (
    <div
      className={cn(
        'rounded-lg border border-border bg-card transition-opacity',
        !block.visible && 'opacity-60',
      )}
    >
      <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-2">
        <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
          {BLOCK_LABEL[block.type]}
        </div>
        <div className="flex items-center gap-0.5">
          <IconButton
            variant="ghost"
            size="icon-sm"
            onClick={onMoveUp}
            disabled={isFirst}
            icon={<ArrowUp size={13} />}
            label="Mover para cima"
          />
          <IconButton
            variant="ghost"
            size="icon-sm"
            onClick={onMoveDown}
            disabled={isLast}
            icon={<ArrowDown size={13} />}
            label="Mover para baixo"
          />
          <IconButton
            variant="ghost"
            size="icon-sm"
            onClick={onToggleVisible}
            icon={
              block.visible ? <Eye size={13} /> : <EyeOff size={13} />
            }
            label={block.visible ? 'Ocultar bloco' : 'Mostrar bloco'}
          />
          <IconButton
            variant="ghost"
            size="icon-sm"
            onClick={onDelete}
            icon={<Trash2 size={13} />}
            label="Excluir bloco"
            className="text-muted-foreground hover:text-destructive"
          />
        </div>
      </div>
      <div className="p-4">
        <BlockEditorSwitch block={block} onContentChange={onPatchContent} />
      </div>
    </div>
  )
}

interface PreviewColumnProps {
  blocks: ProposalBlock[]
  sticky?: boolean
}

function PreviewColumn({ blocks, sticky }: PreviewColumnProps) {
  const visible = blocks.filter((b) => b.visible)
  return (
    <div className={cn(sticky && 'lg:sticky lg:top-6 lg:self-start')}>
      <div className="rounded-lg border border-border bg-card">
        <div className="border-b border-border px-5 py-2.5 text-[10px] uppercase tracking-widest text-muted-foreground">
          Preview
        </div>
        <div className="space-y-8 p-6 lg:p-8">
          {visible.length === 0 ? (
            <p className="text-sm italic text-muted-foreground/60">
              Nada para mostrar ainda.
            </p>
          ) : (
            visible.map((b) => (
              <div key={b.id}>
                <BlockPreviewSwitch block={b} />
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}

interface AddBlockMenuProps {
  onAdd: (type: ProposalBlockType) => void
}

function AddBlockMenu({ onAdd }: AddBlockMenuProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm">
          <Plus className="mr-1.5 h-3.5 w-3.5" />
          Adicionar bloco
          <ChevronDown className="ml-1 h-3.5 w-3.5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-64">
        {BLOCK_TYPES.map((b) => (
          <DropdownMenuItem
            key={b.type}
            disabled={!b.available}
            onSelect={() => b.available && onAdd(b.type)}
            className="flex flex-col items-start gap-0.5 py-2"
          >
            <div className="flex w-full items-center justify-between">
              <span className="text-sm font-semibold">{b.label}</span>
              {!b.available && (
                <span className="text-[10px] uppercase tracking-widest text-muted-foreground">
                  Em breve
                </span>
              )}
            </div>
            <span className="text-[11px] text-muted-foreground">
              {b.description}
            </span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
