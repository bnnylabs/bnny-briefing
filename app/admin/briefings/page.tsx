'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { FIELD_LABELS_PT, FIELD_LABELS_EN } from '@/lib/briefing-types'
import { useToast, ToastContainer } from '@/components/toast'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { IconButton } from '@/components/ui/icon-button'
import { Pencil, FileText, Bell, BellRing, Copy, RefreshCw, Link, Trash2, Lock, Unlock, ClipboardList, Search, Mail, Check, Send, Eye, Clock, CheckCircle2, Paperclip, Download, ExternalLink, Image as ImageIcon, ShieldCheck, Clipboard, Plus, X, ArrowRight, ScrollText, MoreHorizontal } from 'lucide-react'
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
import { RecipientPickerModal } from '@/components/admin/RecipientPickerModal'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

/** Format Date as YYYY-MM-DD string in local time, matching the existing date filter format */
function toIsoDay(d: Date): string {
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

interface Client { id: string; name: string; company: string; email: string; phone: string; avatar_url?: string | null }
interface Briefing {
  id: string; slug: string; type: string; type_label: string; status: string
  created_at: string; viewed_at: string | null; started_at: string | null
  completed_at: string | null; expires_at: string | null; internal_notes: string | null
  language?: string; editing_locked?: boolean; editing_expires_at?: string | null
  update_count?: number; clients: Client
  recipients?: Array<{ email: string; name: string; role: 'primary' | 'cc' }>
}

const STATUS_LABELS: Record<string, string> = {
  enviado: 'Enviado', visualizado: 'Visualizado', em_andamento: 'Em andamento', concluido: 'Concluído',
}

function fmt(d: string | null) {
  if (!d) return '—'
  return new Date(d).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })
}

function timeAgo(d: string) {
  const diff = Date.now() - new Date(d).getTime()
  const mins = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days = Math.floor(diff / 86400000)
  if (mins < 60) return `há ${mins}min`
  if (hours < 24) return `há ${hours}h`
  if (days === 1) return 'há 1 dia'
  return `há ${days} dias`
}

function StatusIcon({ status, size = 11 }: { status: string; size?: number }) {
  switch (status) {
    case 'enviado':       return <Send size={size} />
    case 'visualizado':   return <Eye size={size} />
    case 'em_andamento':  return <Clock size={size} />
    case 'concluido':     return <CheckCircle2 size={size} />
    default:              return null
  }
}

function StatusBadge({ status }: { status: string }) {
  const variants: Record<string, 'muted' | 'info' | 'warning' | 'success'> = {
    enviado: 'muted', visualizado: 'info', em_andamento: 'warning', concluido: 'success'
  }
  return (
    <Badge variant={variants[status] || 'muted'} className="text-[11px] font-medium whitespace-nowrap">
      <StatusIcon status={status} />
      {STATUS_LABELS[status] || status}
    </Badge>
  )
}

function Modal({ onClose, children, wide }: { onClose: () => void; children: React.ReactNode; wide?: boolean }) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', h)
    // Lock body scroll while modal open
    const orig = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', h)
      document.body.style.overflow = orig
    }
  }, [onClose])
  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in-0 duration-150"
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div className={`relative bg-card border border-border rounded-xl w-full ${wide ? 'max-w-2xl' : 'max-w-md'} max-h-[88vh] overflow-y-auto shadow-2xl animate-in fade-in-0 zoom-in-95 slide-in-from-bottom-1 duration-200 p-6`}
        onClick={e => e.stopPropagation()}>
        <button
          onClick={onClose}
          aria-label="Fechar"
          className="absolute top-3.5 right-3.5 w-7 h-7 flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
          <X size={15} strokeWidth={2} />
        </button>
        {children}
      </div>
    </div>
  )
}

