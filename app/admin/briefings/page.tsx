'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { FIELD_LABELS_PT, FIELD_LABELS_EN } from '@/lib/briefing-types'
import { useToast, ToastContainer } from '@/components/toast'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { IconButton } from '@/components/ui/icon-button'
import { Pencil, FileText, BellRing, Copy, Link, Trash2, Lock, Unlock, ClipboardList, Search, Mail, Check, Send, Eye, Paperclip, Download, ExternalLink, Image as ImageIcon, ShieldCheck, Plus, X, ArrowRight, ScrollText, MoreHorizontal } from 'lucide-react'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { DateRangePicker } from '@/components/ui/date-range-picker'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { AvatarUpload } from '@/components/admin/AvatarUpload'
// RecipientPickerModal is only mounted when the owner clicks one of the
// send/notify actions on a briefing row — never during typical browsing.
// Lazy-loading defers the modal's chunk until the action fires.
import dynamic from 'next/dynamic'
const RecipientPickerModal = dynamic(
  () => import('@/components/admin/RecipientPickerModal').then((m) => ({ default: m.RecipientPickerModal })),
  { ssr: false },
)
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

import { fmt, timeAgo, toIsoDay } from './_components/formatters'
import {
  BriefingStatusBadge,
  BRIEFING_STATUS_LABELS,
} from './_components/BriefingStatusBadge'
import { Modal } from './_components/Modal'
import { ResponsesModal } from './_components/ResponsesModal'
import { DiffModal } from './_components/DiffModal'
import { NotifHistoryModal } from './_components/NotifHistoryModal'

interface Client { id: string; name: string; company: string; email: string; phone: string; avatar_url?: string | null }
interface Briefing {
  id: string; slug: string; type: string; type_label: string; status: string
  created_at: string; viewed_at: string | null; started_at: string | null
  completed_at: string | null; expires_at: string | null; internal_notes: string | null
  language?: string; editing_locked?: boolean; editing_expires_at?: string | null
  update_count?: number; clients: Client
  recipients?: Array<{ email: string; name: string; role: 'primary' | 'cc' }>
}


