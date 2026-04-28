'use client'

import * as React from 'react'
import { Check, ExternalLink, Mail, Phone, Plus, Star, Trash2, UserRound, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import { AvatarUpload } from '@/components/admin/AvatarUpload'

export interface ClientContact {
  id: string
  client_id: string
  name: string
  email: string | null
  role: string | null
  language: 'pt-BR' | 'en-US'
  is_primary: boolean
  receives_copies: boolean
  whatsapp: string | null
  linkedin_url: string | null
  avatar_url: string | null
  created_at: string
}

interface Props {
  clientId: string
  contacts: ClientContact[]
  onUpdate: () => void
  onError: (msg: string) => void
  onSuccess: (msg: string) => void
}

const EMPTY_FORM = {
  name: '', email: '', role: '', language: 'pt-BR' as 'pt-BR' | 'en-US',
  is_primary: false, receives_copies: false, whatsapp: '', linkedin_url: '',
}

export function ContactsSection({ clientId, contacts, onUpdate, onError, onSuccess }: Props) {
  const [editingId, setEditingId] = React.useState<string | null>(null) // 'new' | contact.id
  const [form, setForm] = React.useState(EMPTY_FORM)
  const [saving, setSaving] = React.useState(false)
  const [deleting, setDeleting] = React.useState<string | null>(null)
  // Holds the id of the contact pending confirmation. Null means no
  // dialog open. Replaces the native window.confirm() that was here
  // before — gives us a branded, focus-trapped, mobile-friendly modal.
  const [confirmingId, setConfirmingId] = React.useState<string | null>(null)

  function startAdd() {
    setForm({ ...EMPTY_FORM, is_primary: contacts.length === 0 })
    setEditingId('new')
  }

  function startEdit(c: ClientContact) {
    setForm({
      name: c.name, email: c.email ?? '', role: c.role ?? '',
      language: c.language, is_primary: c.is_primary,
      receives_copies: c.receives_copies, whatsapp: c.whatsapp ?? '',
      linkedin_url: c.linkedin_url ?? '',
    })
    setEditingId(c.id)
  }

  function cancel() { setEditingId(null); setForm(EMPTY_FORM) }

  function upd<K extends keyof typeof EMPTY_FORM>(k: K, v: typeof EMPTY_FORM[K]) {
    setForm(f => ({ ...f, [k]: v }))
  }

  async function save() {
    if (!form.name.trim()) { onError('Nome é obrigatório'); return }
    setSaving(true)
    const isNew = editingId === 'new'
    const url = isNew
      ? `/api/admin/clients/${clientId}/contacts`
      : `/api/admin/clients/${clientId}/contacts/${editingId}`
    const res = await fetch(url, {
      method: isNew ? 'POST' : 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: form.name.trim(), email: form.email.trim() || null,
        role: form.role.trim() || null, language: form.language,
        is_primary: form.is_primary, receives_copies: form.receives_copies,
        whatsapp: form.whatsapp.trim() || null,
        linkedin_url: form.linkedin_url.trim() || null,
      }),
    })
    setSaving(false)
    if (!res.ok) { onError('Erro ao salvar contato'); return }
    onSuccess(isNew ? 'Contato adicionado' : 'Contato atualizado')
    cancel()
    onUpdate()
  }

  async function setPrimary(contactId: string) {
    await fetch(`/api/admin/clients/${clientId}/contacts/${contactId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_primary: true }),
    })
    onUpdate()
  }

  // Step 1: user clicks the trash icon on a contact row.
  // We don't delete yet — surface the confirmation dialog.
  function requestRemove(contactId: string) {
    setConfirmingId(contactId)
  }

  // Step 2: user confirms inside the dialog. Actually deletes.
  async function performRemove() {
    const contactId = confirmingId
    if (!contactId) return
    setConfirmingId(null)
    setDeleting(contactId)
    const res = await fetch(`/api/admin/clients/${clientId}/contacts/${contactId}`, { method: 'DELETE' })
    setDeleting(null)
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      onError(err.error === 'cannot_delete_primary_with_others'
        ? 'Defina outro contato como principal antes de remover este'
        : 'Erro ao remover contato')
      return
    }
    onSuccess('Contato removido')
    onUpdate()
  }

  return (
    <div className="space-y-2">
      {contacts.map(c => (
        <div key={c.id}>
          {editingId === c.id ? (
            <ContactForm
              form={form} upd={upd} saving={saving}
              onSave={save} onCancel={cancel}
              showPrimary={!c.is_primary} contactCount={contacts.length}
            />
          ) : (
            <div className="group flex items-start justify-between gap-3 rounded-lg border border-border bg-muted/20 px-3.5 py-3 transition-colors hover:bg-muted/40">
              <div className="flex min-w-0 flex-1 items-start gap-3">
                <AvatarUpload
                  url={c.avatar_url}
                  name={c.name}
                  size={36}
                  shape="circle"
                  uploadUrl={`/api/admin/clients/${clientId}/contacts/${c.id}/avatar`}
                  deleteUrl={`/api/admin/clients/${clientId}/contacts/${c.id}/avatar`}
                  onUploaded={() => onUpdate()}
                  onDeleted={() => onUpdate()}
                />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-semibold">{c.name}</span>
                  {c.is_primary && (
                    <span className="inline-flex items-center gap-0.5 rounded-md border border-success/30 bg-success/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-success">
                      <Star size={9} className="fill-success text-success" /> Principal
                    </span>
                  )}
                  <span className="rounded-md border border-border px-1.5 py-0.5 text-[10px] text-muted-foreground">
                    {c.language}
                  </span>
                  {c.receives_copies && (
                    <span className="rounded-md border border-border bg-muted/60 px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground" title="Recebe cópias das notificações">
                      CC
                    </span>
                  )}
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5">
                  {c.role && <span className="text-xs text-muted-foreground">{c.role}</span>}
                  {c.email && (
                    <a href={`mailto:${c.email}`} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
                      <Mail size={10} />{c.email}
                    </a>
                  )}
                  {c.whatsapp && (
                    <span className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Phone size={10} />{c.whatsapp}
                    </span>
                  )}
                  {c.linkedin_url && (
                    <a href={c.linkedin_url} target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
                      <ExternalLink size={10} />LinkedIn
                    </a>
                  )}
                </div>
                </div>  {/* end inner info div */}
              </div>  {/* end flex gap-3 wrapper */}
              <div className="flex shrink-0 items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                {!c.is_primary && contacts.length > 1 && (
                  <button
                    type="button" onClick={() => setPrimary(c.id)} title="Tornar principal"
                    className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                  >
                    <Star size={13} />
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => startEdit(c)}
                  aria-label={`Editar ${c.name || 'contato'}`}
                  className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                >
                  <UserRound size={13} />
                </button>
                <button
                  type="button"
                  onClick={() => requestRemove(c.id)}
                  disabled={deleting === c.id}
                  aria-label={`Remover ${c.name || 'contato'}`}
                  className="rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            </div>
          )}
        </div>
      ))}

      {contacts.length === 0 && editingId !== 'new' && (
        <p className="py-2 text-xs text-muted-foreground">Nenhum contato cadastrado.</p>
      )}

      {editingId === 'new' ? (
        <ContactForm
          form={form} upd={upd} saving={saving}
          onSave={save} onCancel={cancel}
          showPrimary={contacts.length > 0} contactCount={contacts.length}
        />
      ) : (
        <button
          type="button" onClick={startAdd}
          className="flex w-full items-center gap-1.5 rounded-lg border border-dashed border-border px-3 py-2.5 text-xs text-muted-foreground transition-colors hover:border-foreground/30 hover:text-foreground"
        >
          <Plus size={12} /> Adicionar contato
        </button>
      )}

      <ConfirmDialog
        open={!!confirmingId}
        onOpenChange={(open) => !open && setConfirmingId(null)}
        title="Remover este contato?"
        description="Esta ação não pode ser desfeita."
        icon={Trash2}
        variant="destructive"
        confirmLabel="Sim, remover"
        onConfirm={performRemove}
      />
    </div>
  )
}

function ContactForm({
  form, upd, saving, onSave, onCancel, showPrimary, contactCount,
}: {
  form: typeof EMPTY_FORM
  upd: <K extends keyof typeof EMPTY_FORM>(k: K, v: typeof EMPTY_FORM[K]) => void
  saving: boolean
  onSave: () => void
  onCancel: () => void
  showPrimary: boolean
  contactCount: number
}) {
  return (
    <div className="rounded-lg border border-border bg-background p-4 shadow-sm">
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Nome *</Label>
          <Input value={form.name} onChange={e => upd('name', e.target.value)} placeholder="Nome completo" />
        </div>
        <div className="space-y-1.5">
          <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Cargo</Label>
          <Input value={form.role} onChange={e => upd('role', e.target.value)} placeholder="Designer, CEO..." />
        </div>
        <div className="space-y-1.5">
          <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Email</Label>
          <Input type="email" value={form.email} onChange={e => upd('email', e.target.value)} placeholder="email@empresa.com" />
        </div>
        <div className="space-y-1.5">
          <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">WhatsApp</Label>
          <Input value={form.whatsapp} onChange={e => upd('whatsapp', e.target.value)} placeholder="+55 47 99999-9999" />
        </div>
        <div className="col-span-2 space-y-1.5">
          <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">LinkedIn</Label>
          <Input value={form.linkedin_url} onChange={e => upd('linkedin_url', e.target.value)} placeholder="https://linkedin.com/in/nome" />
        </div>
        <div className="space-y-1.5">
          <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Idioma dos emails</Label>
          <div className="flex gap-1">
            {(['pt-BR', 'en-US'] as const).map(lang => (
              <button key={lang} type="button" onClick={() => upd('language', lang)}
                className={cn('flex-1 rounded border px-2 py-1.5 text-xs font-medium transition-colors',
                  form.language === lang ? 'border-foreground/40 bg-muted text-foreground' : 'border-border text-muted-foreground hover:text-foreground')}>
                {lang}
              </button>
            ))}
          </div>
        </div>
        <div className="flex flex-col justify-end gap-2">
          <label className="flex cursor-pointer items-center gap-2">
            <input type="checkbox" checked={form.receives_copies}
              onChange={e => upd('receives_copies', e.target.checked)}
              className="h-3.5 w-3.5 rounded border-border" />
            <span className="text-xs text-muted-foreground">Recebe cópias (CC)</span>
          </label>
          {showPrimary && contactCount > 0 && (
            <label className="flex cursor-pointer items-center gap-2">
              <input type="checkbox" checked={form.is_primary}
                onChange={e => upd('is_primary', e.target.checked)}
                className="h-3.5 w-3.5 rounded border-border" />
              <span className="text-xs text-muted-foreground">Definir como principal</span>
            </label>
          )}
        </div>
      </div>
      <div className="mt-3 flex gap-2">
        <button type="button" onClick={onCancel}
          className="flex items-center gap-1 rounded-md border border-border px-3 py-1.5 text-xs text-muted-foreground hover:bg-muted">
          <X size={11} /> Cancelar
        </button>
        <button type="button" onClick={onSave} disabled={saving}
          className="flex items-center gap-1 rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-neutral-900 hover:bg-primary/85 disabled:opacity-50">
          <Check size={11} /> {saving ? 'Salvando…' : 'Salvar contato'}
        </button>
      </div>
    </div>
  )
}
