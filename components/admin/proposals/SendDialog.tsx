'use client'

import * as React from 'react'
import { Loader2, Plus, Send, Star, X } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

/**
 * Contact shape used by the dialog. Only fields we need — the API
 * returns more, we discard the rest. Source: GET /api/admin/clients/[id]/contacts
 */
export interface SendContact {
  id: string
  name: string
  email: string | null
  language: 'pt-BR' | 'en-US'
  is_primary: boolean
  receives_copies: boolean
  role?: string | null
}

/**
 * What gets sent to /api/proposals/[slug]/send. Shape mirrors the
 * `recipients_override` body parameter the route accepts (v0.10.80).
 */
export interface SendRecipientPayload {
  email: string
  name: string
  language: 'pt-BR' | 'en-US'
  role: 'primary' | 'cc' | 'extra'
}

interface SendDialogProps {
  /** Controls visibility from the parent (typically tied to a "open" state). */
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Client ID — needed for inline contact creation. */
  clientId: string
  /** Pre-loaded contacts for the client. Empty list is fine — owner
   *  can still add inline. */
  contacts: SendContact[]
  /** Called with the final recipient list when the user confirms.
   *  Parent is responsible for the actual /send POST + UI feedback. */
  onConfirm: (recipients: SendRecipientPayload[]) => Promise<void>
  /** Optional callback when a new contact is created inline, so the
   *  parent can refresh its contact list. */
  onContactAdded?: () => void
}

/**
 * Default selection rule: include any contact with an email AND
 * (is_primary OR receives_copies). Mirrors what the legacy
 * resolveBriefingRecipients did under the hood — owner sees the
 * familiar behavior pre-checked, and refines from there.
 */
function defaultSelected(contacts: SendContact[]): Set<string> {
  const set = new Set<string>()
  for (const c of contacts) {
    if (c.email && (c.is_primary || c.receives_copies)) set.add(c.id)
  }
  return set
}

/**
 * Validate email shape (pragmatic, same check used elsewhere in the
 * codebase). Domain must include a dot, no whitespace, presence of @.
 */
function isValidEmail(s: string): boolean {
  if (!s || s.length > 320 || /\s/.test(s)) return false
  const at = s.indexOf('@')
  if (at <= 0 || at === s.length - 1) return false
  return s.slice(at + 1).includes('.')
}

