'use client'

import * as React from 'react'
import { Pin, PinOff, StickyNote, Trash2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { renderMarkdownToHtml } from '@/lib/email-markdown'

export interface ClientNote {
  id: string
  client_id: string
  body_markdown: string
  is_pinned: boolean
  created_at: string
}

interface Props {
  clientId: string
  notes: ClientNote[]
  onUpdate: () => void
  onError: (msg: string) => void
}

const FONT = '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
const MUTED = '#737373'

function renderNote(md: string): string {
  return renderMarkdownToHtml(md, { fontStack: FONT, mutedColor: MUTED })
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', year: '2-digit',
    hour: '2-digit', minute: '2-digit',
  })
}

export function NotesSection({ clientId, notes, onUpdate, onError }: Props) {
  const [body, setBody] = React.useState('')
  const [submitting, setSubmitting] = React.useState(false)
  const [showAll, setShowAll] = React.useState(false)
  const [togglingPin, setTogglingPin] = React.useState<string | null>(null)
  // Holds the note pending confirmation. null = no dialog open.
  const [confirmingDelete, setConfirmingDelete] = React.useState<ClientNote | null>(null)
  const [deletingId, setDeletingId] = React.useState<string | null>(null)

  const pinned = notes.filter(n => n.is_pinned)
  const unpinned = notes.filter(n => !n.is_pinned)
  const ordered = [...pinned, ...unpinned]
  const visible = showAll ? ordered : ordered.slice(0, 3)
  const hasMore = ordered.length > 3

  async function submit() {
    if (!body.trim()) return
    setSubmitting(true)
    const res = await fetch(`/api/admin/clients/${clientId}/notes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ body_markdown: body.trim() }),
    })
    setSubmitting(false)
    if (!res.ok) { onError('Erro ao adicionar nota'); return }
    setBody('')
    onUpdate()
  }

  async function togglePin(note: ClientNote) {
    setTogglingPin(note.id)
    await fetch(`/api/admin/clients/${clientId}/notes/${note.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_pinned: !note.is_pinned }),
    })
    setTogglingPin(null)
    onUpdate()
  }

  async function performDelete() {
    const note = confirmingDelete
    if (!note) return
    setConfirmingDelete(null)
    setDeletingId(note.id)
    const res = await fetch(`/api/admin/clients/${clientId}/notes/${note.id}`, {
      method: 'DELETE',
    })
    setDeletingId(null)
    if (!res.ok) { onError('Erro ao remover nota'); return }
    onUpdate()
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Add note */}
      <div className="space-y-2">
        <textarea
          value={body}
          onChange={e => setBody(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) submit()
          }}
          placeholder="Nota interna... (Cmd+Enter para salvar)"
          rows={3}
          className="block w-full resize-none rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
        <button
          type="button" onClick={submit}
          disabled={!body.trim() || submitting}
          className="flex w-full items-center justify-center gap-1.5 rounded-md border border-border py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:border-foreground/30 hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
        >
          <StickyNote size={11} />
          {submitting ? 'Salvando…' : 'Adicionar nota'}
        </button>
      </div>

      {/* Notes list */}
      {visible.length > 0 && (
        <div className="space-y-2">
          {visible.map(note => (
            <div key={note.id}
              className={cn(
                'group relative rounded-lg border bg-card p-3 text-sm',
                note.is_pinned ? 'border-primary/30 bg-primary/10' : 'border-border',
                deletingId === note.id && 'opacity-50',
              )}>
              {/* Action buttons (top-right, hover) */}
              <div className="absolute right-2 top-2 flex items-center gap-0.5">
                <button
                  type="button"
                  onClick={() => togglePin(note)}
                  disabled={togglingPin === note.id}
                  aria-label={note.is_pinned ? 'Desafixar nota' : 'Fixar nota no topo'}
                  title={note.is_pinned ? 'Desafixar' : 'Fixar no topo'}
                  className={cn(
                    'rounded p-1 transition-opacity',
                    note.is_pinned
                      ? 'text-primary opacity-100 hover:bg-primary/15'
                      : 'text-muted-foreground opacity-0 hover:bg-muted group-hover:opacity-100',
                  )}
                >
                  {note.is_pinned ? <PinOff size={11} /> : <Pin size={11} />}
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmingDelete(note)}
                  disabled={deletingId === note.id}
                  aria-label="Remover nota"
                  title="Remover"
                  className="rounded p-1 text-muted-foreground opacity-0 transition-opacity hover:bg-destructive/10 hover:text-destructive group-hover:opacity-100"
                >
                  <Trash2 size={11} />
                </button>
              </div>

              {/* Body — rendered as HTML from markdown */}
              <div
                className="prose-sm pr-12 leading-relaxed text-foreground [&_p]:mb-1 [&_p:last-child]:mb-0 [&_strong]:font-semibold [&_em]:italic"
                dangerouslySetInnerHTML={{ __html: renderNote(note.body_markdown) }}
              />
              <div className="mt-2 text-[10px] text-muted-foreground">
                {fmtDate(note.created_at)}
                {note.is_pinned && (
                  <span className="ml-2 inline-flex items-center gap-0.5 text-primary">
                    <Pin size={8} /> Fixada
                  </span>
                )}
              </div>
            </div>
          ))}

          {hasMore && (
            <button
              type="button" onClick={() => setShowAll(s => !s)}
              className="w-full rounded-md border border-dashed border-border py-2 text-xs text-muted-foreground hover:border-foreground/20 hover:text-foreground"
            >
              {showAll ? 'Ver menos' : `Ver mais ${ordered.length - 3} nota${ordered.length - 3 !== 1 ? 's' : ''}`}
            </button>
          )}
        </div>
      )}

      {notes.length === 0 && (
        <p className="text-xs text-muted-foreground">Nenhuma nota ainda.</p>
      )}

      <ConfirmDialog
        open={!!confirmingDelete}
        onOpenChange={(open) => !open && setConfirmingDelete(null)}
        title="Remover esta nota?"
        description="Esta ação não pode ser desfeita."
        icon={Trash2}
        variant="destructive"
        confirmLabel="Sim, remover"
        onConfirm={performDelete}
      />
    </div>
  )
}
