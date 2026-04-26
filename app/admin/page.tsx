'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { FIELD_LABELS_PT, FIELD_LABELS_EN } from '@/lib/briefing-types'
import { useToast, ToastContainer } from '@/components/toast'
import { Button } from '@/components/ui/button'
import { Pencil, FileText, Bell, Copy, RefreshCw, Link, CheckSquare, Trash2, Lock, Unlock, ClipboardList } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'

interface Client { id: string; name: string; company: string; email: string; phone: string }
interface Briefing {
  id: string; slug: string; type: string; type_label: string; status: string
  created_at: string; viewed_at: string | null; started_at: string | null
  completed_at: string | null; expires_at: string | null; internal_notes: string | null
  language?: string; editing_locked?: boolean; editing_expires_at?: string | null; update_count?: number; clients: Client
}
interface ActivityLog {
  id: string; action: string; details: Record<string, unknown>; created_at: string
}

const STATUS_LABELS: Record<string, string> = {
  enviado: 'Enviado', visualizado: 'Visualizado', em_andamento: 'Em andamento', concluido: 'Concluído',
}
const STATUS_ICONS: Record<string, string> = {
  enviado: '📨', visualizado: '👁', em_andamento: '⏳', concluido: '✅',
}
const ACTION_LABELS: Record<string, string> = {
  delete_briefing: '🗑️ Briefing excluído',
  bulk_delete_briefings: '🗑️ Exclusão em lote',
  duplicate_briefing: '📋 Briefing duplicado',
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

function StatusBadge({ status }: { status: string }) {
  const variants: Record<string, 'muted' | 'outline' | 'warning' | 'success'> = {
    enviado: 'outline', visualizado: 'muted', em_andamento: 'warning', concluido: 'success'
  }
  return (
    <Badge variant={variants[status] || 'muted'} className="text-[11px] font-semibold whitespace-nowrap">
      {STATUS_ICONS[status]} {STATUS_LABELS[status] || status}
    </Badge>
  )
}

function Modal({ onClose, children, wide }: { onClose: () => void; children: React.ReactNode; wide?: boolean }) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', h)
    return () => document.removeEventListener('keydown', h)
  }, [onClose])
  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div className={`relative bg-card border border-border rounded-xl w-full ${wide ? 'max-w-2xl' : 'max-w-lg'} max-h-[90vh] overflow-y-auto shadow-xl animate-in fade-in-0 zoom-in-95 duration-150 p-6`}
        onClick={e => e.stopPropagation()}>
        <button onClick={onClose} className="absolute top-4 right-4 w-7 h-7 flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-all text-lg">×</button>
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
          <span className="text-xl">📎</span>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-semibold">
              {allFiles.length} {allFiles.length === 1 ? 'arquivo anexado' : 'arquivos anexados'}
              {imageFiles.length > 0 && <span className="ml-2 text-xs text-muted-foreground font-normal">· {imageFiles.length} {imageFiles.length === 1 ? 'imagem' : 'imagens'}{otherFiles.length > 0 && `, ${otherFiles.length} doc`}</span>}
            </div>
            <div className="text-xs text-muted-foreground mt-0.5 truncate">{allFiles.map(f => f.name).join(', ')}</div>
          </div>
          <Button onClick={handleDownloadAll} size="sm" className="shrink-0">⬇ Baixar ZIP</Button>
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
                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                  {isFileField && '📎 '}{labelMap[key] || key.replace(/_/g, ' ')}
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
  const [authed, setAuthed] = useState<boolean | null>(null)
  const [password, setPassword] = useState('')
  const [loginError, setLoginError] = useState('')
  const [briefings, setBriefings] = useState<Briefing[]>([])
  const [loading, setLoading] = useState(false)
  const [statusFilter, setStatusFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [view, setView] = useState<'list' | 'settings' | 'log'>('list')
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
  const [sendingReminder, setSendingReminder] = useState<string | null>(null)
  const [reminderSent, setReminderSent] = useState<string | null>(null)
  const [notifBriefing, setNotifBriefing] = useState<Briefing | null>(null)
  const [notifHistory, setNotifHistory] = useState<Array<{type: string; status: string; sent_at: string; details: Record<string, string>}>>([])
  const [sendingResend, setSendingResend] = useState<string | null>(null)

  const [deleteBriefing, setDeleteBriefing] = useState<Briefing | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [batchDeleteConfirm, setBatchDeleteConfirm] = useState(false)
  const [batchDeleting, setBatchDeleting] = useState(false)

  const [duplicating, setDuplicating] = useState<string | null>(null)
  const [duplicatedSlug, setDuplicatedSlug] = useState<string | null>(null)
  const [dupLink, setDupLink] = useState('')

  const [clientHistoryClient, setClientHistoryClient] = useState<Client | null>(null)
  const [clientHistoryBriefings, setClientHistoryBriefings] = useState<Briefing[]>([])

  const [activityLogs, setActivityLogs] = useState<ActivityLog[]>([])
  const [logsLoading, setLogsLoading] = useState(false)

  const [settings, setSettings] = useState({ notification_email: '', notification_whatsapp: '', briefing_expiry_days: '30', reminder_days: '3', editing_hours: '48', admin_password: '' })
  const [savingSettings, setSavingSettings] = useState(false)
  const [settingsSaved, setSettingsSaved] = useState(false)

  const router = useRouter()

  const loadBriefings = useCallback(async () => {
    setLoading(true)
    const res = await fetch('/api/briefings')
    if (res.ok) { const data = await res.json(); setBriefings(data.briefings || []) }
    setLoading(false)
  }, [])

  const loadSettings = useCallback(async () => {
    const res = await fetch('/api/admin/settings')
    if (res.ok) { const data = await res.json(); setSettings(s => ({ ...s, ...data.settings })) }
  }, [])

  const loadActivityLog = useCallback(async () => {
    setLogsLoading(true)
    const res = await fetch('/api/admin/activity-log')
    if (res.ok) { const data = await res.json(); setActivityLogs(data.logs || []) }
    setLogsLoading(false)
  }, [])

  useEffect(() => {
    fetch('/api/briefings').then(r => {
      if (r.status === 401) setAuthed(false)
      else { setAuthed(true); loadBriefings(); loadSettings() }
    })
  }, [loadBriefings, loadSettings])

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    const res = await fetch('/api/auth', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password }) })
    if (res.ok) { setAuthed(true); loadBriefings(); loadSettings() }
    else setLoginError('Senha incorreta')
  }

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
    toast(!currentLocked ? '🔒 Edição bloqueada' : '🔓 Edição liberada', 'success', 2000)
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

  async function saveSettings() {
    setSavingSettings(true)
    await fetch('/api/admin/settings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(settings) })
    setSavingSettings(false); setSettingsSaved(true); setTimeout(() => setSettingsSaved(false), 2000)
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
    setSendingReminder(b.id)
    await fetch(`/api/admin/notify`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ slug: b.slug, type: 'reminder' }) })
    setSendingReminder(null); setReminderSent(b.id); setTimeout(() => setReminderSent(null), 3000)
  }

  async function viewNotifications(b: Briefing) {
    setNotifBriefing(b)
    const res = await fetch(`/api/briefings/${b.slug}/notifications`)
    if (res.ok) { const data = await res.json(); setNotifHistory(data.notifications || []) }
  }

  async function resendEmail(b: Briefing) {
    setSendingResend(b.id)
    const res = await fetch('/api/admin/notify', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ slug: b.slug, type: 'resend' })
    })
    const data = await res.json()
    setSendingResend(null)
    if (data.emailSent) { setReminderSent(b.id + '_resend'); setTimeout(() => setReminderSent(null), 3000) }
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
    setClientHistoryClient(client)
    setClientHistoryBriefings(briefings.filter(b => b.clients?.id === client.id))
  }

  const filtered = briefings.filter(b => {
    if (statusFilter !== 'all' && b.status !== statusFilter) return false
    if (search) { const q = search.toLowerCase(); if (!b.clients?.company?.toLowerCase().includes(q) && !b.clients?.name?.toLowerCase().includes(q) && !b.type_label?.toLowerCase().includes(q)) return false }
    if (dateFrom && new Date(b.created_at) < new Date(dateFrom)) return false
    if (dateTo && new Date(b.created_at) > new Date(dateTo + 'T23:59:59')) return false
    return true
  })

  const counts = { all: briefings.length, enviado: briefings.filter(b=>b.status==='enviado').length, visualizado: briefings.filter(b=>b.status==='visualizado').length, em_andamento: briefings.filter(b=>b.status==='em_andamento').length, concluido: briefings.filter(b=>b.status==='concluido').length }

  if (authed === null) return <div className="flex items-center justify-center h-screen bg-background"><div className="spinner" /></div>

  if (!authed) return (
    <div className="flex items-center justify-center min-h-screen bg-background px-4">
      <div className="w-full max-w-sm animate-in fade-in-0 duration-300">
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 mb-2">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center text-primary-foreground font-black text-sm">B</div>
            <span className="font-bold text-xl tracking-tight">Bnny <span className="text-primary">Labs</span></span>
          </div>
          <p className="text-muted-foreground text-sm">Painel de briefings</p>
        </div>
        <form onSubmit={handleLogin} className="flex flex-col gap-3">
          <Input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Senha de acesso" autoFocus className="h-11 text-base" />
          {loginError && <p className="text-destructive text-sm text-center">{loginError}</p>}
          <Button type="submit" className="h-11 text-base font-bold">Entrar</Button>
        </form>
      </div>
    </div>
  )


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
            <span className="text-xl">🖼️</span>
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
          <span className="text-xl">{f.type?.includes('pdf') ? '📄' : '📎'}</span>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-semibold truncate">{f.name}</div>
            {sizeLabel && <div className="text-xs text-muted-foreground">{sizeLabel}</div>}
          </div>
          <span className="text-xs text-primary shrink-0">↗ Abrir</span>
        </a>
      )

      return (
        <div key={i} className="flex items-center gap-2 px-3 py-2 bg-secondary border border-border rounded-lg opacity-60">
          <span className="text-xl">📎</span>
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
      ? <a href={str} target="_blank" rel="noopener noreferrer" className="text-primary underline break-all text-sm">📎 {str.split('/').pop()}</a>
      : <span className="text-muted-foreground text-sm">📎 {str}</span>
  }

  return (
    <div className="min-h-screen bg-background">
      <ToastContainer toasts={toasts} remove={removeToast} />

      <div className="px-6 py-6 max-w-5xl mx-auto">

        {/* ── ACTIVITY LOG ─────────────────────────────────────────── */}
        {view === 'log' && (
          <div className="space-y-4">
            <div className="flex items-center gap-3 mb-6">
              <h1 className="text-xl font-bold tracking-tight">Log de Atividades</h1>
              <button onClick={() => setView('list')} className="text-xs text-muted-foreground hover:text-foreground transition-colors ml-auto">← Voltar</button>
            </div>
            {logsLoading ? (
              <div className="flex items-center justify-center py-20"><div className="spinner" /></div>
            ) : activityLogs.length === 0 ? (
              <div className="text-center py-20 text-muted-foreground">
                <div className="text-4xl mb-3">📋</div>
                <div className="font-medium">Nenhuma atividade registrada ainda</div>
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {activityLogs.map(log => (
                  <div key={log.id} className="rounded-lg border border-border bg-card px-4 py-3 flex items-start justify-between gap-4">
                    <div>
                      <div className="font-semibold text-sm">{ACTION_LABELS[log.action] || log.action}</div>
                      {log.details?.company ? <div className="text-xs text-muted-foreground mt-1">{String(log.details.company)} · {String(log.details.type_label ?? '')}</div> : null}
                      {log.details?.count ? <div className="text-xs text-muted-foreground mt-1">{String(log.details.count)} briefings excluídos</div> : null}
                    </div>
                    <span className="text-xs text-muted-foreground whitespace-nowrap shrink-0">{fmt(log.created_at)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── SETTINGS ─────────────────────────────────────────────── */}
        {view === 'settings' && (
          <div className="space-y-4 max-w-xl">
            <div className="flex items-center gap-3 mb-6">
              <h1 className="text-xl font-bold tracking-tight">Configurações</h1>
              <button onClick={() => setView('list')} className="text-xs text-muted-foreground hover:text-foreground transition-colors ml-auto">← Voltar</button>
            </div>
            <div className="rounded-xl border border-border bg-card p-5 space-y-4">
              <div className="text-sm font-semibold">📬 Notificações</div>
              <div className="space-y-3">
                <div>
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-1.5">Email que recebe notificações</label>
                  <Input value={settings.notification_email} onChange={e => setSettings(s => ({ ...s, notification_email: e.target.value }))} placeholder="seu@email.com" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-1.5">WhatsApp para notificações</label>
                  <Input value={settings.notification_whatsapp} onChange={e => setSettings(s => ({ ...s, notification_whatsapp: e.target.value }))} placeholder="+55 47 99999-9999" />
                  <p className="text-xs text-muted-foreground mt-1">Em breve — integração com WhatsApp API</p>
                </div>
              </div>
            </div>
            <div className="rounded-xl border border-border bg-card p-5 space-y-4">
              <div className="text-sm font-semibold">⏱ Prazos automáticos</div>
              <div className="space-y-3">
                <div>
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-1.5">Validade padrão do link (dias)</label>
                  <Input type="number" value={settings.briefing_expiry_days} onChange={e => setSettings(s => ({ ...s, briefing_expiry_days: e.target.value }))} className="w-28" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-1.5">Lembrete automático após X dias sem resposta</label>
                  <Input type="number" value={settings.reminder_days} onChange={e => setSettings(s => ({ ...s, reminder_days: e.target.value }))} className="w-28" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-1.5">Janela de edição pelo cliente (horas)</label>
                  <Input type="number" value={settings.editing_hours} onChange={e => setSettings(s => ({ ...s, editing_hours: e.target.value }))} className="w-28" />
                </div>
              </div>
            </div>
            <div className="rounded-xl border border-border bg-card p-5 space-y-3">
              <div className="text-sm font-semibold">🔒 Segurança</div>
              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-1.5">Nova senha de acesso</label>
                <Input type="password" value={settings.admin_password} onChange={e => setSettings(s => ({ ...s, admin_password: e.target.value }))} placeholder="••••••••" />
              </div>
            </div>
            <Button onClick={saveSettings} disabled={savingSettings} className="w-full h-11">
              {savingSettings ? 'Salvando...' : settingsSaved ? '✓ Salvo!' : 'Salvar configurações'}
            </Button>
          </div>
        )}

        {/* ── BRIEFINGS LIST ────────────────────────────────────────── */}
        {view === 'list' && (
          <>
            {/* Stats grid */}
            <div className="grid grid-cols-5 gap-2 mb-5">
              {([
                { label: 'Total',       value: briefings.length,                                          status: '' },
                { label: 'Enviado',     value: briefings.filter(b => b.status === 'enviado').length,      status: 'enviado' },
                { label: 'Visualizado', value: briefings.filter(b => b.status === 'visualizado').length,  status: 'visualizado' },
                { label: 'Andamento',   value: briefings.filter(b => b.status === 'em_andamento').length, status: 'em_andamento' },
                { label: 'Concluído',   value: briefings.filter(b => b.status === 'concluido').length,    status: 'concluido' },
              ] as { label: string; value: number; status: string }[]).map(s => (
                <button key={s.label} onClick={() => setStatusFilter(prev => prev === s.status ? '' : s.status)}
                  className={`rounded-lg border p-3.5 text-left transition-colors duration-100 cursor-pointer ${statusFilter === s.status ? 'border-primary/30 bg-primary/5' : 'border-border bg-card hover:border-border/70'}`}>
                  <div className={`text-2xl font-bold tabular-nums leading-none font-mono ${statusFilter === s.status ? 'text-primary' : 'text-foreground'}`}>{s.value}</div>
                  <div className="text-[10px] text-muted-foreground font-medium uppercase tracking-widest mt-1.5">{s.label}</div>
                </button>
              ))}
            </div>

            {/* Search + Filters */}
            <div className="flex gap-2 items-center mb-3 flex-wrap">
              <div className="flex-1 min-w-[180px] relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm select-none pointer-events-none">🔍</span>
                <Input value={search} onChange={e => setSearch(e.target.value)}
                  placeholder="Buscar cliente, empresa ou tipo..." className="pl-9 bg-card border-border/70 focus:border-primary/50" />
              </div>
              <Input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="w-auto text-xs" />
              <span className="text-muted-foreground text-sm">→</span>
              <Input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="w-auto text-xs" />
              {(dateFrom || dateTo) && (
                <Button variant="ghost" size="icon-sm" onClick={() => { setDateFrom(''); setDateTo('') }}>×</Button>
              )}
            </div>

            {/* Select all + bulk actions */}
            {filtered.length > 1 && (
              <div className="flex items-center gap-3 mb-3">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <Checkbox
                    checked={selectedIds.size === filtered.length && filtered.length > 0}
                    onCheckedChange={checked => setSelectedIds(checked ? new Set(filtered.map(b => b.id)) : new Set())}
                  />
                  <span className="text-xs text-muted-foreground">Selecionar todos ({filtered.length})</span>
                </label>
                {selectedIds.size > 0 && (
                  <div className="flex items-center gap-2 ml-auto animate-in fade-in-0 duration-150">
                    <span className="text-xs text-muted-foreground">{selectedIds.size} selecionado{selectedIds.size > 1 ? 's' : ''}</span>
                    <Button variant="destructive" size="sm" onClick={() => setBatchDeleteConfirm(true)}>🗑️ Excluir {selectedIds.size}</Button>
                    <Button variant="ghost" size="sm" onClick={() => setSelectedIds(new Set())}>Cancelar</Button>
                  </div>
                )}
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
                <div className="text-5xl mb-4">📋</div>
                <div className="font-semibold text-foreground mb-1">
                  {search || dateFrom || dateTo ? 'Nenhum resultado' : 'Nenhum briefing ainda'}
                </div>
                <div className="text-sm mb-5">
                  {search || dateFrom || dateTo ? 'Tente ajustar os filtros' : 'Crie o primeiro briefing para começar'}
                </div>
                {!search && !dateFrom && !dateTo && (
                  <Button onClick={() => router.push('/admin/novo')}>+ Criar briefing</Button>
                )}
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {filtered.map(b => (
                  <div key={b.id}
                    className={`rounded-lg border px-4 py-3 transition-colors duration-100 ${selectedIds.has(b.id) ? 'border-primary/40 bg-primary/[0.04]' : 'border-border bg-card hover:border-border/70'}`}>
                    {/* Row: checkbox + name + actions */}
                    <div className="flex items-center gap-2.5">
                      <Checkbox checked={selectedIds.has(b.id)} onCheckedChange={() => toggleSelect(b.id)} className="shrink-0" />
                      <button onClick={() => viewClientHistory(b.clients)}
                        className="font-bold text-[15px] text-left flex-1 min-w-0 truncate hover:text-primary transition-colors bg-transparent border-none p-0 cursor-pointer tracking-tight">
                        {b.clients?.company}
                      </button>
                      <div className="flex items-center gap-1 shrink-0">
                        <Button variant="ghost" size="icon-sm" onClick={() => openEdit(b)} title="Editar"><Pencil size={13} /></Button>
                        <Button variant="ghost" size="icon-sm" className={b.internal_notes ? 'text-primary' : ''}
                          onClick={() => { setNotesBriefing(b); setNotesText(b.internal_notes || '') }} title="Anotações"><FileText size={13} /></Button>
                        <Button variant="ghost" size="icon-sm" onClick={() => viewNotifications(b)} title="Envios"><Bell size={13} /></Button>
                        <Button variant="ghost" size="icon-sm" disabled={duplicating === b.id} onClick={() => duplicateBriefing(b)} title="Duplicar">
                          <Copy size={13} />
                        </Button>
                        {b.status !== 'concluido' && b.clients?.email && (
                          <Button variant="ghost" size="sm" className={reminderSent === b.id + '_resend' ? 'text-primary' : ''}
                            disabled={sendingResend === b.id} onClick={() => resendEmail(b)}>
                            {sendingResend === b.id ? '...' : reminderSent === b.id + '_resend' ? '✓ Reenviado' : '📧 Reenviar'}
                          </Button>
                        )}
                        {b.status !== 'concluido' && (
                          <Button variant="ghost" size="icon-sm" className={reminderSent === b.id ? 'text-primary' : ''}
                            disabled={sendingReminder === b.id} onClick={() => sendReminder(b)} title="Lembrete">
                            {sendingReminder === b.id ? '...' : reminderSent === b.id ? '✓' : '🔔'}
                          </Button>
                        )}
                        <Button variant="ghost" size="sm" onClick={() => copyLink(b.slug)}>
                          {copiedId === b.slug ? '✓ Copiado' : '🔗 Link'}
                        </Button>
                        {b.status === 'concluido' && (
                          <>
                            <Button variant="accent" size="sm" onClick={() => viewResponses(b)}>Ver respostas</Button>
                            <Button variant="ghost" size="icon-sm" title={b.editing_locked ? 'Liberar edição' : 'Bloquear edição'}
                              onClick={() => toggleEditingLock(b.slug, !!b.editing_locked)}>
                              {b.editing_locked ? <Unlock size={13} /> : <Lock size={13} />}
                            </Button>
                          </>
                        )}
                        <Button variant="ghost" size="icon-sm" className="text-destructive/70 hover:text-destructive" onClick={() => setDeleteBriefing(b)}><Trash2 size={13} /></Button>
                      </div>
                    </div>
                    {/* Meta row */}
                    <div className="flex items-center gap-2 mt-2.5 ml-[26px] flex-wrap">
                      <StatusBadge status={b.status} />
                      <Badge variant="outline" className="text-[11px] font-medium">{b.type_label}</Badge>
                      {b.language === 'en-US' && <span className="text-xs" title="Briefing em inglês">🇺🇸</span>}
                      {(b.update_count || 0) > 0 && (
                        <button onClick={() => openDiffModal(b)} title="Ver alterações"
                          className="text-[11px] font-bold text-primary-foreground bg-primary px-2 py-0.5 rounded-full cursor-pointer border-none hover:bg-primary/90 transition-colors">
                          ✏️ {b.update_count}x
                        </button>
                      )}
                      <span className="text-[11px] text-muted-foreground">{b.clients?.name}</span>
                      <span className="text-[11px] text-muted-foreground">· {timeAgo(b.created_at)} ({fmt(b.created_at)})</span>
                      {b.completed_at && <span className="text-[11px] text-muted-foreground">· concluído {fmt(b.completed_at)}</span>}
                      {b.expires_at && new Date(b.expires_at) > new Date() && <span className="text-[11px] text-yellow-500">· expira {fmt(b.expires_at)}</span>}
                      {b.expires_at && new Date(b.expires_at) < new Date() && <span className="text-[11px] text-destructive">· expirado</span>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

      </div>

      {/* ── RESPONSES MODAL ──────────────────────────────────────────── */}
      {responsesBriefing && (
        <Modal onClose={() => { setResponsesBriefing(null); setResponses(null) }} wide>
          <div className="flex items-start justify-between mb-5">
            <div>
              <div className="font-extrabold text-xl tracking-tight">{responsesBriefing.clients?.company}</div>
              <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                <Badge variant="default" className="text-[10px] uppercase tracking-wider">{responsesBriefing.type_label}</Badge>
                <span className="text-sm text-muted-foreground">{responsesBriefing.clients?.name}</span>
                {responsesBriefing.clients?.email && <span className="text-sm text-muted-foreground">· {responsesBriefing.clients.email}</span>}
              </div>
              {responsesBriefing.completed_at && <div className="text-xs text-muted-foreground mt-1">Concluído em {fmt(responsesBriefing.completed_at)}</div>}
            </div>
          </div>
          <div className="flex gap-2 mb-5">
            <Button onClick={copyAll} variant="outline" className="flex-1"><><ClipboardList size={14} />{copied ? 'Copiado!' : 'Copiar tudo'}</></Button>
            <Button onClick={exportPDF} variant="accent" className="flex-1">📄 Exportar PDF</Button>
          </div>
          {responseVersions > 1 && responseDiff && (
            <div className="mb-4">
              <div className="flex gap-2">
                <button onClick={() => setShowDiffView(false)}
                  className={`flex-1 text-xs py-2 rounded-lg border transition-colors ${!showDiffView ? 'border-primary/40 bg-primary/10 text-primary font-semibold' : 'border-border text-muted-foreground hover:text-foreground'}`}>
                  📋 Respostas atuais
                </button>
                <button onClick={() => setShowDiffView(true)}
                  className={`flex-1 text-xs py-2 rounded-lg border transition-colors flex items-center justify-center gap-2 ${showDiffView ? 'border-primary/40 bg-primary/10 text-primary font-semibold' : 'border-border text-muted-foreground hover:text-foreground'}`}>
                  ✏️ Ver alterações
                  <span className="bg-primary text-primary-foreground text-[10px] font-bold px-1.5 py-0.5 rounded-full">{Object.keys(responseDiff).length}</span>
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
                      <div key={key} className="rounded-lg overflow-hidden border border-primary/20">
                        <div className="px-3.5 py-2 bg-primary/5 border-b border-primary/20">
                          <span className="text-[10px] font-bold text-primary uppercase tracking-wider">✏️ {label}</span>
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
          <div className="font-extrabold text-xl tracking-tight mb-1">{diffModal.briefing.clients?.company}</div>
          <div className="flex items-center gap-2 mb-5">
            <Badge variant="default" className="text-[10px] font-bold">✏️ {diffModal.briefing.update_count}x atualizado</Badge>
            <span className="text-sm text-muted-foreground">{diffModal.briefing.type_label}</span>
          </div>
          {loadingDiff ? (
            <div className="flex justify-center py-10"><div className="spinner" /></div>
          ) : Object.keys(diffModal.diff).length === 0 ? (
            <div className="text-center py-10 text-muted-foreground">
              <div className="text-4xl mb-3">🔍</div>
              <div className="text-sm mb-4">Não foi possível comparar versões.</div>
              <Button variant="accent" onClick={() => { setDiffModal(null); viewResponses(diffModal.briefing) }}>Ver respostas →</Button>
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
                  <div key={key} className="rounded-lg overflow-hidden border border-primary/20">
                    <div className="px-3.5 py-2 bg-primary/5 border-b border-primary/20">
                      <span className="text-[10px] font-bold text-primary uppercase tracking-wider">✏️ {label}</span>
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
          <div className="mb-5">
            <div className="font-bold text-lg">Editar cliente</div>
            <div className="text-xs text-muted-foreground mt-0.5">Após salvar, copie o link e reenvie se necessário</div>
          </div>
          <div className="flex flex-col gap-4">
            {[{ label: 'Empresa', key: 'company' as const }, { label: 'Nome', key: 'name' as const }, { label: 'Email', key: 'email' as const }, { label: 'WhatsApp', key: 'phone' as const }].map(f => (
              <div key={f.key}>
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-1.5">{f.label}</label>
                <Input value={editForm[f.key]} onChange={e => setEditForm(p => ({ ...p, [f.key]: e.target.value }))} />
              </div>
            ))}
            <div className="rounded-lg border border-border bg-muted/30 px-4 py-3 text-xs text-muted-foreground">
              💡 Após salvar, use 🔗 Link para copiar e reenviar o briefing.
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setEditBriefing(null)} className="flex-1">Cancelar</Button>
              <Button onClick={saveEdit} disabled={savingEdit} className="flex-[2]">{savingEdit ? 'Salvando...' : 'Salvar'}</Button>
            </div>
          </div>
        </Modal>
      )}

      {/* ── NOTES ────────────────────────────────────────────────────── */}
      {notesBriefing && (
        <Modal onClose={() => setNotesBriefing(null)}>
          <div className="font-bold text-lg mb-0.5">Anotações internas</div>
          <div className="text-xs text-muted-foreground mb-4">Visível só para você — o cliente não vê</div>
          <textarea value={notesText} onChange={e => setNotesText(e.target.value)}
            placeholder="Anote qualquer informação sobre este briefing..."
            className="w-full min-h-[140px] bg-secondary border border-border rounded-lg px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground resize-y focus:outline-none focus:ring-2 focus:ring-ring mb-4" />
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setNotesBriefing(null)} className="flex-1">Cancelar</Button>
            <Button onClick={saveNotes} disabled={savingNotes} className="flex-[2]">{savingNotes ? 'Salvando...' : 'Salvar anotação'}</Button>
          </div>
        </Modal>
      )}

      {/* ── NOTIFICATIONS ────────────────────────────────────────────── */}
      {notifBriefing && (
        <Modal onClose={() => { setNotifBriefing(null); setNotifHistory([]) }}>
          <div className="font-bold text-lg mb-0.5">Histórico de envios</div>
          <div className="text-xs text-muted-foreground mb-4">{notifBriefing.clients?.company} · {notifBriefing.type_label}</div>
          {notifBriefing.clients?.email && (
            <div className="rounded-lg border border-border bg-secondary px-4 py-2.5 text-sm mb-4">
              📧 Email: <span className="font-semibold">{notifBriefing.clients.email}</span>
            </div>
          )}
          {notifHistory.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground text-sm">Nenhum envio registrado</div>
          ) : (
            <div className="flex flex-col gap-2">
              {notifHistory.map((n, i) => {
                const lbl: Record<string, string> = { email_client: '📧 Email pro cliente', email_admin: '📧 Email pro admin', reminder: '🔔 Lembrete', resend: '📧 Reenvio' }
                return (
                  <div key={i} className="rounded-lg border border-border bg-secondary px-4 py-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">{lbl[n.type] || n.type}</span>
                      <span className={`text-xs font-semibold ${n.status === 'sent' ? 'text-primary' : 'text-destructive'}`}>{n.status === 'sent' ? '✓ Enviado' : '✗ Falhou'}</span>
                    </div>
                    {n.details?.to && <div className="text-xs text-muted-foreground mt-1">Para: {n.details.to}</div>}
                    <div className="text-xs text-muted-foreground mt-0.5">{new Date(n.sent_at).toLocaleString('pt-BR')}</div>
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
            <div className="font-bold text-lg mb-1">Excluir briefing?</div>
            <div className="text-sm text-muted-foreground mb-1"><span className="font-semibold text-foreground">{deleteBriefing.clients?.company}</span> — {deleteBriefing.type_label}</div>
            <div className="text-xs text-muted-foreground mb-6">Esta ação não pode ser desfeita.</div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setDeleteBriefing(null)} className="flex-1">Cancelar</Button>
              <Button variant="destructive" onClick={confirmDelete} disabled={deleting} className="flex-1">{deleting ? 'Excluindo...' : 'Sim, excluir'}</Button>
            </div>
          </div>
        </Modal>
      )}

      {/* ── BATCH DELETE ─────────────────────────────────────────────── */}
      {batchDeleteConfirm && (
        <Modal onClose={() => setBatchDeleteConfirm(false)}>
          <div className="text-center py-2">
            <div className="flex items-center justify-center w-12 h-12 rounded-full bg-destructive/10 mx-auto mb-4"><Trash2 size={22} className="text-destructive" /></div>
            <div className="font-bold text-lg mb-1">Excluir {selectedIds.size} briefings?</div>
            <div className="text-xs text-muted-foreground mb-6">Esta ação não pode ser desfeita.</div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setBatchDeleteConfirm(false)} className="flex-1">Cancelar</Button>
              <Button variant="destructive" onClick={confirmBatchDelete} disabled={batchDeleting} className="flex-1">{batchDeleting ? 'Excluindo...' : `Excluir ${selectedIds.size}`}</Button>
            </div>
          </div>
        </Modal>
      )}

      {/* ── CLIENT HISTORY ───────────────────────────────────────────── */}
      {clientHistoryClient && (
        <Modal onClose={() => setClientHistoryClient(null)} wide>
          <div className="font-bold text-lg mb-0.5">{clientHistoryClient.company}</div>
          <div className="text-xs text-muted-foreground mb-4">{clientHistoryClient.name} · {clientHistoryClient.email}</div>
          <div className="flex flex-col gap-2">
            {briefings.filter(b => b.clients?.company === clientHistoryClient.company).map(b => (
              <div key={b.id} className="rounded-lg border border-border bg-secondary px-4 py-3 flex items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-medium">{b.type_label}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">{timeAgo(b.created_at)} · {fmt(b.created_at)}</div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <StatusBadge status={b.status} />
                  {b.status === 'concluido' && (
                    <Button variant="accent" size="sm" onClick={() => { setClientHistoryClient(null); viewResponses(b) }}>Ver respostas</Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </Modal>
      )}

    </div>
  )
}