export function SendDialog({
  open,
  onOpenChange,
  clientId,
  contacts,
  onConfirm,
  onContactAdded,
}: SendDialogProps) {
  // Selected contact IDs — initialized from contacts prop, refreshed
  // whenever the dialog opens (so the user gets a fresh default each
  // time, not a stale state from a previous open).
  const [selectedIds, setSelectedIds] = React.useState<Set<string>>(
    () => defaultSelected(contacts),
  )
  React.useEffect(() => {
    if (open) {
      setSelectedIds(defaultSelected(contacts))
      setShowAddForm(false)
      setNewName('')
      setNewEmail('')
      setNewLang('pt-BR')
      setError(null)
    }
  }, [open, contacts])

  const [submitting, setSubmitting] = React.useState(false)
  const [adding, setAdding] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  // Inline "add contact" form
  const [showAddForm, setShowAddForm] = React.useState(false)
  const [newName, setNewName] = React.useState('')
  const [newEmail, setNewEmail] = React.useState('')
  const [newLang, setNewLang] = React.useState<'pt-BR' | 'en-US'>('pt-BR')

  // Toggle helpers
  const toggle = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  // Build the final payload from selected contacts. Skip contacts
  // without email (defensive — they shouldn't be checkable in the UI
  // but better safe).
  const buildPayload = (): SendRecipientPayload[] => {
    const out: SendRecipientPayload[] = []
    for (const c of contacts) {
      if (!selectedIds.has(c.id) || !c.email) continue
      out.push({
        email: c.email,
        name: c.name,
        language: c.language,
        role: c.is_primary ? 'primary' : 'cc',
      })
    }
    return out
  }

  const handleAddContact = async () => {
    setError(null)
    const name = newName.trim()
    const email = newEmail.trim()
    if (!name) {
      setError('Nome é obrigatório')
      return
    }
    if (!isValidEmail(email)) {
      setError('E-mail inválido')
      return
    }

    setAdding(true)
    try {
      const res = await fetch(`/api/admin/clients/${clientId}/contacts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          email,
          language: newLang,
          is_primary: false,
          receives_copies: false,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data.error || 'Erro ao criar contato')
        setAdding(false)
        return
      }
      // Pre-select the new contact so the user doesn't have to scroll
      // and tick it after creation.
      const newId = data.contact?.id as string | undefined
      if (newId) {
        setSelectedIds((prev) => {
          const next = new Set(prev)
          next.add(newId)
          return next
        })
      }
      // Reset add form + collapse it
      setShowAddForm(false)
      setNewName('')
      setNewEmail('')
      setNewLang('pt-BR')
      // Tell the parent to refresh — that gives us the fresh contact
      // in the list (we currently don't have it in `contacts` prop).
      onContactAdded?.()
    } catch (e) {
      setError(`Erro de rede: ${(e as Error).message}`)
    } finally {
      setAdding(false)
    }
  }

  const handleConfirm = async () => {
    setError(null)
    const payload = buildPayload()
    if (payload.length === 0) {
      setError('Selecione pelo menos um destinatário')
      return
    }

    setSubmitting(true)
    try {
      await onConfirm(payload)
      onOpenChange(false)
    } catch (e) {
      setError((e as Error).message || 'Erro ao enviar')
    } finally {
      setSubmitting(false)
    }
  }

  const selectedCount = Array.from(selectedIds).filter((id) => {
    const c = contacts.find((x) => x.id === id)
    return c && c.email
  }).length

  return (
    <Dialog open={open} onOpenChange={(o) => !submitting && !adding && onOpenChange(o)}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Enviar proposta</DialogTitle>
          <DialogDescription>
            Selecione quem deve receber esta proposta. Cada destinatário
            recebe o link no idioma do contato.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 px-6 pb-2">
          {/* Contact list */}
          <div className="space-y-1.5">
            <Label className="text-[10px] uppercase tracking-widest text-muted-foreground">
              Contatos cadastrados
            </Label>
            {contacts.length === 0 ? (
              <p className="rounded-md border border-dashed border-border bg-muted/40 p-3 text-xs text-muted-foreground">
                Nenhum contato cadastrado neste cliente.
                <br />
                Use o botão abaixo pra adicionar antes de enviar.
              </p>
            ) : (
              <ul className="divide-y divide-border rounded-md border border-border">
                {contacts.map((c) => {
                  const checked = selectedIds.has(c.id)
                  const disabled = !c.email
                  return (
                    <li key={c.id} className="px-3 py-2.5">
                      <label
                        className={
                          'flex cursor-pointer items-center gap-3 ' +
                          (disabled ? 'cursor-not-allowed opacity-50' : '')
                        }
                      >
                        <Checkbox
                          checked={checked}
                          disabled={disabled}
                          onCheckedChange={() => !disabled && toggle(c.id)}
                        />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            <span className="truncate text-sm font-medium">
                              {c.name}
                            </span>
                            {c.is_primary && (
                              <Star className="h-3 w-3 flex-none text-primary" aria-label="Principal" />
                            )}
                          </div>
                          <div className="mt-0.5 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                            <span className="font-mono truncate">
                              {c.email || 'sem e-mail'}
                            </span>
                            <Badge variant="secondary" className="font-mono text-[10px]">
                              {c.language}
                            </Badge>
                            {c.is_primary && (
                              <span className="text-[10px] uppercase tracking-wider">
                                principal
                              </span>
                            )}
                            {c.receives_copies && !c.is_primary && (
                              <span className="text-[10px] uppercase tracking-wider">
                                cc
                              </span>
                            )}
                          </div>
                        </div>
                      </label>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>

          {/* Inline add form */}
          {showAddForm ? (
            <div className="space-y-3 rounded-md border border-border bg-muted/30 p-3">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Novo destinatário
                </span>
                <button
                  type="button"
                  onClick={() => setShowAddForm(false)}
                  className="rounded p-1 text-muted-foreground hover:bg-muted"
                  aria-label="Cancelar"
                  disabled={adding}
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <div>
                  <Label htmlFor="new-name" className="text-[10px] uppercase tracking-wider">
                    Nome
                  </Label>
                  <Input
                    id="new-name"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="Nome completo"
                    disabled={adding}
                  />
                </div>
                <div>
                  <Label htmlFor="new-email" className="text-[10px] uppercase tracking-wider">
                    E-mail
                  </Label>
                  <Input
                    id="new-email"
                    type="email"
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    placeholder="email@empresa.com"
                    disabled={adding}
                  />
                </div>
                <div>
                  <Label htmlFor="new-lang" className="text-[10px] uppercase tracking-wider">
                    Idioma
                  </Label>
                  <Select
                    value={newLang}
                    onValueChange={(v) => setNewLang(v as 'pt-BR' | 'en-US')}
                  >
                    <SelectTrigger id="new-lang">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pt-BR">Português (pt-BR)</SelectItem>
                      <SelectItem value="en-US">English (en-US)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <p className="text-[11px] text-muted-foreground">
                Será adicionado ao cadastro deste cliente como contato secundário.
              </p>
              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowAddForm(false)}
                  disabled={adding}
                >
                  Cancelar
                </Button>
                <Button
                  type="button"
                  size="sm"
                  onClick={handleAddContact}
                  disabled={adding}
                  className="gap-2"
                >
                  {adding ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
                  {adding ? 'Adicionando…' : 'Adicionar'}
                </Button>
              </div>
            </div>
          ) : (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setShowAddForm(true)}
              className="gap-2"
              disabled={submitting}
            >
              <Plus className="h-3.5 w-3.5" />
              Adicionar destinatário
            </Button>
          )}

          {error && <p className="text-xs text-destructive">{error}</p>}
        </div>

        <DialogFooter className="p-6 pt-2">
          <Button
            type="button"
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={submitting || adding}
          >
            Cancelar
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={submitting || adding || selectedCount === 0}
            className="gap-2"
          >
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            {submitting
              ? 'Enviando…'
              : selectedCount === 0
                ? 'Selecione um destinatário'
                : `Enviar pra ${selectedCount} destinatário${selectedCount > 1 ? 's' : ''}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
