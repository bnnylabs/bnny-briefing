'use client'

import { useState, useEffect, useCallback, ReactNode } from 'react'
import { useRouter, useParams } from 'next/navigation'
import {
  Activity, ArrowRight, BarChart2, Briefcase, Building2,
  Check, CheckCircle2, ChevronDown,
  Clipboard, ClipboardCheck, ClipboardList, Clock, Download, ExternalLink,
  FileText, Image as ImageIcon, Link as LinkIcon,
  Paperclip, Pencil, Plus, Save,
  Star, StickyNote, Users, X,
} from 'lucide-react'
import { SOCIAL_NETWORKS } from './SocialIcons'
import { AvatarUpload } from '@/components/admin/AvatarUpload'
// RecipientPickerModal — same lazy treatment as in /admin/briefings.
// Only mounted when owner triggers send/notify actions, so deferring
// keeps the client detail bundle lighter.
import dynamic from 'next/dynamic'
const RecipientPickerModal = dynamic(
  () => import('@/components/admin/RecipientPickerModal').then((m) => ({ default: m.RecipientPickerModal })),
  { ssr: false },
)
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

import { Button } from '@/components/ui/button'
import { IconButton } from '@/components/ui/icon-button'
import { Badge } from '@/components/ui/badge'
import { Breadcrumbs } from '@/components/ui/breadcrumbs'
import { Input } from '@/components/ui/input'
import { Card } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog'
import { useToast, ToastContainer } from '@/components/toast'
import { FIELD_LABELS_PT, FIELD_LABELS_EN } from '@/lib/briefing-types'
import { cn } from '@/lib/utils'
import { ContactsSection, type ClientContact } from './ContactsSection'
import { NotesSection, type ClientNote } from './NotesSection'
import { ResponsesContent, type FileEntry } from '@/components/admin/briefings/ResponsesContent'
import { ActivityHistoryModal } from './_components/ActivityHistoryModal'
import { ClientBriefingsCard } from './_components/ClientBriefingsCard'
import { AiProfileSection } from './_components/AiProfileSection'
import { BRIEFING_STATUS_LABELS } from '@/components/admin/briefings/BriefingStatusBadge'

// ─── Types ────────────────────────────────────────────────────────────────

type ClientStatus = 'lead' | 'active' | 'recurring' | 'paused' | 'archived'

interface Client {
  id: string
  name: string
  company: string
  email: string
  phone: string
  website: string | null
  analysis: Record<string, unknown> | null
  avatar_url: string | null
  status: ClientStatus
  tags: string[]
  is_starred: boolean
  archived_at: string | null
  last_activity_at: string | null
  preferred_channel: 'email' | 'whatsapp' | 'both'
  social_instagram: string | null
  social_linkedin: string | null
  social_facebook: string | null
  social_youtube: string | null
  social_tiktok: string | null
  social_twitter: string | null
  social_pinterest: string | null
  social_other: string | null
  created_at: string
}

interface Briefing {
  id: string; slug: string; type: string; type_label: string
  status: string; language?: string; created_at: string
  completed_at: string | null; internal_notes: string | null
  editing_locked?: boolean; editing_expires_at?: string | null; update_count?: number
  recipients?: Array<{ email: string; name: string; role: 'primary' | 'cc' }>
}

interface SocialLinks {
  instagram?: string; linkedin?: string; facebook?: string; youtube?: string
  tiktok?: string; twitter?: string; pinterest?: string; other?: string
}

// ─── Constants ────────────────────────────────────────────────────────────

const STATUS_LABELS: Record<ClientStatus, string> = {
  lead: 'Lead', active: 'Ativo', recurring: 'Recorrente', paused: 'Pausado', archived: 'Arquivado',
}
const STATUS_COLORS: Record<ClientStatus, string> = {
  lead: 'border-info/30 bg-info/10 text-info',
  active: 'border-success/30 bg-success/10 text-success',
  recurring: 'border-primary bg-primary text-primary-foreground',
  paused: 'border-warning/30 bg-warning/10 text-warning',
  archived: 'border-border bg-muted text-muted-foreground',
}

// ─── Helpers ──────────────────────────────────────────────────────────────

function fmt(d: string | null) {
  if (!d) return '—'
  return new Date(d).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })
}

function relativeTime(iso: string | null): string {
  if (!iso) return 'nunca'
  const diff = Date.now() - new Date(iso).getTime()
  const days = Math.floor(diff / 86400000)
  if (days === 0) return 'hoje'
  if (days === 1) return 'ontem'
  if (days < 7) return `${days} dias atrás`
  if (days < 30) return `${Math.floor(days / 7)} sem. atrás`
  if (days < 365) return `${Math.floor(days / 30)} meses atrás`
  return `${Math.floor(days / 365)} ano(s) atrás`
}