interface FileEntry2 { url: string; name: string; type?: string; size?: number }
function ResponsesContent({ responses, language, companyName, renderFileValue, labelMapPT, labelMapEN }: {
  responses: Record<string, unknown>
  language?: string
  companyName: string
  renderFileValue: (v: unknown) => React.ReactNode
  labelMapPT: Record<string, string>
  labelMapEN: Record<string, string>
}) {
  const allFiles: FileEntry2[] = []
  Object.entries(responses).forEach(([, value]) => {
    if (Array.isArray(value)) {
      (value as FileEntry2[]).forEach(f => {
        if (f && f.name && f.url?.startsWith('http')) allFiles.push(f)
      })
    }
  })
  const imageFiles = allFiles.filter(f =>
    f.type?.startsWith('image/') || /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(f.name || '')
  )
  const otherFiles = allFiles.filter(f =>
    !f.type?.startsWith('image/') && !/\.(jpg|jpeg|png|gif|webp|svg)$/i.test(f.name || '')
  )
  const labelMap = language === 'en-US' ? labelMapEN : labelMapPT

  async function handleDownloadAll() {
    const { downloadAsZip } = await import('@/lib/download-zip')
    await downloadAsZip(allFiles, `${companyName} - arquivos.zip`)
  }

  return (
    <>
      {allFiles.length > 0 && (
        <div className="mb-4 px-4 py-3 bg-secondary border border-border rounded-xl flex items-center gap-3">
          <Paperclip className="h-5 w-5 shrink-0 text-muted-foreground" />
          <div className="flex-1 min-w-0">
            <div className="text-sm font-semibold">
              {allFiles.length} {allFiles.length === 1 ? 'arquivo anexado' : 'arquivos anexados'}
              {imageFiles.length > 0 && <span className="ml-2 text-xs text-muted-foreground font-normal">· {imageFiles.length} {imageFiles.length === 1 ? 'imagem' : 'imagens'}{otherFiles.length > 0 && `, ${otherFiles.length} doc`}</span>}
            </div>
            <div className="text-xs text-muted-foreground mt-0.5 truncate">{allFiles.map(f => f.name).join(', ')}</div>
          </div>
          <Button onClick={handleDownloadAll} size="sm" className="shrink-0"><Download size={14} /> Baixar ZIP</Button>
        </div>
      )}
      <div className="flex flex-col gap-2">
        {Object.entries(responses).filter(([, v]) => v).map(([key, value]) => {
          const isFileField = /arquivo|logo|referencia|anexo|upload|files/i.test(key) || (Array.isArray(value) && value.length > 0 && typeof value[0] === 'object' && value[0] !== null && 'url' in (value[0] as object))
          const displayValue = isFileField ? '' : (Array.isArray(value) ? (value as string[]).join(', ') : String(value))
          const isShort = !isFileField && displayValue.length < 60
          return (
            <div key={key} className="rounded-xl overflow-hidden border border-border">
              <div className={`px-3.5 py-2 bg-secondary flex items-center justify-between gap-2 ${(!isShort || isFileField) ? 'border-b border-border' : ''}`}>
                <span className="flex items-center gap-1.5 text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                  {isFileField && <Paperclip size={10} />}
                  {labelMap[key] || key.replace(/_/g, ' ')}
                </span>
                {isShort && !isFileField && <span className="text-sm font-semibold text-foreground">{displayValue}</span>}
              </div>
              {(!isShort || isFileField) && (
                <div className="px-3.5 py-3 text-sm text-foreground leading-relaxed bg-card">
                  {isFileField ? renderFileValue(value) : <span className="whitespace-pre-wrap">{displayValue}</span>}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </>
  )
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
    const html = `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"><style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:'Helvetica Neue',Arial,sans-serif;color:#111;padding:48px;max-width:800px;margin:0 auto}.hdr{display:flex;justify-content:space-between;align-items:flex-start;padding-bottom:24px;border-bottom:3px solid #c8ff00;margin-bottom:32px}.logo{font-size:22px;font-weight:800;letter-spacing:-0.04em}.logo span{color:#c8ff00;background:#111;padding:2px 8px;border-radius:4px}.badge{background:#111;color:#c8ff00;font-size:10px;font-weight:700;padding:3px 10px;border-radius:999px;text-transform:uppercase;letter-spacing:.08em;margin-top:6px;display:inline-block}.cb{background:#f8f8f8;border-radius:12px;padding:20px 24px;margin-bottom:32px;display:grid;grid-template-columns:1fr 1fr;gap:12px}.cf label{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.1em;color:#888;display:block;margin-bottom:3px}.st{font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.1em;color:#888;margin-bottom:16px;padding-bottom:8px;border-bottom:1px solid #eee}.f{margin-bottom:18px}.fl{font-size:10px;font-weight:700;color:#555;text-transform:uppercase;letter-spacing:.07em;margin-bottom:5px}.fv{font-size:14px;color:#111;line-height:1.6;background:#f8f8f8;padding:10px 14px;border-radius:8px;border-left:3px solid #c8ff00}.footer{margin-top:48px;padding-top:16px;border-top:1px solid #eee;font-size:11px;color:#aaa;text-align:center}</style></head><body><div class="hdr"><div><div class="logo"><span>Bnny</span> Labs</div><div style="font-size:12px;color:#555;margin-top:4px">Sistema de Briefings</div></div><div style="text-align:right"><div style="font-size:17px;font-weight:700">${b.type_label}</div><div class="badge">${STATUS_LABELS[b.status]||b.status}</div></div></div><div class="cb"><div class="cf"><label>Empresa</label><span style="font-size:15px;font-weight:700">${b.clients?.company||'—'}</span></div><div class="cf"><label>Contato</label><span>${b.clients?.name||'—'}</span></div><div class="cf"><label>Email</label><span>${b.clients?.email||'—'}</span></div><div class="cf"><label>WhatsApp</label><span>${b.clients?.phone||'—'}</span></div><div class="cf"><label>Concluído em</label><span>${fmt(b.completed_at)}</span></div><div class="cf"><label>Tipo</label><span>${b.type_label}</span></div></div><div class="st">Respostas do briefing</div>${fields.map(([k,v])=>`<div class="f"><div class="fl">${k.replace(/_/g,' ')}</div><div class="fv">${Array.isArray(v)?(v as string[]).join(', '):String(v)}</div></div>`).join('')}<div class="footer">Gerado por Bnny Labs · briefing.bnnylabs.com · ${new Date().toLocaleDateString('pt-BR')}</div></body></html>`
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
              <ArrowRight size={14} className="opacity-70" />
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

            {/* Search + Filters */}
            <div className="flex gap-2 items-center flex-wrap">
              <div className="flex-1 min-w-[180px] relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                <Input value={search} onChange={e => setSearch(e.target.value)}
                  placeholder="Buscar cliente, empresa ou tipo..." className="pl-9 bg-card" />
              </div>
              <Select value={sortBy} onValueChange={(v) => setSortBy(v as 'recent' | 'oldest' | 'company')}>
                <SelectTrigger className="w-44 shrink-0">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="recent">Mais recentes</SelectItem>
                  <SelectItem value="oldest">Mais antigos</SelectItem>
                  <SelectItem value="company">A → Z</SelectItem>
                </SelectContent>
              </Select>
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

            {/* Select-all + inline batch actions — single persistent row, no layout shift */}
            {filtered.length > 1 && (
              <div className="mt-4 mb-3 flex items-center justify-between px-1">
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
                    className="cursor-pointer select-none text-xs text-muted-foreground"
                  >
                    {selectedIds.size === filtered.length && filtered.length > 0
                      ? 'Desmarcar todos'
                      : 'Selecionar todos'}{' '}
                    ({filtered.length})
                  </label>
                </div>

                {/* Batch actions — same height always, opacity transition only */}
                <div className={`flex items-center gap-1.5 transition-opacity duration-150 ${selectedIds.size > 0 ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
                  <span className="text-xs text-muted-foreground tabular-nums">
                    {selectedIds.size} selecionado{selectedIds.size !== 1 ? 's' : ''}
                  </span>
                  <button
                    type="button"
                    onClick={() => setSelectedIds(new Set())}
                    className="rounded-md px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={() => setBatchDeleteConfirm(true)}
                    className="inline-flex items-center gap-1 rounded-md border border-destructive/40 px-2.5 py-1 text-xs font-medium text-destructive transition-colors hover:bg-destructive hover:text-destructive-foreground"
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
              <div className="text-center py-20 text-muted-foreground">
                <ClipboardList className="h-12 w-12 mx-auto mb-4 opacity-40" />
                <div className="font-semibold text-foreground mb-1">
                  {search || dateFrom || dateTo || statusFilter !== 'all' ? 'Nenhum resultado' : 'Nenhum briefing ainda'}
                </div>
                <div className="text-sm mb-5">
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
                    <Plus size={14} />
                    Criar briefing
                  </Button>
                )}
              </div>
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
                          <StatusBadge status={b.status} />
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
                                              ? 'border-lime-300 bg-lime-50 text-lime-700'
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
                          <span className="text-[11px] text-muted-foreground/70">{b.clients?.name}</span>
                          <span className="text-[11px] text-muted-foreground/50">· {timeAgo(b.created_at)} ({fmt(b.created_at)})</span>
                          {b.completed_at && <span className="text-[11px] text-muted-foreground/50">· concluído {fmt(b.completed_at)}</span>}
                          {b.expires_at && new Date(b.expires_at) > new Date() && <span className="text-[11px] text-warning">· expira {fmt(b.expires_at)}</span>}
                          {b.expires_at && new Date(b.expires_at) < new Date() && <span className="text-[11px] text-destructive">· expirado</span>}
                        </div>
                      </div>

                      {/* ── Actions ─────────────────────────────────── */}
                      <div className="flex items-center gap-1.5 shrink-0">
                        {b.status === 'concluido' && (
                          <Button size="sm" onClick={() => viewResponses(b)}>
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
        <Modal onClose={() => { setResponsesBriefing(null); setResponses(null) }} wide>
          <div className="mb-5 pb-4 border-b border-border/60">
            <div className="font-bold text-lg tracking-tight">{responsesBriefing.clients?.company}</div>
            <div className="flex items-center gap-2 mt-1.5 flex-wrap">
              <Badge variant="outline" className="text-[11px] font-medium">{responsesBriefing.type_label}</Badge>
              {responsesBriefing.clients?.name && <span className="text-sm text-muted-foreground">{responsesBriefing.clients.name}</span>}
            </div>
            {responsesBriefing.completed_at && <div className="text-xs text-muted-foreground mt-1.5">Concluído em {fmt(responsesBriefing.completed_at)}</div>}
          </div>
          <div className="flex gap-2 mb-5">
            <Button onClick={copyAll} variant="outline" className="flex-1"><Clipboard size={14} />{copied ? 'Copiado!' : 'Copiar tudo'}</Button>
            <Button onClick={exportPDF} variant="outline" className="flex-1"><FileText size={14} /> Exportar PDF</Button>
          </div>
          {responseVersions > 1 && responseDiff && (
            <div className="mb-4">
              <div className="flex gap-2">
                <button onClick={() => setShowDiffView(false)}
                  className={`flex-1 text-xs py-2 rounded-lg border transition-colors inline-flex items-center justify-center gap-1.5 ${!showDiffView ? 'border-foreground/20 bg-muted text-foreground font-medium' : 'border-border text-muted-foreground hover:bg-muted/40 hover:text-foreground'}`}>
                  <ClipboardList size={12} /> Respostas atuais
                </button>
                <button onClick={() => setShowDiffView(true)}
                  className={`flex-1 text-xs py-2 rounded-lg border transition-colors inline-flex items-center justify-center gap-2 ${showDiffView ? 'border-foreground/20 bg-muted text-foreground font-medium' : 'border-border text-muted-foreground hover:bg-muted/40 hover:text-foreground'}`}>
                  <Pencil size={12} /> Ver alterações
                  <span className="rounded-md border border-border bg-muted/60 px-1.5 py-0.5 text-[10px] font-bold text-foreground">{Object.keys(responseDiff).length}</span>
                </button>
              </div>
              {showDiffView && (
                <div className="mt-3 flex flex-col gap-2">
                  {Object.keys(responseDiff).length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground text-sm">Nenhuma alteração detectada</div>
                  ) : Object.entries(responseDiff).map(([key, { old: oldVal, new: newVal }]) => {
                    const labelMap = responsesBriefing?.language === 'en-US' ? FIELD_LABELS_EN : FIELD_LABELS_PT
                    const label = labelMap[key] || key.replace(/_/g, ' ')
                    const oldStr = Array.isArray(oldVal) ? (oldVal as string[]).join(', ') : String(oldVal || '')
                    const newStr = Array.isArray(newVal) ? (newVal as string[]).join(', ') : String(newVal || '')
                    return (
                      <div key={key} className="rounded-lg overflow-hidden border border-border">
                        <div className="px-3.5 py-2 bg-muted/40 border-b border-border">
                          <span className="inline-flex items-center gap-1.5 text-[10px] font-bold text-foreground uppercase tracking-wider"><Pencil size={10} /> {label}</span>
                        </div>
                        <div className="px-3.5 py-3 bg-card flex flex-col gap-2">
                          <div className="text-xs text-muted-foreground line-through">{oldStr || '—'}</div>
                          <div className="text-sm font-semibold text-foreground">{newStr}</div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}
          {responses && !showDiffView && (
            <ResponsesContent responses={responses} language={responsesBriefing?.language}
              companyName={responsesBriefing?.clients?.company || 'briefing'}
              renderFileValue={renderFileValue} labelMapPT={FIELD_LABELS_PT} labelMapEN={FIELD_LABELS_EN} />
          )}
          {!responses && <div className="flex justify-center py-10"><div className="spinner" /></div>}
        </Modal>
      )}

      {/* ── DIFF MODAL ───────────────────────────────────────────────── */}
      {diffModal && (
        <Modal onClose={() => setDiffModal(null)} wide>
          <div className="mb-5 pb-4 border-b border-border/60">
            <div className="font-bold text-lg tracking-tight">{diffModal.briefing.clients?.company}</div>
            <div className="flex items-center gap-2 mt-1.5">
              <Badge variant="outline" className="text-[10px] font-medium gap-1"><Pencil size={10} /> {diffModal.briefing.update_count}x atualizado</Badge>
              <span className="text-sm text-muted-foreground">{diffModal.briefing.type_label}</span>
            </div>
          </div>
          {loadingDiff ? (
            <div className="flex justify-center py-10"><div className="spinner" /></div>
          ) : Object.keys(diffModal.diff).length === 0 ? (
            <div className="text-center py-10 text-muted-foreground">
              <Search className="h-10 w-10 mx-auto mb-3 opacity-40" />
              <div className="text-sm mb-4">Não foi possível comparar versões.</div>
              <Button variant="outline" onClick={() => { setDiffModal(null); viewResponses(diffModal.briefing) }}>Ver respostas →</Button>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              <div className="text-xs text-muted-foreground mb-1">{Object.keys(diffModal.diff).length} campos alterados</div>
              {Object.entries(diffModal.diff).map(([key, { old: oldVal, new: newVal }]) => {
                const labelMap = diffModal.briefing.language === 'en-US' ? FIELD_LABELS_EN : FIELD_LABELS_PT
                const label = labelMap[key] || key.replace(/_/g, ' ')
                const oldStr = Array.isArray(oldVal) ? (oldVal as string[]).join(', ') : String(oldVal || '')
                const newStr = Array.isArray(newVal) ? (newVal as string[]).join(', ') : String(newVal || '')
                return (
                  <div key={key} className="rounded-lg overflow-hidden border border-border">
                    <div className="px-3.5 py-2 bg-muted/40 border-b border-border">
                      <span className="inline-flex items-center gap-1.5 text-[10px] font-bold text-foreground uppercase tracking-wider"><Pencil size={10} /> {label}</span>
                    </div>
                    <div className="px-3.5 py-3 bg-card flex flex-col gap-2">
                      <div className="text-xs text-muted-foreground line-through">{oldStr || '—'}</div>
                      <div className="text-sm font-semibold text-foreground">{newStr}</div>
                    </div>
                  </div>
                )
              })}
              <Button variant="ghost" onClick={() => { setDiffModal(null); viewResponses(diffModal.briefing) }} className="mt-1">Ver todas as respostas →</Button>
            </div>
          )}
        </Modal>
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
        <Modal onClose={() => { setNotifBriefing(null); setNotifHistory([]) }}>
          <div className="mb-5">
            <div className="font-bold text-lg tracking-tight">Histórico de atividades</div>
            <div className="text-sm text-muted-foreground mt-0.5">{notifBriefing.clients?.company} · {notifBriefing.type_label}</div>
          </div>
          {notifHistory.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground text-sm">Nenhuma atividade registrada</div>
          ) : (
            <div className="flex flex-col gap-2">
              {notifHistory.map((n, i) => {
                // Client activity events — different visual treatment
                const isClientEvent = ['link_opened', 'form_started', 'form_submitted'].includes(n.type)

                const lblMap: Record<string, { icon: React.ReactNode; label: string; clientEvent?: boolean }> = {
                  // Admin sends
                  email_client: { icon: <Send size={13} />,       label: 'Email enviado' },
                  email_admin:  { icon: <Mail size={13} />,       label: 'Notificação ao admin' },
                  reminder:     { icon: <Bell size={13} />,       label: 'Lembrete enviado' },
                  resend:       { icon: <RefreshCw size={13} />,  label: 'Reenvio' },
                  // Client activity
                  link_opened:    { icon: <Eye size={13} className="text-info" />,         label: 'Link acessado', clientEvent: true },
                  form_started:   { icon: <Clock size={13} className="text-warning" />,    label: 'Preenchimento iniciado', clientEvent: true },
                  form_submitted: { icon: <CheckCircle2 size={13} className="text-success" />, label: 'Briefing concluído', clientEvent: true },
                }
                const entry = lblMap[n.type] || { icon: <Bell size={13} />, label: n.type }

                return (
                  <div key={i} className={`rounded-lg border px-4 py-3 ${isClientEvent ? 'border-border bg-card' : 'border-border bg-muted/30'}`}>
                    <div className="flex items-center justify-between">
                      <span className="inline-flex items-center gap-1.5 text-sm font-medium">
                        {entry.icon} {entry.label}
                      </span>
                      {!isClientEvent && (
                        <span className={`inline-flex items-center gap-1 text-xs font-medium ${n.status === 'sent' ? 'text-success' : 'text-destructive'}`}>
                          {n.status === 'sent' ? <><Check size={12} /> Entregue</> : <><Trash2 size={12} /> Falhou</>}
                        </span>
                      )}
                    </div>
                    {n.details?.to && (
                      <div className="mt-1.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                        {n.details.role === 'cc' && (
                          <span className="rounded-md border border-border bg-muted/60 px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">CC</span>
                        )}
                        {n.details.role === 'primary' && (
                          <span className="rounded-md border border-lime-300 bg-lime-50 px-1.5 py-0.5 text-[10px] font-medium text-lime-700">Principal</span>
                        )}
                        {n.details.name && <span className="font-medium text-foreground">{n.details.name}</span>}
                        {n.details.name && <span className="text-muted-foreground/50">·</span>}
                        <span>{n.details.to}</span>
                      </div>
                    )}
                    <div className="text-[10px] text-muted-foreground/60 mt-1">{new Date(n.sent_at).toLocaleString('pt-BR')}</div>
                  </div>
                )
              })}
            </div>
          )}
        </Modal>
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
