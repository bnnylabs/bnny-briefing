'use client'

import { useCallback, useMemo, useRef, useState } from 'react'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import {
  ArrowLeft, Check, Loader2, Eye, Plus,
  ChevronDown, FileText, AlignLeft, Clock,
  Send, Link as LinkIcon, MoreHorizontal, Download,
  Users, LayoutTemplate, Languages,
} from 'lucide-react'

import { Badge }    from '@/components/ui/badge'
import { Breadcrumbs } from '@/components/ui/breadcrumbs'
import { Button }   from '@/components/ui/button'
import { IconButton } from '@/components/ui/icon-button'
import { Input }    from '@/components/ui/input'
import { Card }     from '@/components/ui/card'
import {
  Dialog, DialogContent, DialogDescription,
  DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent,
  DropdownMenuItem, DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { useToast, ToastContainer } from '@/components/toast'
import { cn } from '@/lib/utils'
import { DatePicker, parseIsoDate, toIsoDate } from '@/components/ui/date-picker'
import { formatDistanceToNow } from 'date-fns'
import { ptBR } from 'date-fns/locale'

import {
  formatProposalNumber,
  PROPOSAL_STATUS_LABELS_PT,
  proposalStatusVariant,
  type BlockContentInvestment,
  type ProposalBlock,
  type ProposalBlockContent,
  type ProposalBlockType,
  type ProposalPhase,
  type ProposalStatus,
  type ProposalWithClient,
} from '@/lib/proposal-types'
import { fmtCurrency, fmtDate, fmtDateLong } from '@/lib/proposal-editor-utils'

import { useAutoSave, type AutoSaveStatus } from './useAutoSave'
import { RewriteButton } from './RewriteButton'
import { BlockReadOnly } from './BlockReadOnly'
import { SendDialog, type SendContact, type SendRecipientPayload } from './SendDialog'
import { TranslationPill } from './TranslationPill'
import { MasterTranslateDialog, type TranslationSummary } from './MasterTranslateDialog'
import { ReviewBlockButton } from './ReviewBlockButton'
import { SaveIndicator } from './SaveIndicator'
import { CardHeader, FieldLabel } from './editor-cards/EditorPrimitives'
import { DetalheRow, MissingSection } from './editor-cards/EditorMisc'
import { InternalNotesCard } from './editor-cards/InternalNotesCard'
import { PhasesCard } from './editor-cards/PhasesCard'
import { InvestimentoCard } from './editor-cards/InvestimentoCard'
import { IACard } from './editor-cards/IACard'
import type { ProposalLanguage } from '@/lib/proposal-types'

// ─── Constants ────────────────────────────────────────────────────────────

const STATUS_COLORS: Record<ProposalStatus, string> = {
  draft:    'border-border bg-muted text-muted-foreground',
  sent:     'border-info/30 bg-info/10 text-info',
  viewed:   'border-warning/30 bg-warning/10 text-warning',
  approved: 'border-success/30 bg-success/10 text-success',
  rejected: 'border-destructive/30 bg-destructive/10 text-destructive',
  revised:  'border-warning/30 bg-warning/10 text-warning',
  expired:  'border-border bg-muted text-muted-foreground/70',
}

// ─── Main component ───────────────────────────────────────────────────────

interface ProposalEditorProps {
  initialProposal: ProposalWithClient
  initialBlocks: ProposalBlock[]
}

export function ProposalEditor({ initialProposal, initialBlocks }: ProposalEditorProps) {
  const { toasts, toast, remove } = useToast()
  const router = useRouter()

  const [mode, setMode]           = useState<'ficha' | 'document'>('ficha')
  const [proposal, setProposal]   = useState<ProposalWithClient>(initialProposal)
  const [blocks, setBlocks]       = useState<ProposalBlock[]>(initialBlocks)
  const [deleteTarget, setDeleteTarget] = useState<ProposalBlock | null>(null)

  // ── Send dialog state ──────────────────────────────────────────────────
  // The "Enviar proposta" button opens this dialog instead of firing
  // immediately. Lets the owner choose specific recipients and add new
  // contacts inline. Lazy-loaded contacts — only fetched on open.
  const [sendOpen, setSendOpen] = useState(false)
  const [sendContacts, setSendContacts] = useState<SendContact[]>([])
  const [sendContactsLoading, setSendContactsLoading] = useState(false)

  // ── Advanced actions: change client / change template ─────────────────
  // Lazy-fetched lists for the change dialogs. Empty until the owner
  // opens the menu — most proposal editing sessions never open these.
  const [changeClientOpen, setChangeClientOpen]     = useState(false)
  const [changeTemplateOpen, setChangeTemplateOpen] = useState(false)
  const [advancedClients, setAdvancedClients]   = useState<Array<{ id: string; company: string; name: string }>>([])
  const [advancedTemplates, setAdvancedTemplates] = useState<Array<{ id: string; name: string; type: string | null }>>([])
  const [advancedClientChoice, setAdvancedClientChoice]     = useState<string>('')
  const [advancedTemplateChoice, setAdvancedTemplateChoice] = useState<string>('')
  const [advancedSaving, setAdvancedSaving]                 = useState(false)

  // ── Translation (Phase G) ─────────────────────────────────────────────
  // Master "translate everything" lives in the More-actions menu and opens
  // a confirmation dialog. Per-block status pills sit on each card header.
  // Target language is the binary opposite of the proposal's source.
  const [masterTranslateOpen, setMasterTranslateOpen] = useState(false)
  const translationTargetLang: ProposalLanguage =
    proposal.language === 'pt-BR' ? 'en-US' : 'pt-BR'

  const slug = proposal.slug
  const proposalDirtyRef = useRef(false)
  const blockDirtyIdsRef = useRef<Set<string>>(new Set())

  // ── Auto-save ─────────────────────────────────────────────────────────

  const saveProposalMeta = useCallback(async () => {
    if (!proposalDirtyRef.current) return
    const res = await fetch(`/api/proposals/${slug}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: proposal.title,
        valid_until: proposal.valid_until,
        total_amount: proposal.total_amount,
        payment_terms: proposal.payment_terms,
        internal_notes: proposal.internal_notes,
      }),
    })
    if (!res.ok) throw new Error('save failed')
    proposalDirtyRef.current = false
  }, [slug, proposal.title, proposal.valid_until, proposal.total_amount, proposal.payment_terms, proposal.internal_notes])

  const proposalSave = useAutoSave(saveProposalMeta)

  const saveBlocks = useCallback(async () => {
    if (blockDirtyIdsRef.current.size === 0) return
    const ids = Array.from(blockDirtyIdsRef.current)
    blockDirtyIdsRef.current.clear()
    const snapshot = blocks
    const errors: string[] = []
    await Promise.all(ids.map(async (id) => {
      const b = snapshot.find((x) => x.id === id)
      if (!b) return
      try {
        const res = await fetch(`/api/proposals/${slug}/blocks/${id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content: b.content, visible: b.visible }),
        })
        if (!res.ok) errors.push(id)
      } catch { errors.push(id) }
    }))
    if (errors.length > 0) {
      errors.forEach((id) => blockDirtyIdsRef.current.add(id))
      throw new Error('save failed')
    }
  }, [slug, blocks])

  const blocksSave = useAutoSave(saveBlocks)

  const combinedStatus: AutoSaveStatus = useMemo(() => {
    const order: AutoSaveStatus[] = ['error', 'saving', 'saved', 'idle']
    for (const s of order) if (proposalSave.status === s || blocksSave.status === s) return s
    return 'idle'
  }, [proposalSave.status, blocksSave.status])

  const combinedSavedAt = useMemo(() => {
    const max = Math.max(proposalSave.lastSavedAt ?? 0, blocksSave.lastSavedAt ?? 0)
    return max === 0 ? null : max
  }, [proposalSave.lastSavedAt, blocksSave.lastSavedAt])

  // ── Mutators ─────────────────────────────────────────────────────────

  const patchProposal = (patch: Partial<ProposalWithClient>) => {
    setProposal((p) => ({ ...p, ...patch }))
    proposalDirtyRef.current = true
    proposalSave.schedule()
  }

  const patchBlock = (id: string, content: ProposalBlockContent) => {
    setBlocks((arr) => arr.map((b) => (b.id === id ? { ...b, content } : b)))
    blockDirtyIdsRef.current.add(id)
    blocksSave.schedule()

    const block = blocks.find((b) => b.id === id)
    if (block?.type === 'investment') {
      const inv = content as BlockContentInvestment
      setProposal((p) => ({
        ...p,
        total_amount: inv.total_amount ?? p.total_amount,
        payment_terms: inv.payment_terms ?? p.payment_terms,
      }))
      proposalDirtyRef.current = true
      proposalSave.schedule()
    }
  }

  // Per-block translation result handler — patches translations + meta
  // in local state so the pill re-renders fresh without a full reload.
  // The block's `content` is unchanged (translation lives in a separate
  // column), so this is independent of patchBlock.
  const onBlockTranslated = (
    id: string,
    next: {
      translations: ProposalBlock['translations']
      translations_meta: ProposalBlock['translations_meta']
    },
  ) => {
    setBlocks((arr) =>
      arr.map((b) =>
        b.id === id
          ? {
              ...b,
              translations: next.translations,
              translations_meta: next.translations_meta,
            }
          : b,
      ),
    )
  }

  // Master translation result — server returns only a summary, so we
  // refresh the route to re-pull the latest translations from Supabase.
  // Toast surfaces the counts so the operator knows what happened.
  const onMasterTranslated = (summary: TranslationSummary) => {
    const langLabel = summary.targetLang === 'en-US' ? 'English' : 'Português'
    const parts: string[] = [`${summary.blocks.translated} blocos traduzidos`]
    if (summary.blocks.skipped_fresh > 0) {
      parts.push(`${summary.blocks.skipped_fresh} já atualizados`)
    }
    if (summary.blocks.failed > 0) {
      parts.push(`${summary.blocks.failed} com erro`)
    }
    const variant = summary.blocks.failed > 0 ? 'error' : 'success'
    toast(`Tradução para ${langLabel} · ${parts.join(' · ')}`, variant)
    router.refresh()
  }

  const confirmDeleteBlock = async () => {
    if (!deleteTarget) return
    const id = deleteTarget.id
    setDeleteTarget(null)
    const res = await fetch(`/api/proposals/${slug}/blocks/${id}`, { method: 'DELETE' })
    if (!res.ok) { toast('Erro ao remover', 'error'); return }
    setBlocks((arr) => arr.filter((b) => b.id !== id))
    blockDirtyIdsRef.current.delete(id)
  }

  const addBlock = async (type: ProposalBlockType) => {
    let content: ProposalBlockContent | undefined
    if (type === 'investment') {
      content = { intro: '', total_amount: proposal.total_amount, currency: proposal.currency, payment_terms: proposal.payment_terms } as BlockContentInvestment
    }
    const res = await fetch(`/api/proposals/${slug}/blocks`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type, content }),
    })
    if (!res.ok) { toast('Erro ao adicionar seção', 'error'); return }
    const data = await res.json()
    setBlocks((arr) => [...arr, data.block as ProposalBlock])
  }

  // Status changing
  const [editingStatus, setEditingStatus] = useState(false)
  const changeStatus = async (next: ProposalStatus) => {
    setEditingStatus(false)
    if (next === proposal.status) return
    setProposal((p) => ({ ...p, status: next }))
    const res = await fetch(`/api/proposals/${slug}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: next }),
    })
    if (!res.ok) { toast('Erro ao mudar status', 'error'); return }
    toast(`Status: ${PROPOSAL_STATUS_LABELS_PT[next]}`, 'success', 1500)
  }

  // ── Send + public link ────────────────────────────────────────────────
  // 'Enviar proposta' transitions draft → sent, server stamps sent_at,
  // and the public URL is auto-copied to the clipboard so the owner can
  // immediately paste it to the client (WhatsApp, email, etc.).

  const publicUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/p/${slug}`
    : `/p/${slug}`

  const copyPublicLink = async () => {
    try {
      await navigator.clipboard.writeText(publicUrl)
      toast('Link copiado', 'success', 1500)
    } catch {
      toast('Não foi possível copiar', 'error')
    }
  }

  // Fetch the client's contact list for the SendDialog. Cached in
  // sendContacts state — refreshed when the dialog opens, and after
  // an inline contact creation.
  const refreshSendContacts = useCallback(async () => {
    setSendContactsLoading(true)
    try {
      const res = await fetch(`/api/admin/clients/${proposal.client_id}/contacts`, {
        cache: 'no-store',
      })
      if (res.ok) {
        const data = await res.json()
        const list: SendContact[] = (data.contacts ?? []).map(
          (c: {
            id: string
            name: string
            email: string | null
            language: string
            is_primary: boolean
            receives_copies: boolean
            role?: string | null
          }) => ({
            id: c.id,
            name: c.name,
            email: c.email,
            language: (c.language === 'en-US' ? 'en-US' : 'pt-BR') as 'pt-BR' | 'en-US',
            is_primary: !!c.is_primary,
            receives_copies: !!c.receives_copies,
            role: c.role ?? null,
          }),
        )
        setSendContacts(list)
      } else {
        toast('Erro ao carregar contatos', 'error')
      }
    } catch (e) {
      console.warn('[ProposalEditor] fetch contacts failed:', e)
    } finally {
      setSendContactsLoading(false)
    }
  }, [proposal.client_id, toast])

  const handleSend = async () => {
    // Flush any pending edits before opening the dialog so the proposal
    // the user is about to send reflects what they last typed.
    proposalSave.flush()
    blocksSave.flush()

    // Lazy-load contacts on first open. Subsequent opens reuse cache,
    // unless a new contact was added inline (refreshSendContacts is
    // called from the dialog's onContactAdded).
    if (sendContacts.length === 0 && !sendContactsLoading) {
      await refreshSendContacts()
    }
    setSendOpen(true)
  }

  // Called by SendDialog after the user picks recipients and confirms.
  // Posts to /api/proposals/[slug]/send with recipients_override and
  // handles the optimistic UI update + rollback.
  const executeSend = async (recipients: SendRecipientPayload[]) => {
    const prevStatus = proposal.status
    const prevSentAt = proposal.sent_at
    setProposal((p) => ({
      ...p,
      status: 'sent',
      sent_at: p.sent_at ?? new Date().toISOString(),
    }))

    const res = await fetch(`/api/proposals/${slug}/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ recipients_override: recipients }),
    })

    if (!res.ok) {
      // Roll back the optimistic change.
      setProposal((p) => ({ ...p, status: prevStatus, sent_at: prevSentAt }))
      const { error } = await res.json().catch(() => ({ error: 'Erro ao enviar' }))
      toast(error || 'Erro ao enviar proposta', 'error', 4000)
      // Re-throw so the dialog can keep itself open with the error
      throw new Error(error || 'Erro ao enviar proposta')
    }

    toast(
      `Proposta enviada pra ${recipients.length} destinatário${recipients.length > 1 ? 's' : ''}`,
      'success',
      2500,
    )

    // Best-effort copy of the public link as a convenience (so the owner
    // can also forward by WhatsApp etc.).
    try {
      await navigator.clipboard.writeText(publicUrl)
    } catch (e) {
      console.warn('[ProposalEditor] clipboard write silenced:', e)
    }
  }

  // ── Advanced action: change client ────────────────────────────────────
  const openChangeClient = useCallback(async () => {
    setAdvancedClientChoice(proposal.client_id)
    setChangeClientOpen(true)
    // Lazy fetch — only when the dialog actually opens
    if (advancedClients.length === 0) {
      try {
        const res = await fetch('/api/admin/clients', { cache: 'no-store' })
        if (res.ok) {
          const data = await res.json()
          const list = (data.clients ?? []).map((c: { id: string; name: string; company: string }) => ({
            id: c.id, name: c.name, company: c.company,
          }))
          setAdvancedClients(list)
        }
      } catch (e) {
        console.warn('[ProposalEditor] fetch /api/admin/clients silenced:', e)
      }
    }
  }, [proposal.client_id, advancedClients.length])

  const submitChangeClient = async () => {
    if (!advancedClientChoice || advancedClientChoice === proposal.client_id) {
      setChangeClientOpen(false); return
    }
    setAdvancedSaving(true)
    try {
      const res = await fetch(`/api/proposals/${slug}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ client_id: advancedClientChoice }),
      })
      if (!res.ok) { toast('Erro ao trocar cliente', 'error'); return }
      const { proposal: updated } = await res.json()
      // Replace local state with fresh server data — also refreshes
      // the joined client object (avatar, company, etc.)
      setProposal(updated)
      toast('Cliente atualizado', 'success', 1500)
      setChangeClientOpen(false)
    } finally {
      setAdvancedSaving(false)
    }
  }

  // ── Advanced action: change template ──────────────────────────────────
  // Note: changing the template here only changes the template_id link;
  // existing block content is NOT overwritten. The owner can use the
  // 'Personalizar com IA' card to regenerate against the new template.
  const openChangeTemplate = useCallback(async () => {
    setAdvancedTemplateChoice(proposal.template_id ?? '')
    setChangeTemplateOpen(true)
    if (advancedTemplates.length === 0) {
      try {
        const res = await fetch('/api/proposal-templates', { cache: 'no-store' })
        if (res.ok) {
          const data = await res.json()
          setAdvancedTemplates(data.templates ?? [])
        }
      } catch (e) {
        console.warn('[ProposalEditor] fetch /api/proposal-templates silenced:', e)
      }
    }
  }, [proposal.template_id, advancedTemplates.length])

  const submitChangeTemplate = async () => {
    const next = advancedTemplateChoice || null
    if (next === proposal.template_id) {
      setChangeTemplateOpen(false); return
    }
    setAdvancedSaving(true)
    try {
      const res = await fetch(`/api/proposals/${slug}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ template_id: next }),
      })
      if (!res.ok) { toast('Erro ao trocar modelo', 'error'); return }
      const { proposal: updated } = await res.json()
      setProposal(updated)
      toast('Modelo atualizado — use a IA para regenerar o conteúdo', 'success', 2500)
      setChangeTemplateOpen(false)
    } finally {
      setAdvancedSaving(false)
    }
  }

  const status = proposal.status as ProposalStatus
  const sorted = [...blocks].sort((a, b) => a.position - b.position)

  const headerBlock     = sorted.find((b) => b.type === 'header')
  const phasesBlock     = sorted.find((b) => b.type === 'phases')
  const investmentBlock = sorted.find((b) => b.type === 'investment')

  // ── Render ────────────────────────────────────────────────────────────

  if (mode === 'document') {
    return (
      <DocumentView
        proposal={proposal}
        blocks={sorted}
        status={status}
        onEdit={() => setMode('ficha')}
      />
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <ToastContainer toasts={toasts} remove={remove} />

      {/* Auto-save progress bar — thin mint-teal line at the very top
          of the viewport, only visible while a save is actually in
          flight. Mirrors the textual 'Salvando…' indicator in the page
          header but gives a peripheral signal that doesn't compete for
          attention with the main content. */}
      {combinedStatus === 'saving' && <div className="save-progress" aria-hidden="true" />}

      <div className="mx-auto max-w-5xl p-6">

        {/* Breadcrumbs — replaces standalone <ArrowLeft> back button.
            Same pattern as /admin/clientes/[id] (v0.10.52): keeps the
            hero row visually flush with the cards below. Shows the
            proposal number as the current-page label since 'O que é'
            é mais reconhecível que o título quando a proposta tem
            título genérico. */}
        <Breadcrumbs items={[
          { label: 'Propostas', href: '/admin/propostas' },
          { label: formatProposalNumber(proposal.number, proposal.version_suffix) },
        ]} />

        {/* ── Page header ─────────────────────────────────────────────── */}
        <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
          <div className="flex min-w-0 flex-1 items-start gap-3">
            {/* Client avatar (or fallback icon) */}
            <div className="relative hidden h-12 w-12 shrink-0 overflow-hidden rounded-lg border border-border bg-muted/40 sm:block">
              {proposal.clients?.avatar_url ? (
                <Image
                  src={proposal.clients.avatar_url}
                  alt={proposal.clients.company}
                  fill
                  className="object-cover"
                  sizes="48px"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-muted-foreground">
                  <FileText className="h-5 w-5" />
                </div>
              )}
            </div>

            <div className="min-w-0 flex-1">
              {/* Title alone on its row — no competing elements */}
              <Input
                value={proposal.title}
                onChange={(e) => patchProposal({ title: e.target.value })}
                placeholder="Sem título"
                className="h-auto w-full border-0 bg-transparent p-0 font-mono text-xl font-bold tracking-tight shadow-none focus-visible:ring-0 placeholder:text-muted-foreground/40"
              />

              {/* Metadata line with status pill + save indicator inline */}
              <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                <span className="font-mono tabular-nums">
                  {formatProposalNumber(proposal.number, proposal.version_suffix)}
                </span>

                <span>·</span>

                {/* Clickable status pill */}
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setEditingStatus((e) => !e)}
                    aria-haspopup="menu"
                    aria-expanded={editingStatus}
                    title="Mudar status"
                    className={cn(
                      'inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[11px] font-medium transition-colors',
                      'hover:bg-muted/60',
                      STATUS_COLORS[status],
                    )}
                  >
                    {PROPOSAL_STATUS_LABELS_PT[status]}
                    <ChevronDown
                      size={12}
                      strokeWidth={2.5}
                      className={cn('-mr-0.5 transition-transform', editingStatus && 'rotate-180')}
                    />
                  </button>
                  {editingStatus && (
                    <div className="absolute left-0 top-full z-10 mt-1 w-40 overflow-hidden rounded-lg border border-border bg-card shadow-lg">
                      {(Object.keys(PROPOSAL_STATUS_LABELS_PT) as ProposalStatus[]).map((s) => (
                        <button
                          key={s}
                          type="button"
                          onClick={() => changeStatus(s)}
                          className={cn(
                            'flex w-full items-center gap-2 px-3 py-2 text-xs transition-colors hover:bg-muted',
                            status === s && 'font-semibold',
                          )}
                        >
                          <span className={cn('h-1.5 w-1.5 rounded-full border', STATUS_COLORS[s])} />
                          {PROPOSAL_STATUS_LABELS_PT[s]}
                          {status === s && <Check size={10} className="ml-auto" />}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {proposal.clients?.company && (<>
                  <span>·</span>
                  <span>para {proposal.clients.company}</span>
                </>)}
                <span>·</span>
                <span>criada {formatDistanceToNow(new Date(proposal.created_at), { locale: ptBR, addSuffix: true })}</span>

                {(combinedStatus !== 'idle' || combinedSavedAt) && (<>
                  <span>·</span>
                  <SaveIndicator status={combinedStatus} lastSavedAt={combinedSavedAt} />
                </>)}
              </div>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            {/* Enviar — only visible on draft */}
            {status === 'draft' && (
              <Button onClick={handleSend} variant="outline">
                <Send className="mr-1.5 h-4 w-4" />Enviar proposta
              </Button>
            )}

            {/* Copiar link — visible once the proposal has been shipped */}
            {(status === 'sent' || status === 'viewed' || status === 'approved') && (
              <Button onClick={copyPublicLink} variant="outline">
                <LinkIcon className="mr-1.5 h-4 w-4" />Copiar link
              </Button>
            )}

            <Button onClick={() => { proposalSave.flush(); blocksSave.flush(); setMode('document') }}>
              <Eye className="mr-1.5 h-4 w-4" />Visualizar proposta
            </Button>

            {/* More actions — advanced edits like changing client/template */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon" aria-label="Mais ações">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuItem onClick={openChangeClient} className="cursor-pointer">
                  <Users className="mr-2 h-4 w-4" />
                  Trocar cliente
                </DropdownMenuItem>
                <DropdownMenuItem onClick={openChangeTemplate} className="cursor-pointer">
                  <LayoutTemplate className="mr-2 h-4 w-4" />
                  Trocar modelo
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => setMasterTranslateOpen(true)}
                  className="cursor-pointer"
                >
                  <Languages className="mr-2 h-4 w-4" />
                  Traduzir para {translationTargetLang === 'en-US' ? 'English' : 'Português'}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={copyPublicLink} className="cursor-pointer">
                  <LinkIcon className="mr-2 h-4 w-4" />
                  Copiar link público
                </DropdownMenuItem>
                {/* PDF download — only enabled once the proposal is past draft.
                    Drafts return 404 from the public PDF endpoint, so showing
                    it for draft would just produce a broken download. */}
                {status !== 'draft' && (
                  <DropdownMenuItem
                    onClick={() => {
                      const lq = proposal.language === 'en-US' ? 'en' : 'pt'
                      window.open(`/api/p/${slug}/pdf?l=${lq}`, '_blank')
                    }}
                    className="cursor-pointer"
                  >
                    <Download className="mr-2 h-4 w-4" />
                    Baixar PDF
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* ── 2-column layout ─────────────────────────────────────────── */}
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1fr_300px] lg:items-start">

          {/* ── Left column ──────────────────────────────────────────── */}
          <div className="flex flex-col gap-5">

            {/* IA Assistente — primary action, fills the content below */}
            <IACard
              proposal={proposal}
              onPersonalize={async ({ context, addresseeName }) => {
                const res = await fetch('/api/proposals/generate', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    template_id: proposal.template_id,
                    client_id: proposal.client_id,
                    context,
                    addressee_name: addresseeName.trim() || null,
                  }),
                })
                if (!res.ok) { toast('IA indisponível agora', 'error'); return }
                const data = await res.json()
                const overrides = data.content_overrides
                if (!overrides) return

                if (headerBlock && overrides.header) {
                  patchBlock(headerBlock.id, overrides.header)
                }
                if (phasesBlock && overrides.phases) {
                  // Preserve existing visible flags on phases (user toggles)
                  const oldPhases = (phasesBlock.content as { phases?: ProposalPhase[] }).phases ?? []
                  const newPhases = overrides.phases.phases.map((p: ProposalPhase, i: number) => ({
                    ...p,
                    visible: oldPhases[i]?.visible ?? true,
                  }))
                  patchBlock(phasesBlock.id, { phases: newPhases })
                }
                toast('Proposta personalizada com IA', 'success')
              }}
            />

            {/* Texto de abertura */}
            {headerBlock ? (
              <Card className="p-5">
                <CardHeader
                  icon={<AlignLeft className="h-4 w-4" />}
                  title="Texto de abertura"
                  action={
                    <div className="flex items-center gap-2">
                      <TranslationPill
                        block={headerBlock}
                        sourceLang={proposal.language}
                        targetLang={translationTargetLang}
                        slug={slug}
                        onTranslated={(next) => onBlockTranslated(headerBlock.id, next)}
                        onError={(msg) => toast(msg, 'error')}
                      />
                      <ReviewBlockButton
                        slug={slug}
                        block={headerBlock}
                        blockLabel="Texto de abertura"
                        onApplied={(revised) => patchBlock(headerBlock.id, revised)}
                        onError={(msg) => toast(msg, 'error')}
                      />
                      <RewriteButton
                        value={(headerBlock.content as { body?: string }).body ?? ''}
                        kind="header_body"
                        clientId={proposal.client_id}
                        onRewritten={(text) => patchBlock(headerBlock.id, { body: text })}
                        onError={(msg) => toast(msg, 'error')}
                      />
                    </div>
                  }
                />
                <textarea
                  value={(headerBlock.content as { body?: string }).body ?? ''}
                  onChange={(e) => patchBlock(headerBlock.id, { body: e.target.value })}
                  placeholder="Foi um prazer conversar com você…"
                  rows={4}
                  className={cn(
                    'flex w-full resize-y rounded-md border border-border bg-secondary px-3 py-2.5',
                    'text-sm text-foreground placeholder:text-muted-foreground/50',
                    'focus:outline-none focus:ring-2 focus:ring-ring/30 focus:border-primary/30',
                    'transition-all duration-150',
                  )}
                />
              </Card>
            ) : (
              <MissingSection label="Texto de abertura" type="header" onAdd={addBlock} />
            )}

            {/* Fases */}
            {phasesBlock ? (
              <PhasesCard
                block={phasesBlock}
                onChange={(c) => patchBlock(phasesBlock.id, c)}
                clientId={proposal.client_id}
                onRewriteError={(msg) => toast(msg, 'error')}
                headerExtra={
                  <>
                    <TranslationPill
                      block={phasesBlock}
                      sourceLang={proposal.language}
                      targetLang={translationTargetLang}
                      slug={slug}
                      onTranslated={(next) => onBlockTranslated(phasesBlock.id, next)}
                      onError={(msg) => toast(msg, 'error')}
                    />
                    <ReviewBlockButton
                      slug={slug}
                      block={phasesBlock}
                      blockLabel="Fases do projeto"
                      onApplied={(revised) => patchBlock(phasesBlock.id, revised)}
                      onError={(msg) => toast(msg, 'error')}
                    />
                  </>
                }
              />
            ) : (
              <MissingSection label="Fases do projeto" type="phases" onAdd={addBlock} />
            )}
          </div>

          {/* ── Right column ─────────────────────────────────────────── */}
          <div className="flex flex-col gap-5">

            {/* Validade */}
            <Card className="p-5">
              <CardHeader icon={<Clock className="h-4 w-4" />} title="Validade" />
              <DatePicker
                value={parseIsoDate(proposal.valid_until)}
                onChange={(d) => patchProposal({ valid_until: toIsoDate(d) })}
                placeholder="Sem validade"
                disablePast
              />
            </Card>

            {/* Investimento */}
            {investmentBlock ? (
              <InvestimentoCard
                block={investmentBlock}
                onChange={(c) => patchBlock(investmentBlock.id, c)}
                headerExtra={
                  <>
                    <TranslationPill
                      block={investmentBlock}
                      sourceLang={proposal.language}
                      targetLang={translationTargetLang}
                      slug={slug}
                      onTranslated={(next) => onBlockTranslated(investmentBlock.id, next)}
                      onError={(msg) => toast(msg, 'error')}
                    />
                    <ReviewBlockButton
                      slug={slug}
                      block={investmentBlock}
                      blockLabel="Investimento"
                      onApplied={(revised) => patchBlock(investmentBlock.id, revised)}
                      onError={(msg) => toast(msg, 'error')}
                    />
                  </>
                }
              />
            ) : (
              <MissingSection label="Investimento" type="investment" onAdd={addBlock} />
            )}

            {/* Detalhes */}
            <Card className="p-5">
              <CardHeader icon={<FileText className="h-4 w-4" />} title="Detalhes" />
              <div className="space-y-3 text-xs">
                <DetalheRow label="Criada em" value={fmtDateLong(proposal.created_at)} />
                <DetalheRow
                  label="Atualizada"
                  value={formatDistanceToNow(new Date(proposal.updated_at), { locale: ptBR, addSuffix: true })}
                />
                <DetalheRow label="Idioma" value={proposal.language === 'pt-BR' ? 'Português' : 'English'} />
              </div>
            </Card>

            {/* Notas internas — privado, só o owner vê */}
            <InternalNotesCard
              value={proposal.internal_notes}
              onChange={(notes) => patchProposal({ internal_notes: notes })}
            />

          </div>
        </div>
      </div>

      <Dialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Remover seção?</DialogTitle>
            <DialogDescription>Esta ação não pode ser desfeita.</DialogDescription>
          </DialogHeader>
          <DialogFooter className="p-6 pt-0">
            <Button type="button" variant="ghost" onClick={() => setDeleteTarget(null)}>Cancelar</Button>
            <Button variant="destructive" onClick={confirmDeleteBlock}>Remover</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Trocar cliente — advanced action */}
      <Dialog open={changeClientOpen} onOpenChange={setChangeClientOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Trocar cliente</DialogTitle>
            <DialogDescription>
              Os dados do novo cliente passam a ser usados no contexto da IA. O conteúdo já escrito não muda — use o card de IA para regenerar se quiser.
            </DialogDescription>
          </DialogHeader>
          <div className="px-6 pb-2">
            <Select value={advancedClientChoice} onValueChange={setAdvancedClientChoice}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione…" />
              </SelectTrigger>
              <SelectContent>
                {advancedClients.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.company} {c.name && <span className="text-muted-foreground">· {c.name}</span>}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter className="p-6 pt-2">
            <Button variant="ghost" onClick={() => setChangeClientOpen(false)} disabled={advancedSaving}>Cancelar</Button>
            <Button onClick={submitChangeClient} disabled={advancedSaving || !advancedClientChoice}>
              {advancedSaving ? <><Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />Salvando…</> : 'Trocar cliente'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Trocar modelo — advanced action */}
      <Dialog open={changeTemplateOpen} onOpenChange={setChangeTemplateOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Trocar modelo</DialogTitle>
            <DialogDescription>
              Apenas o vínculo com o modelo é trocado. O conteúdo atual da proposta não é apagado — você pode usar o card de IA para regenerar fases e abertura segundo o novo modelo.
            </DialogDescription>
          </DialogHeader>
          <div className="px-6 pb-2">
            <Select value={advancedTemplateChoice} onValueChange={setAdvancedTemplateChoice}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione…" />
              </SelectTrigger>
              <SelectContent>
                {advancedTemplates.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter className="p-6 pt-2">
            <Button variant="ghost" onClick={() => setChangeTemplateOpen(false)} disabled={advancedSaving}>Cancelar</Button>
            <Button onClick={submitChangeTemplate} disabled={advancedSaving}>
              {advancedSaving ? <><Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />Salvando…</> : 'Trocar modelo'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Send proposal dialog — opens when user clicks "Enviar proposta".
          Lazy-loads contacts on first open. v0.10.80. */}
      <SendDialog
        open={sendOpen}
        onOpenChange={setSendOpen}
        clientId={proposal.client_id}
        contacts={sendContacts}
        onConfirm={executeSend}
        onContactAdded={refreshSendContacts}
      />

      {/* Master translation — opens from the More-actions menu. Confirms,
          fires POST /api/proposals/[slug]/translate, and refreshes route
          on success so all pills re-render with the new fresh state. */}
      <MasterTranslateDialog
        open={masterTranslateOpen}
        onOpenChange={setMasterTranslateOpen}
        slug={slug}
        targetLang={translationTargetLang}
        blockCount={blocks.filter((b) => b.visible !== false).length}
        onTranslated={onMasterTranslated}
        onError={(msg) => toast(msg, 'error')}
      />
    </div>
  )
}


// ─── Document view ────────────────────────────────────────────────────────

function DocumentView({
  proposal, blocks, status, onEdit,
}: { proposal: ProposalWithClient; blocks: ProposalBlock[]; status: ProposalStatus; onEdit: () => void }) {
  const visible = blocks.filter((b) => b.visible)

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-2xl px-6 pt-6">
        <div className="mb-6 flex items-center justify-between">
          <button
            onClick={onEdit}
            className="inline-flex items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft size={13} />Editar
          </button>
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs font-semibold tabular-nums text-muted-foreground">
              {formatProposalNumber(proposal.number, proposal.version_suffix)}
            </span>
            <Badge variant={proposalStatusVariant(status)} className="text-[11px]">
              {PROPOSAL_STATUS_LABELS_PT[status]}
            </Badge>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-2xl px-6 pb-16">
        <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
          <div className="border-b border-border px-8 py-7">
            {proposal.clients?.company && (
              <div className="mb-2 text-xs text-muted-foreground">{proposal.clients.company}</div>
            )}
            <h1 className="font-mono text-2xl font-bold tracking-tight">{proposal.title || 'Sem título'}</h1>
            <div className="mt-4 flex flex-wrap gap-x-5 gap-y-1.5 text-sm">
              {proposal.total_amount > 0 && (
                <div>
                  <span className="text-[10px] uppercase tracking-widest text-muted-foreground">Total </span>
                  <span className="font-mono font-semibold tabular-nums">{fmtCurrency(proposal.total_amount, proposal.currency)}</span>
                </div>
              )}
              {proposal.valid_until && (
                <div>
                  <span className="text-[10px] uppercase tracking-widest text-muted-foreground">Válida até </span>
                  <span className="font-medium">{fmtDate(proposal.valid_until)}</span>
                </div>
              )}
            </div>
          </div>
          {visible.length === 0 ? (
            <div className="px-8 py-12 text-center">
              <p className="text-sm text-muted-foreground">
                <button onClick={onEdit} className="text-primary hover:underline">Editar</button> para adicionar conteúdo.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {visible.map((b) => (
                <div key={b.id} className="px-8 py-7"><BlockReadOnly block={b} /></div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