// ─── Main page ────────────────────────────────────────────────────────────

export default function ClientePerfilPage() {
  const router = useRouter()
  const params = useParams()
  const id = params.id as string

  const [client, setClient] = useState<Client | null>(null)
  const [briefings, setBriefings] = useState<Briefing[]>([])
  const [contacts, setContacts] = useState<ClientContact[]>([])
  const [notes, setNotes] = useState<ClientNote[]>([])
  const [loading, setLoading] = useState(true)

  // Briefing quick-action state
  const [actionDone, setActionDone] = useState<string | null>(null)
  const [copiedSlug, setCopiedSlug] = useState<string | null>(null)
  const [pickerBriefing, setPickerBriefing] = useState<Briefing | null>(null)
  const [pickerType, setPickerType] = useState<'reminder' | 'resend'>('reminder')
  const [activityBriefing, setActivityBriefing] = useState<Briefing | null>(null)
  const [activityHistory, setActivityHistory] = useState<Array<{type: string; status: string; sent_at: string; details: Record<string, string>}>>([])
  const [loadingActivity, setLoadingActivity] = useState(false)

  // Client info edit
  const [editMode, setEditMode] = useState(false)
  const [editForm, setEditForm] = useState({ name: '', company: '', email: '', phone: '', website: '' })
  const [editSocials, setEditSocials] = useState<SocialLinks>({})
  const [savingEdit, setSavingEdit] = useState(false)

  // Status / tags / starred
  const [editingStatus, setEditingStatus] = useState(false)
  const [editingTags, setEditingTags] = useState(false)
  const [newTag, setNewTag] = useState('')
  // Responses modal
  const [viewingResponses, setViewingResponses] = useState<string | null>(null)
  const [responses, setResponses] = useState<Record<string, unknown> | null>(null)
  const [responseDiff, setResponseDiff] = useState<Record<string, { old: unknown; new: unknown }> | null>(null)
  const [responseVersions, setResponseVersions] = useState(0)
  const [showDiff, setShowDiff] = useState(false)
  const [loadingResponses, setLoadingResponses] = useState(false)
  const [copiedResponses, setCopiedResponses] = useState(false)

  const { toasts, toast, remove } = useToast()

  // ── Load ──────────────────────────────────────────────────────────────

  const load = useCallback(async () => {
    setLoading(true)
    const res = await fetch(`/api/admin/clients/${id}`)
    if (res.ok) {
      const d = await res.json()
      setClient(d.client)
      setBriefings(d.briefings ?? [])
      setContacts(d.contacts ?? [])
      setNotes(d.notes ?? [])
      setEditForm({
        name: d.client.name ?? '', company: d.client.company ?? '',
        email: d.client.email ?? '', phone: d.client.phone ?? '',
        website: d.client.website ?? '',
      })
      setEditSocials({
        instagram: d.client.social_instagram ?? '',
        linkedin: d.client.social_linkedin ?? '',
        facebook: d.client.social_facebook ?? '',
        youtube: d.client.social_youtube ?? '',
        tiktok: d.client.social_tiktok ?? '',
        twitter: d.client.social_twitter ?? '',
        pinterest: d.client.social_pinterest ?? '',
        other: d.client.social_other ?? '',
      })
    } else if (res.status === 401) {
      router.push('/admin')
    }
    setLoading(false)
  }, [id, router])

  useEffect(() => { load() }, [load])

  // ── Client info ───────────────────────────────────────────────────────

  async function saveEdit() {
    setSavingEdit(true)
    await fetch(`/api/admin/clients/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...editForm,
        social_instagram: editSocials.instagram || null,
        social_linkedin: editSocials.linkedin || null,
        social_facebook: editSocials.facebook || null,
        social_youtube: editSocials.youtube || null,
        social_tiktok: editSocials.tiktok || null,
        social_twitter: editSocials.twitter || null,
        social_pinterest: editSocials.pinterest || null,
        social_other: editSocials.other || null,
      }),
    })
    setSavingEdit(false)
    setEditMode(false)
    load()
  }

  async function patchClient(patch: Partial<Client>) {
    setClient(c => c ? { ...c, ...patch } : c)
    await fetch(`/api/admin/clients/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    })
  }

  async function toggleStarred() {
    if (!client) return
    await patchClient({ is_starred: !client.is_starred })
    toast(client.is_starred ? 'Removido dos favoritos' : 'Adicionado aos favoritos', 'success', 1500)
  }

  async function setStatus(status: ClientStatus) {
    await patchClient({ status })
    setEditingStatus(false)
    toast(`Status: ${STATUS_LABELS[status]}`, 'success', 1500)
  }

  async function addTag() {
    const tag = newTag.trim()
    if (!tag || !client) return
    if (client.tags.includes(tag)) { setNewTag(''); return }
    const next = [...client.tags, tag]
    await patchClient({ tags: next })
    setNewTag('')
  }

  async function removeTag(tag: string) {
    if (!client) return
    await patchClient({ tags: client.tags.filter(t => t !== tag) })
  }

  // ── Briefings ─────────────────────────────────────────────────────────

  async function viewResponses(slug: string) {
    setViewingResponses(slug)
    setLoadingResponses(true)
    setShowDiff(false)
    const res = await fetch(`/api/briefings/${slug}/responses`)
    if (res.ok) {
      const d = await res.json()
      setResponses(d.answers ?? {})
      setResponseDiff(d.diff ?? null)
      setResponseVersions(d.versions ?? 1)
    }
    setLoadingResponses(false)
  }

  async function toggleLock(slug: string, currentLocked: boolean) {
    await fetch(`/api/briefings/${slug}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ editing_locked: !currentLocked }),
    })
    setBriefings(prev => prev.map(b => b.slug === slug ? { ...b, editing_locked: !currentLocked } : b))
    toast(!currentLocked ? 'Edição bloqueada' : 'Edição liberada', 'success')
  }

  async function sendReminder(slug: string) {
    const b = briefings.find(x => x.slug === slug)
    if (b) { setPickerBriefing(b); setPickerType('reminder') }
  }

  async function resendEmail(slug: string) {
    const b = briefings.find(x => x.slug === slug)
    if (b) { setPickerBriefing(b); setPickerType('resend') }
  }

  async function submitPickerSend(recipients: { email: string; name: string; role: 'primary' | 'cc' }[]) {
    if (!pickerBriefing) return
    const res = await fetch('/api/admin/notify', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ slug: pickerBriefing.slug, type: pickerType, recipients }),
    })
    const data = await res.json().catch(() => ({}))
    if (res.ok) {
      toast(`Enviado para ${data.sent || recipients.length}`, 'success', 2000)
      setActionDone(pickerBriefing.slug + (pickerType === 'resend' ? '_resend' : '_reminder'))
      setTimeout(() => setActionDone(null), 2000)
    } else {
      toast('Erro ao enviar', 'error', 2000)
    }
  }

  function copyBriefingLink(slug: string) {
    navigator.clipboard.writeText(`${window.location.origin}/${slug}`)
      .then(() => {
        setCopiedSlug(slug)
        toast('Link copiado!', 'success', 1500)
        setTimeout(() => setCopiedSlug(null), 2000)
      })
  }

  async function viewActivity(b: Briefing) {
    setActivityBriefing(b)
    setActivityHistory([])
    setLoadingActivity(true)
    const res = await fetch(`/api/briefings/${b.slug}/notifications`)
    if (res.ok) {
      const data = await res.json()
      setActivityHistory(data.notifications || [])
    }
    setLoadingActivity(false)
  }

  function buildText(b: Briefing, resp: Record<string, unknown>) {
    const labelMap = b.language === 'en-US' ? FIELD_LABELS_EN : FIELD_LABELS_PT
    const lines = [
      `BRIEFING — ${b.type_label.toUpperCase()}`,
      `Empresa: ${client?.company ?? '—'}`,
      `Contato: ${client?.name ?? '—'}`,
      `Email: ${client?.email ?? '—'}`,
      `WhatsApp: ${client?.phone ?? '—'}`,
      `Concluído: ${fmt(b.completed_at)}`,
      '', '─────────────────────────────────', '',
    ]
    Object.entries(resp).forEach(([k, v]) => {
      if (!v) return
      const label = labelMap[k] || k.replace(/_/g, ' ').toUpperCase()
      lines.push(label.toUpperCase(), Array.isArray(v) ? (v as string[]).join(', ') : String(v), '')
    })
    return lines.join('\n')
  }

  async function copyResponses() {
    if (!responses || !viewingResponses) return
    const b = briefings.find(br => br.slug === viewingResponses)
    if (!b) return
    await navigator.clipboard.writeText(buildText(b, responses))
    setCopiedResponses(true)
    toast('Respostas copiadas!', 'success', 2000)
    setTimeout(() => setCopiedResponses(false), 2000)
  }

  function exportPDF() {
    if (!responses || !viewingResponses) return
    const b = briefings.find(br => br.slug === viewingResponses)
    if (!b) return
    const fields = Object.entries(responses).filter(([, v]) => v)
    const html = `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"><style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:'Helvetica Neue',Arial,sans-serif;color:#111;padding:48px;max-width:800px;margin:0 auto}.hdr{display:flex;justify-content:space-between;align-items:flex-start;padding-bottom:24px;border-bottom:3px solid #12fea9;margin-bottom:32px}.logo{font-size:22px;font-weight:800;letter-spacing:-0.04em}.logo span{color:#12fea9;background:#111;padding:2px 8px;border-radius:4px}.badge{background:#111;color:#12fea9;font-size:10px;font-weight:700;padding:3px 10px;border-radius:999px;text-transform:uppercase;letter-spacing:.08em;margin-top:6px;display:inline-block}.cb{background:#f8f8f8;border-radius:12px;padding:20px 24px;margin-bottom:32px;display:grid;grid-template-columns:1fr 1fr;gap:12px}.cf label{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.1em;color:#888;display:block;margin-bottom:3px}.st{font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.1em;color:#888;margin-bottom:16px;padding-bottom:8px;border-bottom:1px solid #eee}.f{margin-bottom:18px}.fl{font-size:10px;font-weight:700;color:#555;text-transform:uppercase;letter-spacing:.07em;margin-bottom:5px}.fv{font-size:14px;color:#111;line-height:1.6;background:#f8f8f8;padding:10px 14px;border-radius:8px;border-left:3px solid #12fea9}.footer{margin-top:48px;padding-top:16px;border-top:1px solid #eee;font-size:11px;color:#aaa;text-align:center}</style></head><body><div class="hdr"><div><div class="logo"><span>Bnny</span> Labs</div></div><div style="text-align:right"><div style="font-size:17px;font-weight:700">${b.type_label}</div><div class="badge">${BRIEFING_STATUS_LABELS[b.status] ?? b.status}</div></div></div><div class="cb"><div class="cf"><label>Empresa</label><span style="font-size:15px;font-weight:700">${client?.company ?? '—'}</span></div><div class="cf"><label>Contato</label><span>${client?.name ?? '—'}</span></div><div class="cf"><label>Email</label><span>${client?.email ?? '—'}</span></div><div class="cf"><label>WhatsApp</label><span>${client?.phone ?? '—'}</span></div><div class="cf"><label>Concluído em</label><span>${fmt(b.completed_at)}</span></div></div><div class="st">Respostas do briefing</div>${fields.map(([k, v]) => `<div class="f"><div class="fl">${k.replace(/_/g, ' ')}</div><div class="fv">${Array.isArray(v) ? (v as string[]).join(', ') : String(v)}</div></div>`).join('')}<div class="footer">Gerado por Bnny Labs · briefing.bnnylabs.com · ${new Date().toLocaleDateString('pt-BR')}</div></body></html>`
    const win = window.open('', '_blank')
    if (win) { win.document.write(html); win.document.close(); setTimeout(() => win.print(), 500) }
  }

  function renderFileValue(value: unknown): ReactNode {
    if (!value) return null
    const renderCard = (f: FileEntry, i: number) => {
      const isImage = f.type?.startsWith('image/') || /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(f.name ?? '')
      const hasUrl = f.url?.startsWith('http')
      const sizeLabel = f.size ? `${(f.size / 1024).toFixed(0)}kb` : ''
      if (isImage && hasUrl) return (
        <div key={i}>
          <a href={f.url} target="_blank" rel="noopener noreferrer" className="block">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={f.url} alt={f.name} className="max-h-52 w-full max-w-full cursor-pointer rounded-lg bg-muted object-contain" />
          </a>
          <div className="mt-1 text-xs text-muted-foreground">{f.name}{sizeLabel ? ` · ${sizeLabel}` : ''}</div>
        </div>
      )
      if (hasUrl) return (
        <a key={i} href={f.url} target="_blank" rel="noopener noreferrer"
          className="flex items-center gap-2 rounded-lg border border-border bg-muted/40 px-3 py-2 text-foreground no-underline transition-colors hover:bg-muted">
          {f.type?.includes('pdf') ? <FileText className="h-5 w-5 shrink-0 text-muted-foreground" /> : <Paperclip className="h-5 w-5 shrink-0 text-muted-foreground" />}
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-semibold">{f.name}</div>
            {sizeLabel && <div className="text-xs text-muted-foreground">{sizeLabel}</div>}
          </div>
          <span className="flex shrink-0 items-center gap-1 text-xs text-primary"><ExternalLink className="h-3 w-3" /> Abrir</span>
        </a>
      )
      return (
        <div key={i} className="flex items-center gap-2 rounded-lg border border-border bg-muted/40 px-3 py-2 opacity-60">
          {isImage ? <ImageIcon className="h-5 w-5 shrink-0" /> : <Paperclip className="h-5 w-5 shrink-0" />}
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm">{f.name}</div>
            <div className="text-xs text-muted-foreground">{sizeLabel} · upload não concluído</div>
          </div>
        </div>
      )
    }
    if (Array.isArray(value)) return <div className="flex flex-col gap-2.5">{(value as FileEntry[]).map((f, i) => renderCard(f, i))}</div>
    const str = String(value)
    const isUrl = str.startsWith('http')
    return isUrl ? (
      <a href={str} target="_blank" rel="noopener noreferrer" className="break-all text-primary underline inline-flex items-center gap-1">
        <Paperclip className="h-3.5 w-3.5" />{str.split('/').pop()}
      </a>
    ) : <span className="text-sm text-muted-foreground inline-flex items-center gap-1"><Paperclip className="h-3.5 w-3.5" />{str}</span>
  }

  // ── Derived metrics ───────────────────────────────────────────────────

  const totalBriefings = briefings.length
  const concluded = briefings.filter(b => b.status === 'concluido')
  const completionRate = totalBriefings > 0 ? Math.round((concluded.length / totalBriefings) * 100) : 0
  const avgDays = concluded.length > 0
    ? Math.round(concluded.reduce((sum, b) => {
        if (!b.completed_at) return sum
        return sum + (new Date(b.completed_at).getTime() - new Date(b.created_at).getTime()) / 86400000
      }, 0) / concluded.length)
    : null
  const lastActivity = client?.last_activity_at ?? briefings[0]?.created_at ?? null

  // ── Social links from client ──────────────────────────────────────────

  const clientSocials = SOCIAL_NETWORKS
    .map(s => ({ ...s, url: (client as Record<string, unknown> | null)?.[`social_${s.key}`] as string ?? '' }))
    .filter(s => s.url)

  // ── Guards ────────────────────────────────────────────────────────────

  if (loading) return <div className="flex h-screen items-center justify-center"><div className="spinner" /></div>
  if (!client) return <div className="p-10 text-center text-muted-foreground">Cliente não encontrado</div>

  return (
    <div className="min-h-screen bg-background">
      <ToastContainer toasts={toasts} remove={remove} />

      <div className="mx-auto max-w-5xl p-6">
        {/* Breadcrumbs — sit above the hero header for navigation context.
            Replaces the previous standalone <ArrowLeft> back button: gives
            the user the same 'go back' affordance plus a clear sense of
            where they are in the hierarchy, and keeps the hero card
            visually flush with the rest of the page (no protruding icon
            button breaking the left edge alignment). */}
        <Breadcrumbs items={[
          { label: 'Clientes', href: '/admin/clientes' },
          { label: client.company },
        ]} />

        {/* ── Page header ─────────────────────────────────────────────── */}
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <AvatarUpload
              url={client.avatar_url}
              name={client.company}
              size={48}
              shape="rounded"
              uploadUrl={`/api/admin/clients/${id}/avatar`}
              deleteUrl={`/api/admin/clients/${id}/avatar`}
              onUploaded={(url) => setClient(c => c ? { ...c, avatar_url: url } : c)}
              onDeleted={() => setClient(c => c ? { ...c, avatar_url: null } : c)}
            />
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="truncate font-mono text-xl font-bold tracking-tight">{client.company}</h1>
                {/* Starred toggle */}
                <button type="button" onClick={toggleStarred} title={client.is_starred ? 'Remover dos favoritos' : 'Favoritar'}
                  className="rounded p-1 text-muted-foreground hover:text-foreground">
                  <Star size={16} className={cn(client.is_starred && 'fill-primary text-primary')} />
                </button>
                {/* Status badge — click to change */}
                <div className="relative">
                  <button type="button" onClick={() => setEditingStatus(e => !e)}
                    className={cn('inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[11px] font-medium transition-colors hover:opacity-80', STATUS_COLORS[client.status])}>
                    {STATUS_LABELS[client.status]}
                    <ChevronDown size={10} className={cn('transition-transform', editingStatus && 'rotate-180')} />
                  </button>
                  {editingStatus && (
                    <div className="absolute left-0 top-full z-10 mt-1 w-36 overflow-hidden rounded-lg border border-border bg-card shadow-lg">
                      {(Object.keys(STATUS_LABELS) as ClientStatus[]).map(s => (
                        <button key={s} type="button" onClick={() => setStatus(s)}
                          className={cn('flex w-full items-center gap-2 px-3 py-2 text-xs transition-colors hover:bg-muted', client.status === s && 'font-semibold')}>
                          <span className={cn('h-1.5 w-1.5 rounded-full border', STATUS_COLORS[s])} />
                          {STATUS_LABELS[s]}
                          {client.status === s && <Check size={10} className="ml-auto" />}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              <p className="text-xs text-muted-foreground">cliente desde {fmt(client.created_at).split(',')[0]}</p>
            </div>
          </div>
          <Button onClick={() => router.push(`/admin/novo?client_id=${id}`)} className="shrink-0">
            <Plus className="h-4 w-4" /> Novo briefing
          </Button>
        </div>

        {/* ── 2-column layout ─────────────────────────────────────────── */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_300px] lg:items-start">

          {/* ── Left column ───────────────────────────────────────────── */}
          <div className="flex flex-col gap-4">

            <AiProfileSection client={client} onSaved={load} />

            {/* Contacts card */}
            <Card className="p-5">
              <div className="mb-3 flex items-center gap-1.5 text-[15px] font-bold tracking-tight">
                <Users className="h-4 w-4 text-muted-foreground" />
                Contatos
              </div>
              <ContactsSection
                clientId={id} contacts={contacts} onUpdate={load}
                onError={msg => toast(msg, 'error')}
                onSuccess={msg => toast(msg, 'success', 2000)}
              />
            </Card>

            {/* Briefings */}
            <ClientBriefingsCard
              clientId={id}
              briefings={briefings}
              copiedSlug={copiedSlug}
              actionDone={actionDone}
              fmt={fmt}
              onViewResponses={viewResponses}
              onCopyLink={copyBriefingLink}
              onSendReminder={sendReminder}
              onResendEmail={resendEmail}
              onToggleLock={toggleLock}
              onViewActivity={viewActivity}
            />
            <Card className="p-5">
              <div className="mb-1 flex items-center gap-1.5 text-[15px] font-bold tracking-tight">
                <Briefcase className="h-4 w-4" /> Orçamentos
              </div>
              <div className="flex flex-col items-start gap-3 py-6">
                <p className="text-sm text-muted-foreground">
                  Crie e gerencie propostas comerciais para <span className="font-medium text-foreground">{client.company}</span>.
                </p>
                <button disabled
                  className="inline-flex cursor-not-allowed items-center gap-1.5 rounded-md border border-dashed border-border px-3 py-1.5 text-xs text-muted-foreground opacity-50">
                  <Plus size={12} /> Novo orçamento — em breve
                </button>
              </div>
            </Card>
          </div>

          {/* ── Right sidebar ─────────────────────────────────────────── */}
          <div className="flex flex-col gap-4 lg:sticky lg:top-6">

            {/* Quick info — segments, site, social. Compact version of
                what used to be the 'Informações' card on the left.
                Edit mode opens in-place: the same form fields, just
                rendered vertically since the sidebar is narrow. */}
            <Card className="p-4">
              <div className="mb-3 flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 text-sm font-semibold">
                  <Building2 className="h-4 w-4 text-muted-foreground" />
                  Sobre
                </div>
                <button
                  type="button"
                  onClick={() => setEditMode(!editMode)}
                  aria-label={editMode ? 'Cancelar edição' : 'Editar informações'}
                  className="rounded p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                >
                  {editMode ? <X size={13} /> : <Pencil size={13} />}
                </button>
              </div>

              {editMode ? (
                <div className="flex flex-col gap-3">
                  {[{ label: 'Empresa', key: 'company' },
                    { label: 'Site', key: 'website' }].map(f => (
                    <div key={f.key} className="space-y-1">
                      <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">{f.label}</Label>
                      <Input
                        value={editForm[f.key as keyof typeof editForm]}
                        onChange={e => setEditForm(p => ({ ...p, [f.key]: e.target.value }))}
                        className="h-8 text-xs"
                      />
                    </div>
                  ))}
                  <div className="space-y-1">
                    <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Redes sociais</Label>
                    <div className="space-y-1.5">
                      {SOCIAL_NETWORKS.map(s => (
                        <Input
                          key={s.key}
                          value={editSocials[s.key] ?? ''}
                          onChange={e => setEditSocials(p => ({ ...p, [s.key]: e.target.value }))}
                          placeholder={`${s.label} URL`}
                          className="h-7 text-xs"
                        />
                      ))}
                    </div>
                  </div>
                  <Button onClick={saveEdit} disabled={savingEdit} size="sm">
                    {savingEdit ? 'Salvando…' : <><Save className="mr-1 h-3.5 w-3.5" />Salvar</>}
                  </Button>
                </div>
              ) : (
                <div className="space-y-3.5">
                  {/* Segments */}
                  <div>
                    <div className="mb-1.5 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Segmentos</div>
                    <div className="flex flex-wrap items-center gap-1">
                      {client.tags.map(tag => (
                        <span key={tag} className="group inline-flex items-center gap-1 rounded-md border border-border bg-muted/60 px-1.5 py-0.5 text-[11px]">
                          {tag}
                          <button
                            type="button"
                            onClick={() => removeTag(tag)}
                            aria-label={`Remover tag ${tag}`}
                            className="opacity-0 transition-opacity group-hover:opacity-100"
                          >
                            <X size={9} />
                          </button>
                        </span>
                      ))}
                      {editingTags ? (
                        <div className="flex items-center gap-1">
                          <Input
                            value={newTag}
                            onChange={e => setNewTag(e.target.value)}
                            onKeyDown={e => { if (e.key === 'Enter') addTag(); if (e.key === 'Escape') setEditingTags(false) }}
                            placeholder="Novo…"
                            className="h-6 w-24 px-1.5 text-[11px]"
                            autoFocus
                          />
                          <button
                            type="button"
                            onClick={addTag}
                            aria-label="Adicionar tag"
                            className="rounded p-0.5 text-muted-foreground hover:text-foreground"
                          >
                            <Check size={11} />
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingTags(false)}
                            aria-label="Cancelar edição de tags"
                            className="rounded p-0.5 text-muted-foreground hover:text-foreground"
                          >
                            <X size={11} />
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setEditingTags(true)}
                          className="inline-flex items-center gap-0.5 rounded-md border border-dashed border-border px-1.5 py-0.5 text-[11px] text-muted-foreground hover:border-foreground/30 hover:text-foreground"
                        >
                          <Plus size={9} /> Segmento
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Site */}
                  {client.website && (
                    <div>
                      <div className="mb-1 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Site</div>
                      <a
                        href={client.website}
                        target="_blank"
                        rel="noopener noreferrer"
                        title={client.website}
                        className="inline-flex max-w-full items-center gap-1 truncate text-xs text-foreground underline decoration-muted-foreground/40 underline-offset-2 hover:decoration-foreground"
                      >
                        <span className="truncate">{client.website.replace(/^https?:\/\//, '').replace(/\/$/, '')}</span>
                        <ExternalLink size={10} className="shrink-0 text-muted-foreground/60" />
                      </a>
                    </div>
                  )}

                  {/* Social links */}
                  {clientSocials.length > 0 && (
                    <div>
                      <div className="mb-1.5 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Redes sociais</div>
                      <div className="flex flex-wrap gap-1.5">
                        {clientSocials.map(s => (
                          <a
                            key={s.key}
                            href={s.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            title={s.label}
                            aria-label={`${s.label} de ${client.company}`}
                            className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-border bg-muted/40 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                          >
                            <s.Icon size={13} />
                          </a>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </Card>

            {/* Metrics */}
            <Card className="p-4">
              <div className="mb-3 flex items-center gap-1.5 text-sm font-semibold">
                <BarChart2 className="h-4 w-4 text-muted-foreground" />
                Métricas
              </div>
              <div className="space-y-0.5">
                {[
                  { icon: <FileText size={12} />, label: 'Briefings', value: String(totalBriefings) },
                  { icon: <CheckCircle2 size={12} />, label: 'Concluídos', value: `${concluded.length} (${completionRate}%)` },
                  { icon: <Clock size={12} />, label: 'Tempo médio', value: avgDays !== null ? `${avgDays} dias` : '—' },
                  { icon: <Activity size={12} />, label: 'Última atividade', value: lastActivity ? relativeTime(lastActivity) : '—' },
                ].map(m => (
                  <div key={m.label} className="flex items-center justify-between border-b border-border/50 py-2 last:border-0">
                    <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <span className="text-muted-foreground/60">{m.icon}</span>
                      {m.label}
                    </span>
                    <span className="text-xs font-medium text-foreground">{m.value}</span>
                  </div>
                ))}
              </div>
            </Card>

            {/* Notes */}
            <Card className="p-4">
              <div className="mb-3 flex items-center gap-1.5 text-sm font-semibold">
                <StickyNote className="h-4 w-4 text-muted-foreground" />
                Notas internas
              </div>
              <NotesSection
                clientId={id} notes={notes} onUpdate={load}
                onError={msg => toast(msg, 'error')}
              />
            </Card>
          </div>
        </div>
      </div>

      {/* ── Responses modal (preserved exactly) ──────────────────────── */}
      <Dialog open={!!viewingResponses} onOpenChange={open => { if (!open) { setViewingResponses(null); setResponses(null) } }}>
        <DialogContent wide className="max-h-[90vh] gap-0 overflow-y-auto p-6">
          {(() => {
            const b = briefings.find(br => br.slug === viewingResponses)
            if (!b) return null
            return (
              <>
                <DialogHeader className="mb-5 border-b border-border/60 p-0 pb-4">
                  <DialogTitle>{client?.company}</DialogTitle>
                  <DialogDescription asChild>
                    <div className="mt-1.5 flex flex-wrap items-center gap-2">
                      <Badge variant="default" className="text-[10px] uppercase tracking-wider">{b.type_label}</Badge>
                      {client?.name && <span className="text-sm text-muted-foreground">{client.name}</span>}
                      {client?.email && <span className="text-sm text-muted-foreground">· {client.email}</span>}
                    </div>
                  </DialogDescription>
                  {b.completed_at && <div className="mt-1.5 text-xs text-muted-foreground">Concluído em {fmt(b.completed_at)}</div>}
                </DialogHeader>
                <div className="mb-5 flex gap-2">
                  <Button onClick={copyResponses} variant="outline" className="flex-1">
                    {copiedResponses ? <><ClipboardCheck size={14} />Copiado!</> : <><Clipboard size={14} />Copiar tudo</>}
                  </Button>
                  <Button onClick={exportPDF} variant="outline" className="flex-1">
                    <FileText size={14} /> Exportar PDF
                  </Button>
                </div>
                {responseVersions > 1 && responseDiff && (
                  <div className="mb-4">
                    <div className="flex gap-2">
                      <button onClick={() => setShowDiff(false)}
                        className={cn('inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg border py-2 text-xs transition-colors',
                          !showDiff ? 'border-foreground/20 bg-muted font-medium text-foreground' : 'border-border text-muted-foreground hover:bg-muted/40')}>
                        <ClipboardList size={12} /> Respostas atuais
                      </button>
                      <button onClick={() => setShowDiff(true)}
                        className={cn('inline-flex flex-1 items-center justify-center gap-2 rounded-lg border py-2 text-xs transition-colors',
                          showDiff ? 'border-foreground/20 bg-muted font-medium text-foreground' : 'border-border text-muted-foreground hover:bg-muted/40')}>
                        <Pencil size={12} /> Ver alterações
                        <span className="rounded-md border border-border bg-muted/60 px-1.5 py-0.5 text-[10px] font-bold text-foreground">{Object.keys(responseDiff).length}</span>
                      </button>
                    </div>
                    {showDiff && (
                      <div className="mt-3 flex flex-col gap-2">
                        {Object.keys(responseDiff).length === 0
                          ? <div className="py-8 text-center text-sm text-muted-foreground">Nenhuma alteração detectada</div>
                          : Object.entries(responseDiff).map(([key, { old: oldVal, new: newVal }]) => {
                              const labelMap = b.language === 'en-US' ? FIELD_LABELS_EN : FIELD_LABELS_PT
                              const label = labelMap[key] || key.replace(/_/g, ' ')
                              const oldStr = Array.isArray(oldVal) ? (oldVal as string[]).join(', ') : String(oldVal ?? '')
                              const newStr = Array.isArray(newVal) ? (newVal as string[]).join(', ') : String(newVal)
                              return (
                                <div key={key} className="overflow-hidden rounded-lg border border-border">
                                  <div className="border-b border-border bg-muted/40 px-3.5 py-2">
                                    <span className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider"><Pencil size={10} /> {label}</span>
                                  </div>
                                  <div className="flex flex-col gap-2 bg-card px-3.5 py-3">
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
                {loadingResponses ? (
                  <div className="py-10 text-center"><div className="spinner" /></div>
                ) : responses && !showDiff ? (
                  <ResponsesContent responses={responses} language={b.language} companyName={client?.company ?? 'briefing'}
                    renderFileValue={renderFileValue} labelMapPT={FIELD_LABELS_PT} labelMapEN={FIELD_LABELS_EN} />
                ) : !responses && !showDiff ? (
                  <div className="py-8 text-center text-sm text-muted-foreground">Sem respostas ainda</div>
                ) : null}
              </>
            )
          })()}
        </DialogContent>
      </Dialog>

      {pickerBriefing && client && (
        <RecipientPickerModal
          open={!!pickerBriefing}
          onClose={() => setPickerBriefing(null)}
          clientId={client.id}
          briefingLabel={pickerBriefing.type_label}
          briefingCompany={client.company}
          type={pickerType}
          onSubmit={submitPickerSend}
        />
      )}

      {/* ── ACTIVITY HISTORY MODAL ───────────────────────────────────── */}
      <ActivityHistoryModal
        briefingLabel={activityBriefing?.type_label ?? null}
        companyName={client?.company ?? ''}
        loading={loadingActivity}
        history={activityHistory}
        onClose={() => { setActivityBriefing(null); setActivityHistory([]) }}
      />
    </div>
  )
}
