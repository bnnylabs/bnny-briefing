'use client'

import * as React from 'react'
import { Mail, Plus, RefreshCw, Send, Star, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'

export type Recipient = { email: string; name: string; role: 'primary' | 'cc' }
type Contact = { id: string; name: string; email: string | null; is_primary: boolean; receives_copies: boolean }

interface Props {
  open: boolean
  onClose: () => void
  clientId: string
  briefingLabel: string
  briefingCompany: string
  type: 'reminder' | 'resend'
  /** Resolves with the picked recipients. If user closed without sending, never resolves. */
  onSubmit: (recipients: Recipient[]) => Promise<void>
}

const TITLES = {
  reminder: { title: 'Enviar lembrete', cta: 'Enviar lembrete', icon: Mail },
  resend:   { title: 'Reenviar briefing', cta: 'Reenviar', icon: Send },
}

export function RecipientPickerModal({
  open, onClose, clientId, briefingLabel, briefingCompany, type, onSubmit,
}: Props) {
  const [contacts, setContacts] = React.useState<Contact[]>([])
  const [loading, setLoading] = React.useState(true)
  const [selected, setSelected] = React.useState<Set<string>>(new Set())
  const [adHoc, setAdHoc] = React.useState<Array<{ email: string; name: string }>>([])
  const [showAdHocInput, setShowAdHocInput] = React.useState(false)
  const [adHocEmail, setAdHocEmail] = React.useState('')
  const [adHocName, setAdHocName] = React.useState('')
  const [sending, setSending] = React.useState(false)

  React.useEffect(() => {
    if (!open) return
    setLoading(true)
    setSelected(new Set())
    setAdHoc([])
    setShowAdHocInput(false)
    setAdHocEmail('')
    setAdHocName('')

    fetch(`/api/admin/clients/${clientId}`)
      .then(r => r.json())
      .then(d => {
        const list: Contact[] = (d.contacts ?? []).filter((c: Contact) => c.email)
        setContacts(list)
        // Pre-select primary + CCs by default
        const initial = new Set<string>()
        for (const c of list) {
          if ((c.is_primary || c.receives_copies) && c.email) initial.add(c.id)
        }
        setSelected(initial)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [open, clientId])

  if (!open) return null

  function toggle(id: string) {
    setSelected(s => {
      const next = new Set(s)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  function addAdHoc() {
    const email = adHocEmail.trim()
    const name = adHocName.trim() || email.split('@')[0]
    if (!email || !email.includes('@')) return
    if (adHoc.some(r => r.email.toLowerCase() === email.toLowerCase())) return
    setAdHoc(a => [...a, { email, name }])
    setAdHocEmail('')
    setAdHocName('')
    setShowAdHocInput(false)
  }

  function removeAdHoc(email: string) {
    setAdHoc(a => a.filter(r => r.email !== email))
  }

  async function handleSubmit() {
    const fromContacts: Recipient[] = contacts
      .filter(c => selected.has(c.id) && c.email)
      .map(c => ({
        email: c.email!,
        name: c.name,
        role: c.is_primary ? 'primary' : 'cc',
      }))
    const fromAdHoc: Recipient[] = adHoc.map(r => ({ email: r.email, name: r.name, role: 'cc' as const }))
    const all = [...fromContacts, ...fromAdHoc]
    if (all.length === 0) return

    setSending(true)
    try { await onSubmit(all); onClose() }
    finally { setSending(false) }
  }

  const totalSelected = selected.size + adHoc.length
  const cfg = TITLES[type]
  const Icon = cfg.icon

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-in fade-in-0 duration-150"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-md rounded-xl bg-card border border-border p-6 shadow-2xl animate-in fade-in-0 zoom-in-95 slide-in-from-bottom-1 duration-200 max-h-[88vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <button onClick={onClose}
          className="absolute right-3.5 top-3.5 flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
          <X size={15} />
        </button>

        <div className="mb-5 pr-8">
          <div className="font-bold text-lg tracking-tight">{cfg.title}</div>
          <p className="mt-0.5 text-sm text-muted-foreground">{briefingCompany} · {briefingLabel}</p>
        </div>

        {loading ? (
          <div className="py-8 text-center text-sm text-muted-foreground">Carregando contatos…</div>
        ) : (
          <>
            <div className="mb-2 text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
              Quem deve receber?
            </div>

            <div className="flex flex-col gap-1.5">
              {contacts.length === 0 && adHoc.length === 0 && (
                <div className="rounded-md border border-dashed border-border px-3 py-3 text-center text-xs text-muted-foreground">
                  Nenhum contato cadastrado.
                </div>
              )}

              {contacts.map(c => (
                <label key={c.id}
                  className="flex cursor-pointer items-center gap-2.5 rounded-md border border-border bg-muted/20 px-3 py-2 transition-colors hover:bg-muted/40">
                  <Checkbox checked={selected.has(c.id)} onCheckedChange={() => toggle(c.id)} className="shrink-0" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="truncate text-sm font-medium">{c.name}</span>
                      {c.is_primary && (
                        <span className="inline-flex items-center gap-0.5 rounded-md border border-lime-300 bg-lime-50 px-1 py-0 text-[10px] font-semibold uppercase tracking-wide text-lime-700">
                          <Star size={8} className="fill-lime-600 text-lime-600" /> Principal
                        </span>
                      )}
                      {!c.is_primary && c.receives_copies && (
                        <span className="rounded-md border border-border bg-muted/60 px-1 py-0 text-[10px] font-medium text-muted-foreground">CC</span>
                      )}
                    </div>
                    <div className="truncate text-xs text-muted-foreground">{c.email}</div>
                  </div>
                </label>
              ))}

              {adHoc.map(r => (
                <div key={r.email}
                  className="flex items-center gap-2.5 rounded-md border border-border bg-muted/20 px-3 py-2">
                  <div className="flex h-4 w-4 shrink-0 items-center justify-center">
                    <span className="h-2 w-2 rounded-full bg-foreground/50" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="truncate text-sm font-medium">{r.name}</span>
                      <span className="rounded-md border border-border bg-muted/60 px-1 py-0 text-[10px] font-medium text-muted-foreground">AVULSO</span>
                    </div>
                    <div className="truncate text-xs text-muted-foreground">{r.email}</div>
                  </div>
                  <button onClick={() => removeAdHoc(r.email)}
                    className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-destructive/10 hover:text-destructive">
                    <X size={12} />
                  </button>
                </div>
              ))}

              {showAdHocInput ? (
                <div className="rounded-md border border-border bg-muted/20 p-2.5 space-y-2">
                  <Input value={adHocName} onChange={e => setAdHocName(e.target.value)}
                    placeholder="Nome (opcional)" className="text-sm" />
                  <Input value={adHocEmail} onChange={e => setAdHocEmail(e.target.value)}
                    placeholder="email@exemplo.com" type="email"
                    onKeyDown={e => e.key === 'Enter' && addAdHoc()}
                    className="text-sm" autoFocus />
                  <div className="flex justify-end gap-2">
                    <Button variant="ghost" size="sm" onClick={() => { setShowAdHocInput(false); setAdHocEmail(''); setAdHocName('') }}>
                      Cancelar
                    </Button>
                    <Button size="sm" onClick={addAdHoc} disabled={!adHocEmail.includes('@')}>
                      Adicionar
                    </Button>
                  </div>
                </div>
              ) : (
                <button onClick={() => setShowAdHocInput(true)}
                  className="inline-flex items-center justify-center gap-1.5 rounded-md border border-dashed border-border px-3 py-2 text-xs text-muted-foreground transition-colors hover:border-foreground/30 hover:text-foreground">
                  <Plus size={12} /> Adicionar destinatário avulso
                </button>
              )}
            </div>

            <div className="mt-5 flex items-center justify-between gap-3 border-t border-border pt-5">
              <span className="text-xs text-muted-foreground">
                {totalSelected === 0
                  ? 'Selecione ao menos um destinatário'
                  : `${totalSelected} destinatário${totalSelected > 1 ? 's' : ''} selecionado${totalSelected > 1 ? 's' : ''}`}
              </span>
              <Button onClick={handleSubmit} disabled={totalSelected === 0 || sending}>
                {sending ? <RefreshCw size={14} className="animate-spin" /> : <Icon size={14} />}
                {sending ? 'Enviando…' : cfg.cta}
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