export default function AdminPage() {
  const [briefings, setBriefings] = useState<Briefing[]>([])
  const [loading, setLoading] = useState(false)
  const [statusFilter, setStatusFilter] = useState('all')
  const [sortBy, setSortBy] = useState<'recent' | 'oldest' | 'company'>('recent')
  const [search, setSearch] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const { toasts, toast, remove: removeToast } = useToast()

  const [responsesBriefing, setResponsesBriefing] = useState<Briefing | null>(null)
  const [responses, setResponses] = useState<Record<string, unknown> | null>(null)
  const [responseDiff, setResponseDiff] = useState<Record<string, { old: unknown; new: unknown }> | null>(null)
  const [responseVersions, setResponseVersions] = useState(0)
  const [showDiffView, setShowDiffView] = useState(false)
  const [diffModal, setDiffModal] = useState<{ briefing: Briefing; diff: Record<string, { old: unknown; new: unknown }>; versions: number } | null>(null)
  const [loadingDiff, setLoadingDiff] = useState(false)
  const [copied, setCopied] = useState(false)
  const [editBriefing, setEditBriefing] = useState<Briefing | null>(null)
  const [notesBriefing, setNotesBriefing] = useState<Briefing | null>(null)
  const [notesText, setNotesText] = useState('')
  const [savingNotes, setSavingNotes] = useState(false)
  const [editForm, setEditForm] = useState({ name: '', company: '', email: '', phone: '' })
  const [savingEdit, setSavingEdit] = useState(false)
  const [reminderSent, setReminderSent] = useState<string | null>(null)
  const [pickerBriefing, setPickerBriefing] = useState<Briefing | null>(null)
  const [pickerType, setPickerType] = useState<'reminder' | 'resend'>('reminder')
  const [notifBriefing, setNotifBriefing] = useState<Briefing | null>(null)
  const [notifHistory, setNotifHistory] = useState<Array<{type: string; status: string; sent_at: string; details: Record<string, string>}>>([])

  const [deleteBriefing, setDeleteBriefing] = useState<Briefing | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [batchDeleteConfirm, setBatchDeleteConfirm] = useState(false)
  const [batchDeleting, setBatchDeleting] = useState(false)

  const [duplicating, setDuplicating] = useState<string | null>(null)
  const [duplicatedSlug, setDuplicatedSlug] = useState<string | null>(null)
  const [dupLink, setDupLink] = useState('')


  const router = useRouter()

  const loadBriefings = useCallback(async () => {
    setLoading(true)
    const res = await fetch('/api/briefings')
    if (res.status === 401) {
      // Auth lives at /admin (the dashboard route also handles login).
      router.push('/admin')
      return
    }
    if (res.ok) { const data = await res.json(); setBriefings(data.briefings || []) }
    setLoading(false)
  }, [router])

  useEffect(() => {
    loadBriefings()
  }, [loadBriefings])

  async function openDiffModal(b: Briefing) {
    setLoadingDiff(true)
    const res = await fetch(`/api/briefings/${b.slug}/responses`)
    if (res.ok) {
      const d = await res.json()
      setDiffModal({ briefing: b, diff: d.diff || {}, versions: d.versions || 0 })
    }
    setLoadingDiff(false)
  }

  async function toggleEditingLock(slug: string, currentLocked: boolean) {
    await fetch(`/api/briefings/${slug}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ editing_locked: !currentLocked }),
    })
    setBriefings(prev => prev.map(b => b.slug === slug ? { ...b, editing_locked: !currentLocked } : b))
    toast(!currentLocked ? 'Edição bloqueada' : 'Edição liberada', 'success', 2000)
  }

  async function copyLink(slug: string) {
    await navigator.clipboard.writeText(`${window.location.origin}/${slug}`)
    setCopiedId(slug); setTimeout(() => setCopiedId(null), 2000)
    toast('Link copiado!', 'success', 2000)
  }

  async function viewResponses(b: Briefing) {
    setResponsesBriefing(b); setResponses(null); setShowDiffView(false)
    const res = await fetch(`/api/briefings/${b.slug}/responses`)
    if (res.ok) {
      const d = await res.json()
      setResponses(d.answers || {})
      setResponseDiff(d.diff || null)
      setResponseVersions(d.versions || 1)
    }
  }

  function buildText(b: Briefing, resp: Record<string, unknown>) {
    const lines = [`BRIEFING — ${b.type_label.toUpperCase()}`, `Empresa: ${b.clients?.company}`, `Contato: ${b.clients?.name}`, `Email: ${b.clients?.email || '—'}`, `WhatsApp: ${b.clients?.phone || '—'}`, `Concluído: ${fmt(b.completed_at)}`, '', '─────────────────────────────────', '']
    Object.entries(resp).forEach(([k, v]) => { if (!v) return; lines.push(k.replace(/_/g, ' ').toUpperCase()); lines.push(Array.isArray(v) ? (v as string[]).join(', ') : String(v)); lines.push('') })
    return lines.join('\n')
  }

  async function copyAll() {
    if (!responsesBriefing || !responses) return
    await navigator.clipboard.writeText(buildText(responsesBriefing, responses))
    setCopied(true); setTimeout(() => setCopied(false), 2000)
    toast('Respostas copiadas!', 'success', 2000)
  }

  function exportPDF() {
    if (!responsesBriefing || !responses) return
    const b = responsesBriefing
    const fields = Object.entries(responses).filter(([, v]) => v)
    const html = `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"><style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:'Helvetica Neue',Arial,sans-serif;color:#111;padding:48px;max-width:800px;margin:0 auto}.hdr{display:flex;justify-content:space-between;align-items:flex-start;padding-bottom:24px;border-bottom:3px solid #12fea9;margin-bottom:32px}.logo{font-size:22px;font-weight:800;letter-spacing:-0.04em}.logo span{color:#12fea9;background:#111;padding:2px 8px;border-radius:4px}.badge{background:#111;color:#12fea9;font-size:10px;font-weight:700;padding:3px 10px;border-radius:999px;text-transform:uppercase;letter-spacing:.08em;margin-top:6px;display:inline-block}.cb{background:#f8f8f8;border-radius:12px;padding:20px 24px;margin-bottom:32px;display:grid;grid-template-columns:1fr 1fr;gap:12px}.cf label{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.1em;color:#888;display:block;margin-bottom:3px}.st{font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.1em;color:#888;margin-bottom:16px;padding-bottom:8px;border-bottom:1px solid #eee}.f{margin-bottom:18px}.fl{font-size:10px;font-weight:700;color:#555;text-transform:uppercase;letter-spacing:.07em;margin-bottom:5px}.fv{font-size:14px;color:#111;line-height:1.6;background:#f8f8f8;padding:10px 14px;border-radius:8px;border-left:3px solid #12fea9}.footer{margin-top:48px;padding-top:16px;border-top:1px solid #eee;font-size:11px;color:#aaa;text-align:center}</style></head><body><div class="hdr"><div><div class="logo"><span>Bnny</span> Labs</div><div style="font-size:12px;color:#555;margin-top:4px">Sistema de Briefings</div></div><div style="text-align:right"><div style="font-size:17px;font-weight:700">${b.type_label}</div><div class="badge">${BRIEFING_STATUS_LABELS[b.status]||b.status}</div></div></div><div class="cb"><div class="cf"><label>Empresa</label><span style="font-size:15px;font-weight:700">${b.clients?.company||'—'}</span></div><div class="cf"><label>Contato</label><span>${b.clients?.name||'—'}</span></div><div class="cf"><label>Email</label><span>${b.clients?.email||'—'}</span></div><div class="cf"><label>WhatsApp</label><span>${b.clients?.phone||'—'}</span></div><div class="cf"><label>Concluído em</label><span>${fmt(b.completed_at)}</span></div><div class="cf"><label>Tipo</label><span>${b.type_label}</span></div></div><div class="st">Respostas do briefing</div>${fields.map(([k,v])=>`<div class="f"><div class="fl">${k.replace(/_/g,' ')}</div><div class="fv">${Array.isArray(v)?(v as string[]).join(', '):String(v)}</div></div>`).join('')}<div class="footer">Gerado por Bnny Labs · briefing.bnnylabs.com · ${new Date().toLocaleDateString('pt-BR')}</div></body></html>`
    const win = window.open('', '_blank')
    if (win) { win.document.write(html); win.document.close(); setTimeout(() => win.print(), 500) }
  }

  function openEdit(b: Briefing) {
    setEditBriefing(b)
    setEditForm({ name: b.clients?.name || '', company: b.clients?.company || '', email: b.clients?.email || '', phone: b.clients?.phone || '' })
  }

  async function saveEdit() {
    if (!editBriefing) return
    setSavingEdit(true)
    await fetch(`/api/admin/clients/${editBriefing.clients?.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(editForm) })
    setSavingEdit(false); setEditBriefing(null); loadBriefings()
    toast('Cliente atualizado', 'success')
  }

  async function saveNotes() {
    if (!notesBriefing) return
    setSavingNotes(true)
    await fetch(`/api/briefings/${notesBriefing.slug}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ internal_notes: notesText }) })
    setSavingNotes(false); setNotesBriefing(null); loadBriefings()
    toast('Anotação salva', 'success')
  }

  async function sendReminder(b: Briefing) {
    setPickerBriefing(b); setPickerType('reminder')
  }

  async function viewNotifications(b: Briefing) {
    setNotifBriefing(b)
    const res = await fetch(`/api/briefings/${b.slug}/notifications`)
    if (res.ok) { const data = await res.json(); setNotifHistory(data.notifications || []) }
  }

  async function resendEmail(b: Briefing) {
    setPickerBriefing(b); setPickerType('resend')
  }

  async function submitPickerSend(recipients: { email: string; name: string; role: 'primary' | 'cc' }[]) {
    if (!pickerBriefing) return
    const res = await fetch('/api/admin/notify', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ slug: pickerBriefing.slug, type: pickerType, recipients }),
    })
    const data = await res.json().catch(() => ({}))
    if (res.ok) {
      toast(`Enviado para ${data.sent || recipients.length}`, 'success')
      setReminderSent(pickerBriefing.id + (pickerType === 'resend' ? '_resend' : ''))
      setTimeout(() => setReminderSent(null), 3000)
      loadBriefings()
    } else {
      toast('Erro ao enviar', 'error')
    }
  }

  async function confirmDelete() {
    if (!deleteBriefing) return
    setDeleting(true)
    await fetch(`/api/briefings/${deleteBriefing.slug}`, { method: 'DELETE' })
    setDeleting(false); setDeleteBriefing(null); loadBriefings()
    toast('Briefing excluído', 'success')
  }

  async function confirmBatchDelete() {
    if (selectedIds.size === 0) return
    setBatchDeleting(true)
    const slugs = filtered.filter(b => selectedIds.has(b.id)).map(b => b.slug)
    await fetch('/api/admin/bulk-delete', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ slugs }) })
    setBatchDeleting(false); setBatchDeleteConfirm(false); setSelectedIds(new Set()); loadBriefings()
    toast(`${slugs.length} briefing${slugs.length > 1 ? 's' : ''} excluído${slugs.length > 1 ? 's' : ''}`, 'success')
  }

  function toggleSelect(id: string) {
    setSelectedIds(prev => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next })
  }

  function toggleSelectAll() {
    if (selectedIds.size === filtered.length) setSelectedIds(new Set())
    else setSelectedIds(new Set(filtered.map(b => b.id)))
  }

  async function duplicateBriefing(b: Briefing) {
    setDuplicating(b.id)
    const res = await fetch(`/api/briefings/${b.slug}/duplicate`, { method: 'POST' })
    if (res.ok) {
      const data = await res.json()
      setDuplicatedSlug(data.briefing?.slug)
      setDupLink(data.link || '')
      await loadBriefings()
      toast('Briefing duplicado!', 'success')
    }
    setDuplicating(null)
  }

  function viewClientHistory(client: Client) {
    router.push(`/admin/clientes/${client.id}`)
  }

  type SortKey = 'recent' | 'oldest' | 'company'
  // Sort + filter chain — applies status filter, search, date range, then sorts.
  const filtered = briefings
    .filter((b) => {
      if (statusFilter !== 'all' && b.status !== statusFilter) return false
      if (search) {
        const q = search.toLowerCase()
        if (
          !b.clients?.company?.toLowerCase().includes(q) &&
          !b.clients?.name?.toLowerCase().includes(q) &&
          !b.type_label?.toLowerCase().includes(q)
        )
          return false
      }
      if (dateFrom && new Date(b.created_at) < new Date(dateFrom)) return false
      if (dateTo && new Date(b.created_at) > new Date(dateTo + 'T23:59:59'))
        return false
      return true
    })
    .sort((a, b) => {
      switch (sortBy) {
        case 'oldest':
          return new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        case 'company':
          return (a.clients?.company || '').localeCompare(b.clients?.company || '')
        case 'recent':
        default:
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      }
    })

  // No auth UI here — if loadBriefings hits 401 it redirects to /admin where
  // the login form lives. While loading, show a minimal spinner.

  function renderFileValue(value: unknown): React.ReactNode {
    if (!value) return null

    const renderFileCard = (f: { url: string; name: string; size?: number; type?: string }, i: number) => {
      const isImage = f.type?.startsWith('image/') || /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(f.name || '')
      const hasUrl = f.url && f.url.startsWith('http')
      const sizeLabel = f.size ? `${(f.size / 1024).toFixed(0)}kb` : ''

      if (isImage) {
        if (hasUrl) return (
          <div key={i}>
            <a href={f.url} target="_blank" rel="noopener noreferrer" className="block">
              <img src={f.url} alt={f.name} className="w-full max-h-[200px] rounded-lg object-contain bg-black/50 cursor-pointer" />
            </a>
            <div className="text-xs text-muted-foreground mt-1">{f.name}{sizeLabel ? ` · ${sizeLabel}` : ''}</div>
          </div>
        )
        return (
          <div key={i} className="flex items-center gap-2 px-3 py-2 bg-secondary border border-border rounded-lg opacity-60">
            <ImageIcon className="h-5 w-5 shrink-0 text-muted-foreground" />
            <div className="flex-1 min-w-0">
              <div className="text-sm truncate">{f.name}</div>
              <div className="text-xs text-muted-foreground">{sizeLabel} · upload não concluído</div>
            </div>
          </div>
        )
      }

      if (hasUrl) return (
        <a key={i} href={f.url} target="_blank" rel="noopener noreferrer"
          className="flex items-center gap-2 px-3 py-2 bg-secondary border border-border rounded-lg no-underline text-foreground hover:border-border/60 transition-colors">
          {f.type?.includes('pdf')
            ? <FileText className="h-5 w-5 shrink-0 text-muted-foreground" />
            : <Paperclip className="h-5 w-5 shrink-0 text-muted-foreground" />}
          <div className="flex-1 min-w-0">
            <div className="text-sm font-semibold truncate">{f.name}</div>
            {sizeLabel && <div className="text-xs text-muted-foreground">{sizeLabel}</div>}
          </div>
          <span className="inline-flex items-center gap-1 text-xs text-foreground shrink-0">
            <ExternalLink size={12} /> Abrir
          </span>
        </a>
      )

      return (
        <div key={i} className="flex items-center gap-2 px-3 py-2 bg-secondary border border-border rounded-lg opacity-60">
          <Paperclip className="h-5 w-5 shrink-0 text-muted-foreground" />
          <div className="flex-1 min-w-0">
            <div className="text-sm truncate">{f.name}</div>
            <div className="text-xs text-muted-foreground">{sizeLabel} · upload não concluído</div>
          </div>
        </div>
      )
    }

    if (Array.isArray(value)) {
      return (
        <div className="flex flex-col gap-2.5">
          {(value as { url: string; name: string; size?: number; type?: string }[]).map((f, i) => renderFileCard(f, i))}
        </div>
      )
    }

    // Legacy: plain string
    const str = String(value)
    const isUrl = str.startsWith('http')
    return isUrl
      ? <a href={str} target="_blank" rel="noopener noreferrer" className="text-primary underline break-all text-sm inline-flex items-center gap-1"><Paperclip size={12} /> {str.split('/').pop()}</a>
      : <span className="text-muted-foreground text-sm inline-flex items-center gap-1"><Paperclip size={12} /> {str}</span>
  }

  return (
    <div className="min-h-screen bg-background">
      <ToastContainer toasts={toasts} remove={removeToast} />

      <div className="px-6 py-6 max-w-5xl mx-auto">

        {/* ── BRIEFINGS LIST ────────────────────────────────────────── */}
        <>
          {/* Page header */}
          <div className="mb-6 flex items-center justify-between">
            <h1 className="font-mono text-xl font-bold tracking-tight">
              Briefings
            </h1>
            <Button onClick={() => router.push('/admin/novo')}>
              <Plus size={14} />
              Novo briefing
            </Button>
          </div>

          {/* Stats grid */}
            <div className="-mx-6 mb-5 flex gap-2 overflow-x-auto px-6 sm:mx-0 sm:grid sm:grid-cols-5 sm:overflow-visible sm:px-0">
              {([
                { label: 'Total',       value: briefings.length,                                          status: 'all' },
                { label: 'Enviado',     value: briefings.filter(b => b.status === 'enviado').length,      status: 'enviado' },
                { label: 'Visualizado', value: briefings.filter(b => b.status === 'visualizado').length,  status: 'visualizado' },
                { label: 'Andamento',   value: briefings.filter(b => b.status === 'em_andamento').length, status: 'em_andamento' },
                { label: 'Concluído',   value: briefings.filter(b => b.status === 'concluido').length,    status: 'concluido' },
              ] as { label: string; value: number; status: string }[]).map(s => (
                <button key={s.label} onClick={() => setStatusFilter(prev => prev === s.status ? 'all' : s.status)}
                  className={`min-w-[120px] shrink-0 sm:min-w-0 rounded-lg border p-3.5 text-left transition-colors duration-100 cursor-pointer ${statusFilter === s.status ? 'border-foreground/15 bg-muted/50' : 'border-border bg-card hover:border-border/70 hover:bg-muted/30'}`}>
                  <div className="text-2xl font-bold tabular-nums leading-none font-mono text-foreground">{s.value}</div>
                  <div className="text-[10px] text-muted-foreground font-medium uppercase tracking-widest mt-1.5">{s.label}</div>
                </button>
              ))}
            </div>

            {/* Search + Sort + DatePicker */}
            <div className="flex flex-wrap gap-2">
              <div className="flex-1 min-w-0 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                <Input value={search} onChange={e => setSearch(e.target.value)}
                  placeholder="Buscar cliente, empresa ou tipo..." className="pl-9 bg-card" />
              </div>
              <Select value={sortBy} onValueChange={(v) => setSortBy(v as 'recent' | 'oldest' | 'company')}>
                <SelectTrigger className="w-36 sm:w-44 shrink-0">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="recent">Mais recentes</SelectItem>
                  <SelectItem value="oldest">Mais antigos</SelectItem>
                  <SelectItem value="company">A → Z</SelectItem>
                </SelectContent>
              </Select>
              <div className="w-full sm:w-auto">
                <DateRangePicker
                  value={
                    dateFrom || dateTo
                      ? {
                          from: dateFrom ? new Date(dateFrom) : undefined,
                          to: dateTo ? new Date(dateTo) : undefined,
                        }
                      : undefined
                  }
                  onChange={(range) => {
                    setDateFrom(range?.from ? toIsoDay(range.from) : '')
                    setDateTo(range?.to ? toIsoDay(range.to) : '')
                  }}
                  placeholder="Filtrar por período"
                />
              </div>
            </div>

            {/* Select-all + inline batch actions — single persistent row, no layout shift */}
            {filtered.length > 0 && (
              <div className="mt-4 mb-3 flex items-center justify-between gap-2 px-1">
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="select-all-briefings"
                    className="data-[state=checked]:bg-foreground data-[state=checked]:border-foreground data-[state=checked]:text-background"
                    checked={selectedIds.size === filtered.length && filtered.length > 0}
                    onCheckedChange={checked =>
                      setSelectedIds(checked ? new Set(filtered.map(b => b.id)) : new Set())
                    }
                  />
                  <label
                    htmlFor="select-all-briefings"
                    className="cursor-pointer select-none whitespace-nowrap text-xs text-muted-foreground"
                  >
                    {selectedIds.size === filtered.length && filtered.length > 0
                      ? 'Desmarcar todos'
                      : 'Selecionar todos'}{' '}
                    ({filtered.length})
                  </label>
                </div>

                {/* Batch actions — hidden count+cancel on mobile */}
                <div className={`flex items-center gap-1.5 transition-opacity duration-150 ${selectedIds.size > 0 ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
                  <span className="hidden sm:inline text-xs text-muted-foreground tabular-nums">
                    {selectedIds.size} selecionado{selectedIds.size !== 1 ? 's' : ''}
                  </span>
                  <button
                    type="button"
                    onClick={() => setSelectedIds(new Set())}
                    className="hidden sm:inline-flex rounded-md px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={() => setBatchDeleteConfirm(true)}
                    className="inline-flex items-center gap-1 whitespace-nowrap rounded-md border border-destructive/40 px-2.5 py-1 text-xs font-medium text-destructive transition-colors hover:bg-destructive hover:text-destructive-foreground"
                  >
                    <Trash2 size={11} />
                    Excluir {selectedIds.size}
                  </button>
                </div>
              </div>
            )}

            {/* Briefings list */}
            {loading ? (
              <div className="flex flex-col gap-2">
                {[1,2,3,4].map(i => (
                  <div key={i} className="rounded-xl border border-border bg-card p-4 animate-pulse">
                    <div className="flex items-center gap-3">
                      <div className="w-4 h-4 rounded bg-muted shrink-0" />
                      <div className="h-4 bg-muted rounded flex-1 max-w-[160px]" />
                      <div className="flex gap-2 ml-auto">
                        <div className="h-7 w-7 bg-muted rounded" /><div className="h-7 w-7 bg-muted rounded" /><div className="h-7 w-7 bg-muted rounded" /><div className="h-7 w-16 bg-muted rounded" />
                      </div>
                    </div>
                    <div className="flex gap-2 mt-3 ml-7">
                      <div className="h-5 w-20 bg-muted rounded-full" /><div className="h-5 w-24 bg-muted rounded" />
                    </div>
                  </div>
                ))}
              </div>
            ) : filtered.length === 0 ? (
              <Card className={search || dateFrom || dateTo || statusFilter !== 'all' ? 'p-10' : 'p-12'}>
                <div className="text-center text-muted-foreground">
                  <ClipboardList className="mx-auto mb-3 h-10 w-10 opacity-40" />
                  <div className="mb-1.5 text-base font-semibold text-foreground">
                    {search || dateFrom || dateTo || statusFilter !== 'all' ? 'Nenhum resultado' : 'Nenhum briefing ainda'}
                  </div>
                  <div className="mb-5 text-sm">
                    {search || dateFrom || dateTo || statusFilter !== 'all' ? 'Tente ajustar os filtros' : 'Crie o primeiro briefing para começar'}
                  </div>
                  {search || dateFrom || dateTo || statusFilter !== 'all' ? (
                    <Button
                      variant="outline"
                      onClick={() => {
                        setSearch('')
                        setDateFrom('')
                        setDateTo('')
                        setStatusFilter('all')
                      }}
                    >
                      Limpar filtros
                    </Button>
                  ) : (
                    <Button onClick={() => router.push('/admin/novo')}>
                      <Plus className="mr-1.5 h-4 w-4" />
                      Criar primeiro briefing
                    </Button>
                  )}
                </div>
              </Card>
            ) : (
              <div className="flex flex-col gap-2">
                {filtered.map(b => (
                  <div key={b.id}
                    className={`group rounded-lg border px-4 py-3 transition-colors duration-100 ${selectedIds.has(b.id) ? 'border-foreground/15 bg-muted/50 hover:bg-muted/60' : 'border-border bg-card hover:border-border/70 hover:bg-muted/30'}`}>
                    <div className="flex items-center gap-3">
                      <Checkbox checked={selectedIds.has(b.id)} onCheckedChange={() => toggleSelect(b.id)} className="shrink-0 data-[state=checked]:bg-foreground data-[state=checked]:border-foreground data-[state=checked]:text-background" />
                      <AvatarUpload
                        url={b.clients?.avatar_url}
                        name={b.clients?.company || '?'}
                        size={36}
                        shape="rounded"
                        editable={false}
                      />

                      <div className="min-w-0 flex-1">
                        {/* Row 1: company · type */}
                        <div className="flex items-baseline gap-2">
                          <button onClick={() => viewClientHistory(b.clients)}
                            className="truncate text-sm font-semibold leading-snug text-left hover:text-foreground transition-colors bg-transparent border-none p-0 cursor-pointer">
                            {b.clients?.company}
                          </button>
                          <span className="shrink-0 text-xs text-muted-foreground/70">{b.type_label}</span>
                          {b.language === 'en-US' && (
                            <span className="shrink-0 rounded-md border border-border bg-muted/60 px-1.5 py-0 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">EN</span>
                          )}
                        </div>
                        {/* Row 2: status + meta */}
                        <div className="mt-1 flex flex-wrap items-center gap-1.5">
                          <BriefingStatusBadge status={b.status} />
                          {(b.update_count || 0) > 0 && (
                            <button onClick={() => openDiffModal(b)} title="Ver alterações"
                              className="inline-flex items-center gap-1 rounded-md border border-border bg-muted/60 px-1.5 py-0.5 text-[10px] font-medium text-foreground hover:bg-muted/40 transition-colors">
                              <Pencil size={9} /> {b.update_count}x
                            </button>
                          )}
                          {(b.recipients?.length ?? 0) > 0 && (
                            <TooltipProvider delayDuration={200}>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <button
                                    onClick={() => viewNotifications(b)}
                                    className="inline-flex items-center gap-1 rounded-md border border-border bg-muted/60 px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground transition-colors hover:border-foreground/30 hover:text-foreground"
                                  >
                                    <Send size={9} />
                                    {b.recipients!.length}
                                  </button>
                                </TooltipTrigger>
                                <TooltipContent
                                  side="bottom"
                                  className="bg-popover text-popover-foreground border border-border p-0 shadow-md"
                                >
                                  <div className="min-w-48 p-3">
                                    <div className="mb-2 text-[10px] font-medium uppercase tracking-widest text-muted-foreground">Enviado para</div>
                                    <div className="flex flex-col gap-2">
                                      {b.recipients!.map((r, i) => (
                                        <div key={i} className="flex items-center gap-2">
                                          <div className="min-w-0 flex-1">
                                            <div className="truncate text-xs font-medium text-foreground">{r.name}</div>
                                            <div className="truncate text-[10px] text-muted-foreground">{r.email}</div>
                                          </div>
                                          <span className={cn(
                                            'shrink-0 rounded-md border px-1.5 py-0 text-[10px] font-medium',
                                            r.role === 'primary'
                                              ? 'border-success/30 bg-success/10 text-success'
                                              : 'border-border bg-muted/60 text-muted-foreground'
                                          )}>
                                            {r.role === 'primary' ? 'Principal' : 'CC'}
                                          </span>
                                        </div>
                                      ))}
                                    </div>
                                    <div className="mt-2.5 border-t border-border pt-2 text-[10px] text-muted-foreground">
                                      Clique para ver histórico completo
                                    </div>
                                  </div>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          )}
                          <span className="max-w-[120px] truncate text-[11px] text-muted-foreground/70">{b.clients?.name}</span>
                          <span className="text-[11px] text-muted-foreground/50">· {timeAgo(b.created_at)}<span className="hidden sm:inline"> ({fmt(b.created_at)})</span></span>
                          {b.completed_at && <span className="hidden sm:inline text-[11px] text-muted-foreground/50">· concluído {fmt(b.completed_at)}</span>}
                          {b.expires_at && new Date(b.expires_at) > new Date() && <span className="text-[11px] text-warning">· expira {fmt(b.expires_at)}</span>}
                          {b.expires_at && new Date(b.expires_at) < new Date() && <span className="text-[11px] text-destructive">· expirado</span>}
                        </div>
                      </div>

                      {/* ── Actions ─────────────────────────────────── */}
                      <div className="flex items-center gap-1.5 shrink-0">
                        {/* Ver respostas — hidden on mobile, in dropdown instead */}
                        {b.status === 'concluido' && (
                          <Button size="sm" onClick={() => viewResponses(b)} className="hidden sm:inline-flex">
                            <Eye size={13} />
                            Ver respostas
                          </Button>
                        )}
                        <IconButton
                          icon={copiedId === b.slug ? <Check size={14} /> : <Link size={14} />}
                          label="Copiar link"
                          onClick={() => copyLink(b.slug)}
                        />

                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button
                              type="button"
                              className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                            >
                              <MoreHorizontal size={15} />
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-52">
                            {/* Ver respostas — shown in dropdown on mobile only */}
                            {b.status === 'concluido' && (
                              <>
                                <DropdownMenuItem onClick={() => viewResponses(b)} className="sm:hidden">
                                  <Eye size={14} />
                                  Ver respostas
                                </DropdownMenuItem>
                                <DropdownMenuSeparator className="sm:hidden" />
                              </>
                            )}
                            {b.status !== 'concluido' && b.clients?.email && (
                              <DropdownMenuItem onClick={() => resendEmail(b)}>
                                {reminderSent === b.id + '_resend' ? <Check size={14} className="text-success" /> : <Mail size={14} />}
                                Reenviar email…
                              </DropdownMenuItem>
                            )}
                            {b.status !== 'concluido' && (
                              <DropdownMenuItem onClick={() => sendReminder(b)}>
                                {reminderSent === b.id ? <Check size={14} className="text-success" /> : <BellRing size={14} />}
                                Enviar lembrete…
                              </DropdownMenuItem>
                            )}
                            {b.status !== 'concluido' && <DropdownMenuSeparator />}

                            <DropdownMenuItem onClick={() => { setNotesBriefing(b); setNotesText(b.internal_notes || '') }}>
                              <FileText size={14} className={b.internal_notes ? 'text-foreground' : ''} />
                              Anotações internas
                              {b.internal_notes && <span className="ml-auto h-1.5 w-1.5 rounded-full bg-foreground/60" />}
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => viewNotifications(b)}>
                              <ScrollText size={14} />
                              Histórico de atividades
                            </DropdownMenuItem>
                            <DropdownMenuItem disabled={duplicating === b.id} onClick={() => duplicateBriefing(b)}>
                              <Copy size={14} />
                              Duplicar briefing
                            </DropdownMenuItem>

                            {b.status === 'concluido' && (
                              <>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem onClick={() => toggleEditingLock(b.slug, !!b.editing_locked)}>
                                  {b.editing_locked ? <Unlock size={14} /> : <Lock size={14} />}
                                  {b.editing_locked ? 'Liberar edição' : 'Bloquear edição'}
                                </DropdownMenuItem>
                              </>
                            )}

                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => openEdit(b)}>
                              <Pencil size={14} />
                              Editar cliente
                            </DropdownMenuItem>

                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              onClick={() => setDeleteBriefing(b)}
                              className="text-destructive focus:text-destructive focus:bg-destructive/10"
                            >
                              <Trash2 size={14} />
                              Excluir briefing
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>

      </div>

      {/* ── RESPONSES MODAL ──────────────────────────────────────────── */}
      {responsesBriefing && (
        <ResponsesModal
          briefing={responsesBriefing}
          responses={responses}
          responseDiff={responseDiff}
          responseVersions={responseVersions}
          showDiffView={showDiffView}
          copied={copied}
          renderFileValue={renderFileValue}
          onClose={() => { setResponsesBriefing(null); setResponses(null) }}
          onCopyAll={copyAll}
          onExportPDF={exportPDF}
          onToggleDiff={setShowDiffView}
        />
      )}

      {/* ── DIFF MODAL ───────────────────────────────────────────────── */}
      {diffModal && (
        <DiffModal
          briefing={diffModal.briefing}
          diff={diffModal.diff}
          loading={loadingDiff}
          onClose={() => setDiffModal(null)}
          onViewResponses={() => { setDiffModal(null); viewResponses(diffModal.briefing) }}
        />
      )}

      {/* ── EDIT CLIENT ──────────────────────────────────────────────── */}
      {editBriefing && (
        <Modal onClose={() => setEditBriefing(null)}>
          <div
            onKeyDown={(e) => {
              if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
                e.preventDefault()
                if (!savingEdit) saveEdit()
              }
            }}
          >
            <div className="mb-5">
              <div className="font-bold text-lg tracking-tight">Editar cliente</div>
              <div className="text-sm text-muted-foreground mt-0.5">{editBriefing.clients?.company}</div>
            </div>
            <div className="flex flex-col gap-4">
              {[{ label: 'Empresa', key: 'company' as const }, { label: 'Nome', key: 'name' as const }, { label: 'Email', key: 'email' as const }, { label: 'WhatsApp', key: 'phone' as const }].map((f, i) => (
                <div key={f.key} className="space-y-1.5">
                  <label className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground block">{f.label}</label>
                  <Input autoFocus={i === 0} value={editForm[f.key]} onChange={e => setEditForm(p => ({ ...p, [f.key]: e.target.value }))} />
                </div>
              ))}
              <div className="flex gap-2 pt-1">
                <Button variant="outline" onClick={() => setEditBriefing(null)} className="flex-1">Cancelar</Button>
                <Button onClick={saveEdit} disabled={savingEdit} className="flex-1">{savingEdit ? 'Salvando…' : 'Salvar'}</Button>
              </div>
            </div>
          </div>
        </Modal>
      )}

      {/* ── NOTES ────────────────────────────────────────────────────── */}
      {notesBriefing && (
        <Modal onClose={() => setNotesBriefing(null)}>
          <div
            onKeyDown={(e) => {
              if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
                e.preventDefault()
                if (!savingNotes) saveNotes()
              }
            }}
          >
            <div className="mb-5">
              <div className="font-bold text-lg tracking-tight">Anotações internas</div>
              <div className="text-sm text-muted-foreground mt-0.5">Visível só para você — o cliente não vê.</div>
            </div>
            <textarea
              autoFocus
              value={notesText}
              onChange={e => setNotesText(e.target.value)}
              placeholder="Anote qualquer informação sobre este briefing..."
              className="w-full min-h-[140px] bg-card border border-border rounded-md px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground resize-y focus:outline-none focus:ring-2 focus:ring-ring mb-4"
            />
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setNotesBriefing(null)} className="flex-1">Cancelar</Button>
              <Button onClick={saveNotes} disabled={savingNotes} className="flex-1">{savingNotes ? 'Salvando…' : 'Salvar'}</Button>
            </div>
          </div>
        </Modal>
      )}

      {/* ── NOTIFICATIONS ────────────────────────────────────────────── */}
      {notifBriefing && (
        <NotifHistoryModal
          briefing={notifBriefing}
          history={notifHistory}
          onClose={() => { setNotifBriefing(null); setNotifHistory([]) }}
        />
      )}

      {/* ── DELETE ───────────────────────────────────────────────────── */}
      {deleteBriefing && (
        <Modal onClose={() => setDeleteBriefing(null)}>
          <div className="text-center py-2">
            <div className="flex items-center justify-center w-12 h-12 rounded-full bg-destructive/10 mx-auto mb-4"><Trash2 size={22} className="text-destructive" /></div>
            <div className="font-bold text-lg tracking-tight mb-1">Excluir briefing?</div>
            <div className="text-sm text-muted-foreground mb-1"><span className="font-semibold text-foreground">{deleteBriefing.clients?.company}</span> — {deleteBriefing.type_label}</div>
            <div className="text-sm text-muted-foreground mb-6">Esta ação não pode ser desfeita.</div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setDeleteBriefing(null)} className="flex-1">Cancelar</Button>
              <Button variant="destructive" onClick={confirmDelete} disabled={deleting} className="flex-1">{deleting ? 'Excluindo…' : 'Sim, excluir'}</Button>
            </div>
          </div>
        </Modal>
      )}

      {/* ── BATCH DELETE ─────────────────────────────────────────────── */}
      {batchDeleteConfirm && (
        <Modal onClose={() => setBatchDeleteConfirm(false)}>
          <div className="text-center py-2">
            <div className="flex items-center justify-center w-12 h-12 rounded-full bg-destructive/10 mx-auto mb-4"><Trash2 size={22} className="text-destructive" /></div>
            <div className="font-bold text-lg tracking-tight mb-1">Excluir {selectedIds.size} briefings?</div>
            <div className="text-sm text-muted-foreground mb-6">Esta ação não pode ser desfeita.</div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setBatchDeleteConfirm(false)} className="flex-1">Cancelar</Button>
              <Button variant="destructive" onClick={confirmBatchDelete} disabled={batchDeleting} className="flex-1">{batchDeleting ? 'Excluindo…' : `Excluir ${selectedIds.size}`}</Button>
            </div>
          </div>
        </Modal>
      )}

      {/* ── RECIPIENT PICKER ─────────────────────────────────────────── */}
      {pickerBriefing && (
        <RecipientPickerModal
          open={!!pickerBriefing}
          onClose={() => setPickerBriefing(null)}
          clientId={pickerBriefing.clients?.id || ''}
          briefingLabel={pickerBriefing.type_label}
          briefingCompany={pickerBriefing.clients?.company || ''}
          type={pickerType}
          onSubmit={submitPickerSend}
        />
      )}

    </div>
  )
}
