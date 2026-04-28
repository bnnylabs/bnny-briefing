'use client'

import { useState, useEffect, useCallback, ReactNode } from 'react'
import { useRouter, useParams } from 'next/navigation'
import {
  Activity, ArrowLeft, ArrowRight, BarChart2, Bell, BellRing, Bot, Briefcase, Building2,
  Check, CheckCircle2, ChevronDown,
  Clipboard, ClipboardCheck, ClipboardList, Clock, Copy, Download, ExternalLink,
  Eye, FileText, Image as ImageIcon, Link as LinkIcon,
  Lock, Mail, MoreHorizontal, Paperclip, Pencil, Plus, RefreshCw, Save, Send,
  ScrollText, Sparkles, Star, StickyNote, Trash2, Unlock, Users, X,
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
const BRIEFING_STATUS_LABELS: Record<string, string> = {
  enviado: 'Enviado', visualizado: 'Visualizado', em_andamento: 'Em andamento', concluido: 'Concluído',
}

const AI_FIELDS = [
  { key: 'company_name', label: 'Nome da empresa' },
  { key: 'segment', label: 'Segmento / Nicho' },
  { key: 'target_audience', label: 'Público-alvo' },
  { key: 'brand_personality', label: 'Personalidade da marca' },
  { key: 'price_positioning', label: 'Posicionamento de preço' },
  { key: 'geographic_focus', label: 'Foco geográfico' },
  { key: 'tone_of_voice', label: 'Tom de voz' },
  { key: 'colors_hint', label: 'Direção de cores' },
  { key: 'description', label: 'Sobre a empresa', long: true },
  { key: 'key_features', label: 'Produtos / Serviços principais', long: true },
  { key: 'differentials', label: 'Diferenciais competitivos', long: true },
  { key: 'unique_value_proposition', label: 'Proposta de valor única', long: true },
  { key: 'extra_notes', label: 'Observações para design', long: true },
]

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

function BriefingStatusIcon({ status }: { status: string }) {
  const cls = 'h-3 w-3'
  switch (status) {
    case 'enviado': return <Send className={cls} />
    case 'visualizado': return <Eye className={cls} />
    case 'em_andamento': return <Clock className={cls} />
    case 'concluido': return <CheckCircle2 className={cls} />
    default: return null
  }
}

interface FileEntry { url: string; name: string; type?: string; size?: number }

// ─── ResponsesContent (preserved exactly) ────────────────────────────────

function ResponsesContent({
  responses, language, companyName, renderFileValue, labelMapPT, labelMapEN,
}: {
  responses: Record<string, unknown>; language?: string; companyName: string
  renderFileValue: (v: unknown) => ReactNode
  labelMapPT: Record<string, string>; labelMapEN: Record<string, string>
}) {
  const allFiles: FileEntry[] = []
  Object.values(responses).forEach(value => {
    if (Array.isArray(value)) {
      ;(value as FileEntry[]).forEach(f => { if (f?.name && f.url?.startsWith('http')) allFiles.push(f) })
    }
  })
  const imageFiles = allFiles.filter(f => f.type?.startsWith('image/') || /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(f.name))
  const otherFiles = allFiles.filter(f => !f.type?.startsWith('image/') && !/\.(jpg|jpeg|png|gif|webp|svg)$/i.test(f.name))
  const labelMap = language === 'en-US' ? labelMapEN : labelMapPT

  async function handleDownloadAll() {
    const { downloadAsZip } = await import('@/lib/download-zip')
    await downloadAsZip(allFiles, `${companyName} - arquivos.zip`)
  }

  return (
    <>
      {allFiles.length > 0 && (
        <Card className="mb-3 flex items-center gap-3 bg-muted/50 p-3">
          <Paperclip className="h-5 w-5 shrink-0 text-muted-foreground" />
          <div className="flex-1 min-w-0">
            <div className="text-sm font-semibold">
              {allFiles.length} {allFiles.length === 1 ? 'arquivo anexado' : 'arquivos anexados'}
              {imageFiles.length > 0 && (
                <span className="ml-2 text-xs font-normal text-muted-foreground">
                  · {imageFiles.length} {imageFiles.length === 1 ? 'imagem' : 'imagens'}
                  {otherFiles.length > 0 && `, ${otherFiles.length} ${otherFiles.length === 1 ? 'documento' : 'documentos'}`}
                </span>
              )}
            </div>
          </div>
          <Button size="sm" onClick={handleDownloadAll} className="shrink-0">
            <Download className="mr-1.5 h-3.5 w-3.5" /> Baixar ZIP
          </Button>
        </Card>
      )}
      <div className="flex flex-col gap-2">
        {Object.entries(responses).filter(([, v]) => v).map(([key, value]) => {
          const isFileField = /arquivo|logo|referencia|anexo|upload|files/i.test(key) ||
            (Array.isArray(value) && value.length > 0 && typeof value[0] === 'object' && value[0] !== null && 'url' in (value[0] as object))
          const displayValue = isFileField ? '' : Array.isArray(value) ? (value as string[]).join(', ') : String(value)
          const isShort = !isFileField && displayValue.length < 60
          return (
            <div key={key} className="overflow-hidden rounded-lg border border-border">
              <div className={cn('flex items-center justify-between gap-2 bg-muted/40 px-3.5 py-2', !(isShort && !isFileField) && 'border-b border-border')}>
                <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                  {isFileField && <Paperclip className="h-3 w-3" />}
                  {labelMap[key] || key.replace(/_/g, ' ')}
                </span>
                {isShort && !isFileField && <span className="text-sm font-semibold text-foreground">{displayValue}</span>}
              </div>
              {(!isShort || isFileField) && (
                <div className="bg-card px-3.5 py-3 text-sm leading-relaxed text-foreground">
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

  // AI
  const [analyzing, setAnalyzing] = useState(false)
  const [aiProfile, setAiProfile] = useState<Record<string, string>>({})
  const [editingAi, setEditingAi] = useState(false)
  const [savingAi, setSavingAi] = useState(false)
  const [aiExpanded, setAiExpanded] = useState(false)
  const [analyzeUrl, setAnalyzeUrl] = useState('')
  const [extraText, setExtraText] = useState('')
  const [detectedSocials, setDetectedSocials] = useState<SocialLinks>({})

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
      if (d.client.analysis) setAiProfile(d.client.analysis)
      if (d.client.website) setAnalyzeUrl(d.client.website)
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

  // ── AI ────────────────────────────────────────────────────────────────

  async function analyzeWithAI() {
    if (!analyzeUrl && !extraText && !client?.company) return
    setAnalyzing(true)
    try {
      const res = await fetch('/api/analyze', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ website: analyzeUrl || client?.website, text: extraText, company: client?.company }),
      })
      const data = await res.json()
      if (data.analysis) {
        setAiProfile(data.analysis)
        setEditingAi(true)
        setAiExpanded(true)
      }
      if (data.social_links) {
        setDetectedSocials(data.social_links)
      }
    } catch (e) { console.error(e) }
    setAnalyzing(false)
  }

  async function saveAiProfile() {
    setSavingAi(true)
    const socialPatch = Object.keys(detectedSocials).length > 0 ? {
      social_instagram: detectedSocials.instagram || client?.social_instagram || null,
      social_linkedin: detectedSocials.linkedin || client?.social_linkedin || null,
      social_facebook: detectedSocials.facebook || client?.social_facebook || null,
      social_youtube: detectedSocials.youtube || client?.social_youtube || null,
      social_tiktok: detectedSocials.tiktok || client?.social_tiktok || null,
      social_twitter: detectedSocials.twitter || client?.social_twitter || null,
      social_pinterest: detectedSocials.pinterest || client?.social_pinterest || null,
      social_other: detectedSocials.other || client?.social_other || null,
    } : {}

    // Auto-add segment from AI profile to client tags if not already present.
    // Normalises "Software House / Desenvolvimento de Produtos Digitais" →
    // ["Software House", "Desenvolvimento de Produtos Digitais"]
    const rawSegment = aiProfile.segment as string | undefined
    let tagsPatch: { tags?: string[] } = {}
    if (rawSegment && client) {
      const newSegments = rawSegment
        .split(',')
        .map(s => s.trim())
        .filter(s => s.length > 0 && s.length < 30)
      const existing = client.tags ?? []
      const toAdd = newSegments.filter(s => !existing.some(e => e.toLowerCase() === s.toLowerCase()))
      if (toAdd.length > 0) tagsPatch = { tags: [...existing, ...toAdd] }
    }

    await fetch(`/api/admin/clients/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ analysis: aiProfile, website: analyzeUrl || client?.website, ...socialPatch, ...tagsPatch }),
    })
    setSavingAi(false)
    setEditingAi(false)
    setDetectedSocials({})
    load()
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

  const hasAiProfile = Object.keys(aiProfile).length > 0

  return (
    <div className="min-h-screen bg-background">
      <ToastContainer toasts={toasts} remove={remove} />

      <div className="mx-auto max-w-5xl p-6">
        {/* ── Page header ─────────────────────────────────────────────── */}
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <IconButton icon={<ArrowLeft className="h-4 w-4" />} label="Voltar" size="icon" onClick={() => router.push('/admin/clientes')} />
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

            {/* Client info card */}
            <Card className="p-5">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div className="flex items-center gap-1.5 text-[15px] font-bold tracking-tight">
                  <Building2 className="h-4 w-4 text-muted-foreground" />
                  Informações
                </div>
                <Button variant={editMode ? 'secondary' : 'outline'} size="sm" onClick={() => setEditMode(!editMode)}>
                  {editMode ? <><X className="mr-1 h-3.5 w-3.5" />Cancelar</> : <><Pencil className="mr-1 h-3.5 w-3.5" />Editar</>}
                </Button>
              </div>

              {editMode ? (
                <div className="flex flex-col gap-4">
                  <div className="grid grid-cols-2 gap-3">
                    {[{ label: 'Empresa', key: 'company' },
                      { label: 'Site', key: 'website' }].map(f => (
                      <div key={f.key} className="col-span-2 space-y-1.5">
                        <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">{f.label}</Label>
                        <Input value={editForm[f.key as keyof typeof editForm]}
                          onChange={e => setEditForm(p => ({ ...p, [f.key]: e.target.value }))} />
                      </div>
                    ))}
                  </div>
                  {/* Social links in edit mode */}
                  <div>
                    <div className="mb-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Redes sociais</div>
                    <div className="grid grid-cols-2 gap-2">
                      {SOCIAL_NETWORKS.map(s => (
                        <div key={s.key} className="space-y-1">
                          <Label className="text-[10px] text-muted-foreground">{s.label}</Label>
                          <Input value={editSocials[s.key] ?? ''} onChange={e => setEditSocials(p => ({ ...p, [s.key]: e.target.value }))}
                            placeholder="https://..." className="h-7 text-xs" />
                        </div>
                      ))}
                    </div>
                  </div>
                  <Button onClick={saveEdit} disabled={savingEdit}>
                    {savingEdit ? 'Salvando...' : <><Save className="mr-1.5 h-4 w-4" />Salvar alterações</>}
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Segmentos */}
                  <div>
                    <div className="mb-1.5 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Segmentos</div>
                    <div className="flex flex-wrap items-center gap-1.5">
                      {client.tags.map(tag => (
                        <span key={tag} className="group inline-flex items-center gap-1 rounded-md border border-border bg-muted/60 px-2 py-0.5 text-[11px]">
                          {tag}
                          <button
                            type="button"
                            onClick={() => removeTag(tag)}
                            aria-label={`Remover tag ${tag}`}
                            className="opacity-0 transition-opacity group-hover:opacity-100"
                          >
                            <X size={10} />
                          </button>
                        </span>
                      ))}
                      {editingTags ? (
                        <div className="flex items-center gap-1.5">
                          <Input value={newTag} onChange={e => setNewTag(e.target.value)}
                            onKeyDown={e => { if (e.key === 'Enter') addTag(); if (e.key === 'Escape') setEditingTags(false) }}
                            placeholder="Novo segmento…" className="h-6 w-36 px-2 text-xs" autoFocus />
                          <button
                            type="button"
                            onClick={addTag}
                            aria-label="Adicionar tag"
                            className="rounded p-0.5 text-muted-foreground hover:text-foreground"
                          >
                            <Check size={12} />
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingTags(false)}
                            aria-label="Cancelar edição de tags"
                            className="rounded p-0.5 text-muted-foreground hover:text-foreground"
                          >
                            <X size={12} />
                          </button>
                        </div>
                      ) : (
                        <button type="button" onClick={() => setEditingTags(true)}
                          className="inline-flex items-center gap-1 rounded-md border border-dashed border-border px-2 py-0.5 text-xs text-muted-foreground hover:border-foreground/30 hover:text-foreground">
                          <Plus size={10} /> Segmento
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Site */}
                  {client.website && (
                    <div>
                      <div className="mb-1 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Site</div>
                      <a href={client.website} target="_blank" rel="noopener noreferrer"
                        title={client.website}
                        className="inline-flex max-w-full items-center gap-1 truncate text-sm text-foreground underline decoration-muted-foreground/40 underline-offset-2 hover:decoration-foreground">
                        <span className="truncate">{client.website}</span>
                        <ExternalLink size={11} className="shrink-0 text-muted-foreground/60" />
                      </a>
                    </div>
                  )}

                  {/* Social links */}
                  {clientSocials.length > 0 && (
                    <div>
                      <div className="mb-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Redes sociais</div>
                      <div className="flex flex-wrap gap-2">
                        {clientSocials.map(s => (
                          <a key={s.key} href={s.url} target="_blank" rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 rounded-md border border-border bg-muted/40 px-2.5 py-1 text-xs text-foreground transition-colors hover:bg-muted">
                            <s.Icon size={12} />
                            {s.label}
                            <ExternalLink size={10} className="text-muted-foreground/60" />
                          </a>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </Card>

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

            {/* AI Profile card */}
            <Card className={cn('p-5', hasAiProfile && 'border-primary/30')}>
              <div
                className={cn('flex items-center justify-between gap-3', hasAiProfile && 'cursor-pointer')}
                onClick={() => hasAiProfile && setAiExpanded(e => !e)}
              >
                <div className="flex items-center gap-2 text-[15px] font-bold tracking-tight">
                  <Bot className="h-4 w-4 text-muted-foreground" strokeWidth={1.75} />
                  Perfil de IA
                  {hasAiProfile && (
                    <span className="inline-flex items-center gap-1 rounded-md border border-success/30 bg-success/10 px-2 py-0.5 text-[11px] font-medium text-success">
                      <Check size={10} /> Salvo
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {hasAiProfile && !editingAi && (
                    <Button variant="outline" size="sm" onClick={e => { e.stopPropagation(); setEditingAi(true); setAiExpanded(true) }}>
                      <Pencil className="mr-1 h-3.5 w-3.5" /> Editar
                    </Button>
                  )}
                  {hasAiProfile && <ChevronDown className={cn('h-5 w-5 text-muted-foreground transition-transform', aiExpanded && 'rotate-180')} />}
                </div>
              </div>

              {/* Mini-summary — only when collapsed */}
              {hasAiProfile && !aiExpanded && (
                <div className="mt-2 space-y-0.5">
                  {['segment', 'tone_of_voice', 'brand_personality', 'price_positioning']
                    .filter(k => aiProfile[k])
                    .map(k => (
                      <div key={k} className="flex items-baseline gap-1.5 text-xs">
                        <span className="shrink-0 text-muted-foreground">{AI_FIELDS.find(f => f.key === k)?.label}:</span>
                        <span className="truncate text-foreground">{String(aiProfile[k])}</span>
                      </div>
                    ))}
                </div>
              )}

              {/* Subtitle */}
              {!hasAiProfile && (
                <p className="mt-1 text-xs text-muted-foreground">Analise o site ou preencha manualmente</p>
              )}
              {hasAiProfile && aiExpanded && (
                <p className="mt-1 text-xs text-muted-foreground">Clique para recolher</p>
              )}

              <div className={cn(hasAiProfile && 'mt-4')}>
              {(!hasAiProfile || aiExpanded) && (
                <div>
                  <div className={cn('rounded-lg bg-muted/40 p-4', hasAiProfile && 'mb-4')}>
                    <div className="flex flex-col gap-2">
                      <Input value={analyzeUrl} onChange={e => setAnalyzeUrl(e.target.value)} placeholder="URL do site (opcional)" />
                      <textarea value={extraText} onChange={e => setExtraText(e.target.value)}
                        placeholder="Informações extras sobre o cliente (opcional)"
                        className="min-h-[64px] w-full resize-y rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" />
                      <Button onClick={analyzeWithAI} disabled={analyzing}>
                        {analyzing ? <><Clock className="mr-1.5 h-4 w-4 animate-spin" />Analisando com IA...</>
                          : hasAiProfile ? <><RefreshCw className="mr-1.5 h-4 w-4" />Re-analisar com IA</>
                          : <><Sparkles className="mr-1.5 h-4 w-4" />Analisar com IA</>}
                      </Button>
                    </div>
                  </div>

                  {/* Detected socials banner */}
                  {Object.keys(detectedSocials).length > 0 && (
                    <div className="mb-3 flex flex-wrap items-center gap-2 rounded-lg border border-primary/30 bg-primary/10 px-3 py-2">
                      <span className="text-xs font-medium text-primary">Redes detectadas:</span>
                      {Object.entries(detectedSocials).map(([k, v]) => v ? (
                        <a key={k} href={v} target="_blank" rel="noopener noreferrer"
                          className="text-xs text-primary underline underline-offset-2 hover:text-primary capitalize">{k}</a>
                      ) : null)}
                      <span className="text-[11px] text-muted-foreground ml-auto">Serão salvas ao salvar o perfil</span>
                    </div>
                  )}

                  {hasAiProfile && (
                    <div className="overflow-hidden rounded-lg border border-border bg-card">
                      {(() => {
                        const short = AI_FIELDS.filter(f => !f.long && (editingAi || aiProfile[f.key]))
                        return short.length > 0 ? (
                          <div className="grid grid-cols-1 gap-x-6 gap-y-4 border-b border-border/60 bg-muted/20 p-4 sm:grid-cols-2">
                            {short.map(f => (
                              <div key={f.key} className="min-w-0">
                                <div className="mb-1 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{f.label}</div>
                                {editingAi
                                  ? <input type="text" value={aiProfile[f.key] ?? ''} onChange={e => setAiProfile(p => ({ ...p, [f.key]: e.target.value }))}
                                      className="block w-full rounded-md border border-input bg-background px-2.5 py-1.5 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring" />
                                  : <div className="break-words text-sm leading-relaxed">{String(aiProfile[f.key] ?? '—')}</div>}
                              </div>
                            ))}
                          </div>
                        ) : null
                      })()}
                      {(() => {
                        const long = AI_FIELDS.filter(f => f.long && (editingAi || aiProfile[f.key]))
                        return long.length > 0 ? (
                          <div className="divide-y divide-border/60">
                            {long.map(f => (
                              <div key={f.key} className="p-4">
                                <div className="mb-1.5 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{f.label}</div>
                                {editingAi
                                  ? <textarea value={aiProfile[f.key] ?? ''} onChange={e => setAiProfile(p => ({ ...p, [f.key]: e.target.value }))}
                                      className="block min-h-[72px] w-full resize-y rounded-md border border-input bg-background px-3 py-2 text-sm leading-relaxed outline-none focus-visible:ring-2 focus-visible:ring-ring" />
                                  : <div className="whitespace-pre-wrap break-words text-sm leading-relaxed">{String(aiProfile[f.key])}</div>}
                              </div>
                            ))}
                          </div>
                        ) : null
                      })()}
                      {editingAi && (
                        <div className="flex gap-2 border-t border-border/60 bg-muted/20 px-4 py-3">
                          <Button variant="outline" onClick={() => { setEditingAi(false); if (client.analysis) setAiProfile(client.analysis as Record<string, string>) }} className="flex-1">
                            Cancelar
                          </Button>
                          <Button onClick={saveAiProfile} disabled={savingAi} className="flex-1">
                            {savingAi ? 'Salvando…' : <><Save className="mr-1.5 h-4 w-4" />Salvar</>}
                          </Button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
              </div>
            </Card>

            {/* Briefings */}
            <Card className="p-5">
              <div className="mb-4 flex items-center gap-1.5 text-[15px] font-bold tracking-tight">
                <ClipboardList className="h-4 w-4" /> Briefings
                <span className="ml-1 text-xs font-normal text-muted-foreground">{briefings.length} no histórico</span>
              </div>
              {briefings.length === 0 ? (
                <div className="flex flex-col items-center gap-3 py-8 text-center">
                  <ClipboardList className="h-8 w-8 text-muted-foreground/40" strokeWidth={1.5} />
                  <div className="text-sm text-muted-foreground">Nenhum briefing ainda</div>
                  <Button variant="outline" size="sm" onClick={() => router.push(`/admin/novo?client_id=${id}`)}>
                    <Plus size={13} /> Criar o primeiro
                  </Button>
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  {briefings.map(b => (
                    <div key={b.id} className="rounded-lg border border-border bg-muted/30 px-3.5 py-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <div className="mb-1.5 text-sm font-semibold">{b.type_label}</div>
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className={cn('inline-flex items-center gap-1 whitespace-nowrap rounded-md border px-2 py-0.5 text-[11px] font-medium',
                              b.status === 'concluido' && 'border-success/30 bg-success/10 text-success',
                              b.status === 'em_andamento' && 'border-warning/30 bg-warning/10 text-warning',
                              b.status === 'visualizado' && 'border-info/30 bg-info/10 text-info',
                              b.status === 'enviado' && 'border-border bg-muted/60 text-muted-foreground',
                            )}>
                              <BriefingStatusIcon status={b.status} />
                              {BRIEFING_STATUS_LABELS[b.status]}
                            </span>
                            <span className="whitespace-nowrap text-xs text-muted-foreground">{fmt(b.created_at)}</span>
                            {b.completed_at && <span className="whitespace-nowrap text-xs text-muted-foreground">· concluído {fmt(b.completed_at)}</span>}
                            {(b.recipients?.length ?? 0) > 0 && (
                              <TooltipProvider delayDuration={200}>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <span className="inline-flex cursor-default items-center gap-1 rounded-md border border-border bg-muted/60 px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                                      <Send size={9} />
                                      {b.recipients!.length}
                                    </span>
                                  </TooltipTrigger>
                                  <TooltipContent
                                    side="bottom"
                                    className="bg-popover text-popover-foreground border border-border p-0 shadow-md"
                                  >
                                    <div className="min-w-44 p-3">
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
                                    </div>
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            )}
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-1.5">
                          {b.status === 'concluido' && (
                            <Button size="sm" onClick={() => viewResponses(b.slug)}>
                              <Eye size={13} />
                              Ver respostas
                            </Button>
                          )}
                          <IconButton
                            icon={copiedSlug === b.slug ? <Check className="h-4 w-4 text-success" /> : <LinkIcon className="h-4 w-4" />}
                            label="Copiar link" size="icon"
                            onClick={() => copyBriefingLink(b.slug)}
                          />
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <button
                                type="button"
                                aria-label="Mais ações"
                                className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                              >
                                <MoreHorizontal size={15} />
                              </button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-52">
                              {b.status !== 'concluido' && (
                                <>
                                  <DropdownMenuItem onClick={() => resendEmail(b.slug)}>
                                    {actionDone === b.slug + '_resend' ? <Check size={14} className="text-success" /> : <Mail size={14} />}
                                    Reenviar email…
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => sendReminder(b.slug)}>
                                    {actionDone === b.slug + '_reminder' ? <Check size={14} className="text-success" /> : <BellRing size={14} />}
                                    Enviar lembrete…
                                  </DropdownMenuItem>
                                  <DropdownMenuSeparator />
                                </>
                              )}
                              {b.status === 'concluido' && (
                                <>
                                  <DropdownMenuItem onClick={() => toggleLock(b.slug, !!b.editing_locked)}>
                                    {b.editing_locked ? <Unlock size={14} /> : <Lock size={14} />}
                                    {b.editing_locked ? 'Liberar edição' : 'Bloquear edição'}
                                  </DropdownMenuItem>
                                  <DropdownMenuSeparator />
                                </>
                              )}
                              <DropdownMenuItem onClick={() => router.push(`/admin/novo?client_id=${id}&duplicate=${b.slug}`)}>
                                <Copy size={14} />
                                Duplicar briefing
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem onClick={() => viewActivity(b)}>
                                <ScrollText size={14} />
                                Histórico de atividades
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>

            {/* Orçamentos — placeholder */}
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
      {activityBriefing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-in fade-in-0 duration-150"
          onClick={() => { setActivityBriefing(null); setActivityHistory([]) }}>
          <div className="relative w-full max-w-md rounded-xl bg-card border border-border p-6 shadow-2xl animate-in fade-in-0 zoom-in-95 slide-in-from-bottom-1 duration-200 max-h-[88vh] overflow-y-auto"
            onClick={e => e.stopPropagation()}>
            <button
              onClick={() => { setActivityBriefing(null); setActivityHistory([]) }}
              aria-label="Fechar histórico"
              className="absolute right-3.5 top-3.5 flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <X size={15} />
            </button>
            <div className="mb-5">
              <div className="font-bold text-lg tracking-tight">Histórico de atividades</div>
              <div className="text-sm text-muted-foreground mt-0.5">{client?.company} · {activityBriefing.type_label}</div>
            </div>
            {loadingActivity ? (
              <div className="py-8 text-center text-sm text-muted-foreground">Carregando…</div>
            ) : activityHistory.length === 0 ? (
              <div className="py-8 text-center text-sm text-muted-foreground">Nenhuma atividade registrada</div>
            ) : (
              <div className="flex flex-col gap-2">
                {activityHistory.map((n, i) => {
                  const isClientEvent = ['link_opened', 'form_started', 'form_submitted'].includes(n.type)
                  const lblMap: Record<string, { icon: React.ReactNode; label: string }> = {
                    email_client:   { icon: <Send size={13} />,                                    label: 'Email enviado' },
                    email_admin:    { icon: <Mail size={13} />,                                    label: 'Notificação ao admin' },
                    reminder:       { icon: <Bell size={13} />,                                    label: 'Lembrete enviado' },
                    resend:         { icon: <RefreshCw size={13} />,                               label: 'Reenvio' },
                    link_opened:    { icon: <Eye size={13} className="text-info" />,               label: 'Link acessado' },
                    form_started:   { icon: <Clock size={13} className="text-warning" />,          label: 'Preenchimento iniciado' },
                    form_submitted: { icon: <CheckCircle2 size={13} className="text-success" />,   label: 'Briefing concluído' },
                  }
                  const entry = lblMap[n.type] || { icon: <Bell size={13} />, label: n.type }
                  return (
                    <div key={i} className={`rounded-lg border px-4 py-3 ${isClientEvent ? 'border-border bg-card' : 'border-border bg-muted/30'}`}>
                      <div className="flex items-center justify-between">
                        <span className="inline-flex items-center gap-1.5 text-sm font-medium">{entry.icon} {entry.label}</span>
                        {!isClientEvent && (
                          <span className={`inline-flex items-center gap-1 text-xs font-medium ${n.status === 'sent' ? 'text-success' : 'text-destructive'}`}>
                            {n.status === 'sent' ? <><Check size={12} /> Entregue</> : <><Trash2 size={12} /> Falhou</>}
                          </span>
                        )}
                      </div>
                      {n.details?.to && (
                        <div className="mt-1.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                          {n.details.role === 'cc' && <span className="rounded-md border border-border bg-muted/60 px-1.5 py-0.5 text-[10px] font-medium">CC</span>}
                          {n.details.role === 'primary' && <span className="rounded-md border border-success/30 bg-success/10 px-1.5 py-0.5 text-[10px] font-medium text-success">Principal</span>}
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
          </div>
        </div>
      )}
    </div>
  )
}
