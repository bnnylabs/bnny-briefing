'use client'

import { useState, useEffect, useCallback, ReactNode } from 'react'
import { useRouter, useParams } from 'next/navigation'
import {
  ArrowLeft,
  Bot,
  CheckCircle2,
  ChevronDown,
  Clipboard,
  ClipboardCheck,
  ClipboardList,
  Clock,
  Download,
  ExternalLink,
  Eye,
  FileText,
  Image as ImageIcon,
  Link as LinkIcon,
  Lock,
  Paperclip,
  Pencil,
  Plus,
  RefreshCw,
  Save,
  Send,
  Sparkles,
  Unlock,
  X,
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

import { useToast, ToastContainer } from '@/components/toast'
import { FIELD_LABELS_PT, FIELD_LABELS_EN } from '@/lib/briefing-types'
import { cn } from '@/lib/utils'

interface Contact {
  name: string
  email: string
  phone?: string
  role?: string
  is_primary?: boolean
}
interface Client {
  id: string
  name: string
  company: string
  email: string
  phone: string
  website: string | null
  analysis: Record<string, unknown> | null
  created_at: string
  contacts?: Contact[]
}
interface Briefing {
  id: string
  slug: string
  type: string
  type_label: string
  status: string
  language?: string
  created_at: string
  completed_at: string | null
  internal_notes: string | null
  editing_locked?: boolean
  editing_expires_at?: string | null
  update_count?: number
}

const STATUS_LABELS: Record<string, string> = {
  enviado: 'Enviado',
  visualizado: 'Visualizado',
  em_andamento: 'Em andamento',
  concluido: 'Concluído',
}

function StatusIcon({ status }: { status: string }) {
  const className = 'h-3 w-3'
  switch (status) {
    case 'enviado':
      return <Send className={className} />
    case 'visualizado':
      return <Eye className={className} />
    case 'em_andamento':
      return <Clock className={className} />
    case 'concluido':
      return <CheckCircle2 className={className} />
    default:
      return null
  }
}

const AI_FIELDS = [
  { key: 'company_name', label: 'Nome da empresa' },
  { key: 'segment', label: 'Segmento / Nicho' },
  { key: 'description', label: 'Sobre a empresa' },
  { key: 'key_features', label: 'Produtos / Serviços principais' },
  { key: 'differentials', label: 'Diferenciais competitivos' },
  { key: 'unique_value_proposition', label: 'Proposta de valor única' },
  { key: 'target_audience', label: 'Público-alvo' },
  { key: 'brand_personality', label: 'Personalidade da marca' },
  { key: 'price_positioning', label: 'Posicionamento de preço' },
  { key: 'geographic_focus', label: 'Foco geográfico' },
  { key: 'tone_of_voice', label: 'Tom de voz' },
  { key: 'colors_hint', label: 'Direção de cores' },
  { key: 'extra_notes', label: 'Observações para design' },
]

function fmt(d: string | null) {
  if (!d) return '—'
  return new Date(d).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

interface FileEntry3 {
  url: string
  name: string
  type?: string
  size?: number
}

function ResponsesContent2({
  responses,
  language,
  companyName,
  renderFileValue,
  labelMapPT,
  labelMapEN,
}: {
  responses: Record<string, unknown>
  language?: string
  companyName: string
  renderFileValue: (v: unknown) => React.ReactNode
  labelMapPT: Record<string, string>
  labelMapEN: Record<string, string>
}) {
  const allFiles: FileEntry3[] = []
  Object.entries(responses).forEach(([, value]) => {
    if (Array.isArray(value)) {
      ;(value as FileEntry3[]).forEach((f) => {
        if (f && f.name && f.url?.startsWith('http')) allFiles.push(f)
      })
    }
  })
  const imageFiles = allFiles.filter(
    (f) =>
      f.type?.startsWith('image/') ||
      /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(f.name || ''),
  )
  const otherFiles = allFiles.filter(
    (f) =>
      !f.type?.startsWith('image/') &&
      !/\.(jpg|jpeg|png|gif|webp|svg)$/i.test(f.name || ''),
  )
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
              {allFiles.length}{' '}
              {allFiles.length === 1 ? 'arquivo anexado' : 'arquivos anexados'}
              {imageFiles.length > 0 && (
                <span className="ml-2 text-xs font-normal text-muted-foreground">
                  · {imageFiles.length}{' '}
                  {imageFiles.length === 1 ? 'imagem' : 'imagens'}
                  {otherFiles.length > 0 &&
                    `, ${otherFiles.length} ${otherFiles.length === 1 ? 'documento' : 'documentos'}`}
                </span>
              )}
            </div>
            <div className="mt-0.5 truncate text-xs text-muted-foreground">
              {allFiles.map((f) => f.name).join(', ')}
            </div>
          </div>
          <Button size="sm" onClick={handleDownloadAll} className="shrink-0">
            <Download className="mr-1.5 h-3.5 w-3.5" />
            Baixar ZIP
          </Button>
        </Card>
      )}
      <div className="flex flex-col gap-2">
        {Object.entries(responses)
          .filter(([, v]) => v)
          .map(([key, value]) => {
            const isFileField =
              /arquivo|logo|referencia|anexo|upload|files/i.test(key) ||
              (Array.isArray(value) &&
                value.length > 0 &&
                typeof value[0] === 'object' &&
                value[0] !== null &&
                'url' in (value[0] as object))
            const displayValue = isFileField
              ? ''
              : Array.isArray(value)
                ? (value as string[]).join(', ')
                : String(value)
            const isShort = !isFileField && displayValue.length < 60
            return (
              <div
                key={key}
                className="overflow-hidden rounded-lg border border-border"
              >
                <div
                  className={cn(
                    'flex items-center justify-between gap-2 bg-muted/40 px-3.5 py-2',
                    !(isShort && !isFileField) && 'border-b border-border',
                  )}
                >
                  <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                    {isFileField && <Paperclip className="h-3 w-3" />}
                    {labelMap[key] || key.replace(/_/g, ' ')}
                  </span>
                  {isShort && !isFileField && (
                    <span className="text-sm font-semibold text-foreground">
                      {displayValue}
                    </span>
                  )}
                </div>
                {(!isShort || isFileField) && (
                  <div className="bg-card px-3.5 py-3 text-sm leading-relaxed text-foreground">
                    {isFileField ? (
                      renderFileValue(value)
                    ) : (
                      <span className="whitespace-pre-wrap">
                        {displayValue}
                      </span>
                    )}
                  </div>
                )}
              </div>
            )
          })}
      </div>
    </>
  )
}

export default function ClientePerfilPage() {
  const router = useRouter()
  const params = useParams()
  const id = params.id as string

  const [client, setClient] = useState<Client | null>(null)
  const [briefings, setBriefings] = useState<Briefing[]>([])
  const [loading, setLoading] = useState(true)
  const [editMode, setEditMode] = useState(false)
  const [editForm, setEditForm] = useState({
    name: '',
    company: '',
    email: '',
    phone: '',
    website: '',
  })
  const [savingEdit, setSavingEdit] = useState(false)

  // AI Analysis
  const [analyzing, setAnalyzing] = useState(false)
  const [aiProfile, setAiProfile] = useState<Record<string, string>>({})
  const [editingAi, setEditingAi] = useState(false)
  const [savingAi, setSavingAi] = useState(false)
  const [viewingResponses, setViewingResponses] = useState<string | null>(null)
  const [responses, setResponses] = useState<Record<string, unknown> | null>(
    null,
  )
  const [responseDiff2, setResponseDiff2] = useState<Record<
    string,
    { old: unknown; new: unknown }
  > | null>(null)
  const [responseVersions2, setResponseVersions2] = useState(0)
  const [showDiff2, setShowDiff2] = useState(false)
  const [loadingResponses, setLoadingResponses] = useState(false)
  const [copiedResponses, setCopiedResponses] = useState(false)
  const { toasts, toast, remove } = useToast()
  const [aiExpanded, setAiExpanded] = useState(false)
  const [analyzeUrl, setAnalyzeUrl] = useState('')
  const [extraText, setExtraText] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    const res = await fetch(`/api/admin/clients/${id}`)
    if (res.ok) {
      const d = await res.json()
      setClient(d.client)
      setBriefings(d.briefings || [])
      if (d.client.analysis) setAiProfile(d.client.analysis)
      if (d.client.website) setAnalyzeUrl(d.client.website)
      setEditForm({
        name: d.client.name || '',
        company: d.client.company || '',
        email: d.client.email || '',
        phone: d.client.phone || '',
        website: d.client.website || '',
      })
    } else if (res.status === 401) {
      router.push('/admin')
    }
    setLoading(false)
  }, [id, router])

  useEffect(() => {
    load()
  }, [load])

  async function saveEdit() {
    setSavingEdit(true)
    await fetch(`/api/admin/clients/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(editForm),
    })
    setSavingEdit(false)
    setEditMode(false)
    load()
  }

  async function analyzeWithAI() {
    if (!analyzeUrl && !extraText && !client?.company) return
    setAnalyzing(true)
    try {
      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          website: analyzeUrl || client?.website,
          text: extraText,
          company: client?.company,
        }),
      })
      const data = await res.json()
      if (data.analysis) {
        setAiProfile(data.analysis)
        setEditingAi(true)
      }
    } catch (e) {
      console.error(e)
    }
    setAnalyzing(false)
  }

  async function saveAiProfile() {
    setSavingAi(true)
    await fetch(`/api/admin/clients/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        analysis: aiProfile,
        website: analyzeUrl || client?.website,
      }),
    })
    setSavingAi(false)
    setEditingAi(false)
    load()
  }

  function renderFileValue(value: unknown): ReactNode {
    if (!value) return null

    const renderCard = (
      f: { url: string; name: string; size?: number; type?: string },
      i: number,
    ) => {
      const isImage =
        f.type?.startsWith('image/') ||
        /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(f.name || '')
      const hasUrl = f.url && f.url.startsWith('http')
      const sizeLabel = f.size ? `${(f.size / 1024).toFixed(0)}kb` : ''
      if (isImage && hasUrl)
        return (
          <div key={i}>
            <a
              href={f.url}
              target="_blank"
              rel="noopener noreferrer"
              className="block"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={f.url}
                alt={f.name}
                className="max-h-52 w-full max-w-full cursor-pointer rounded-lg bg-muted object-contain"
              />
            </a>
            <div className="mt-1 text-xs text-muted-foreground">
              {f.name}
              {sizeLabel ? ` · ${sizeLabel}` : ''}
            </div>
          </div>
        )
      if (hasUrl)
        return (
          <a
            key={i}
            href={f.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 rounded-lg border border-border bg-muted/40 px-3 py-2 text-foreground no-underline transition-colors hover:bg-muted"
          >
            {f.type?.includes('pdf') ? (
              <FileText className="h-5 w-5 shrink-0 text-muted-foreground" />
            ) : (
              <Paperclip className="h-5 w-5 shrink-0 text-muted-foreground" />
            )}
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-semibold">{f.name}</div>
              {sizeLabel && (
                <div className="text-xs text-muted-foreground">
                  {sizeLabel}
                </div>
              )}
            </div>
            <span className="flex shrink-0 items-center gap-1 text-xs text-primary">
              <ExternalLink className="h-3 w-3" /> Abrir
            </span>
          </a>
        )
      return (
        <div
          key={i}
          className="flex items-center gap-2 rounded-lg border border-border bg-muted/40 px-3 py-2 opacity-60"
        >
          {isImage ? (
            <ImageIcon className="h-5 w-5 shrink-0" />
          ) : (
            <Paperclip className="h-5 w-5 shrink-0" />
          )}
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm">{f.name}</div>
            <div className="text-xs text-muted-foreground">
              {sizeLabel} · upload não concluído
            </div>
          </div>
        </div>
      )
    }

    if (Array.isArray(value))
      return (
        <div className="flex flex-col gap-2.5">
          {(
            value as { url: string; name: string; size?: number; type?: string }[]
          ).map((f, i) => renderCard(f, i))}
        </div>
      )

    const str = String(value)
    const isUrl = str.startsWith('http')
    return isUrl ? (
      <a
        href={str}
        target="_blank"
        rel="noopener noreferrer"
        className="break-all text-primary underline inline-flex items-center gap-1"
      >
        <Paperclip className="h-3.5 w-3.5" />
        {str.split('/').pop()}
      </a>
    ) : (
      <span className="text-sm text-muted-foreground inline-flex items-center gap-1">
        <Paperclip className="h-3.5 w-3.5" />
        {str}
      </span>
    )
  }

  async function viewResponses(slug: string) {
    setViewingResponses(slug)
    setLoadingResponses(true)
    setShowDiff2(false)
    const res = await fetch(`/api/briefings/${slug}/responses`)
    if (res.ok) {
      const d = await res.json()
      setResponses(d.answers || {})
      setResponseDiff2(d.diff || null)
      setResponseVersions2(d.versions || 1)
    }
    setLoadingResponses(false)
  }

  async function copyResponses(briefingTitle: string) {
    if (!responses) return
    const lines = [
      `BRIEFING — ${briefingTitle}`,
      `Empresa: ${client?.company}`,
      '',
    ]
    Object.entries(responses)
      .filter(([, v]) => v)
      .forEach(([k, v]) => {
        const bLang = briefings.find(
          (b) => b.slug === viewingResponses,
        )?.language
        const label =
          (bLang === 'en-US' ? FIELD_LABELS_EN : FIELD_LABELS_PT)[k] ||
          k.replace(/_/g, ' ').toUpperCase()
        lines.push(label.toUpperCase())
        lines.push(Array.isArray(v) ? (v as string[]).join(', ') : String(v))
        lines.push('')
      })
    await navigator.clipboard.writeText(lines.join('\n'))
    setCopiedResponses(true)
    toast('Respostas copiadas!', 'success', 2000)
    setTimeout(() => setCopiedResponses(false), 2000)
  }

  async function toggleLock(briefingSlug: string, currentLocked: boolean) {
    await fetch(`/api/briefings/${briefingSlug}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ editing_locked: !currentLocked }),
    })
    setBriefings((prev) =>
      prev.map((b) =>
        b.slug === briefingSlug
          ? { ...b, editing_locked: !currentLocked }
          : b,
      ),
    )
    toast(
      !currentLocked ? 'Edição bloqueada' : 'Edição liberada',
      'success',
    )
  }

  function newBriefing() {
    router.push(`/admin/novo?client_id=${id}`)
  }

  if (loading)
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="spinner" />
      </div>
    )
  if (!client)
    return (
      <div className="p-10 text-center text-muted-foreground">
        Cliente não encontrado
      </div>
    )

  const hasAiProfile = Object.keys(aiProfile).length > 0

  return (
    <div className="min-h-screen bg-background">
      <ToastContainer toasts={toasts} remove={remove} />

      <div className="mx-auto flex max-w-5xl flex-col gap-4 p-6">
        {/* Page header */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => router.push('/admin/clientes')}
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <h1 className="truncate font-mono text-xl font-bold tracking-tight">
              {client.company}
            </h1>
          </div>
          <Button onClick={newBriefing} className="shrink-0">
            <Plus className="mr-1.5 h-4 w-4" />
            Novo briefing
          </Button>
        </div>

        {/* Client data card */}
        <Card className="p-5">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <div className="text-base font-semibold">{client.company}</div>
              <div className="mt-0.5 text-xs text-muted-foreground">
                cliente desde {fmt(client.created_at).split(',')[0]}
              </div>
            </div>
            <Button
              variant={editMode ? 'secondary' : 'outline'}
              size="sm"
              onClick={() => setEditMode(!editMode)}
            >
              {editMode ? (
                <>
                  <X className="mr-1 h-3.5 w-3.5" />
                  Cancelar
                </>
              ) : (
                <>
                  <Pencil className="mr-1 h-3.5 w-3.5" />
                  Editar
                </>
              )}
            </Button>
          </div>

          {editMode ? (
            <div className="flex flex-col gap-3">
              {[
                { label: 'Empresa', key: 'company' },
                { label: 'Nome do contato', key: 'name' },
                { label: 'Email', key: 'email' },
                { label: 'WhatsApp', key: 'phone' },
                { label: 'Site', key: 'website' },
              ].map((f) => (
                <div key={f.key} className="space-y-1.5">
                  <Label
                    htmlFor={`edit-${f.key}`}
                    className="text-xs uppercase tracking-wider text-muted-foreground"
                  >
                    {f.label}
                  </Label>
                  <Input
                    id={`edit-${f.key}`}
                    value={editForm[f.key as keyof typeof editForm]}
                    onChange={(e) =>
                      setEditForm((p) => ({ ...p, [f.key]: e.target.value }))
                    }
                  />
                </div>
              ))}
              <Button onClick={saveEdit} disabled={savingEdit} className="mt-1">
                {savingEdit ? (
                  'Salvando...'
                ) : (
                  <>
                    <Save className="mr-1.5 h-4 w-4" />
                    Salvar alterações
                  </>
                )}
              </Button>
            </div>
          ) : (
            <div className="grid gap-3 [grid-template-columns:repeat(auto-fill,minmax(180px,1fr))]">
              {[
                { label: 'Contato', value: client.name },
                { label: 'Email', value: client.email || '—' },
                { label: 'WhatsApp', value: client.phone || '—' },
                {
                  label: 'Site',
                  value: client.website || '—',
                  link: client.website || undefined,
                },
              ].map((f) => (
                <div key={f.label}>
                  <div className="mb-1 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                    {f.label}
                  </div>
                  {f.link ? (
                    <a
                      href={f.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="break-all text-sm text-primary no-underline hover:underline"
                    >
                      {f.value}
                    </a>
                  ) : (
                    <div className="break-all text-sm text-foreground">
                      {f.value}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* AI Profile card */}
        <Card className={cn('p-5', hasAiProfile && 'border-primary/30')}>
          <div
            className={cn(
              'flex items-center justify-between gap-3',
              hasAiProfile && !aiExpanded ? 'mb-0' : 'mb-4',
              hasAiProfile && 'cursor-pointer',
            )}
            onClick={() => hasAiProfile && setAiExpanded((e) => !e)}
          >
            <div>
              <div className="flex items-center gap-2 text-[15px] font-bold">
                <Bot className="h-4 w-4 text-primary" />
                Perfil de IA
                {hasAiProfile && (
                  <span className="rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary">
                    Salvo
                  </span>
                )}
              </div>
              <div className="mt-1 text-xs text-muted-foreground">
                {hasAiProfile
                  ? aiExpanded
                    ? 'Clique para recolher'
                    : 'Clique para expandir e editar'
                  : 'Sem perfil ainda — analise o site ou preencha manualmente'}
              </div>
            </div>
            <div className="flex items-center gap-2">
              {hasAiProfile && !editingAi && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation()
                    setEditingAi(true)
                    setAiExpanded(true)
                  }}
                >
                  <Pencil className="mr-1 h-3.5 w-3.5" />
                  Editar
                </Button>
              )}
              {hasAiProfile && (
                <ChevronDown
                  className={cn(
                    'h-5 w-5 text-muted-foreground transition-transform',
                    aiExpanded && 'rotate-180',
                  )}
                />
              )}
            </div>
          </div>

          {/* Collapsible content */}
          {(!hasAiProfile || aiExpanded) && (
            <div>
              {/* Analyze section */}
              <div
                className={cn(
                  'rounded-lg bg-muted/40 p-4',
                  hasAiProfile && 'mb-4',
                )}
              >
                <div className="mb-2.5 flex items-center gap-1.5 text-xs font-semibold text-foreground">
                  {hasAiProfile ? (
                    <>
                      <RefreshCw className="h-3.5 w-3.5" />
                      Re-analisar com IA
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-3.5 w-3.5" />
                      Analisar com IA
                    </>
                  )}
                </div>
                <div className="flex flex-col gap-2">
                  <Input
                    value={analyzeUrl}
                    onChange={(e) => setAnalyzeUrl(e.target.value)}
                    placeholder="URL do site (opcional)"
                  />
                  <textarea
                    value={extraText}
                    onChange={(e) => setExtraText(e.target.value)}
                    placeholder="Informações extras sobre o cliente (opcional) — descreva o negócio, nicho, produtos, público..."
                    className="min-h-[72px] w-full resize-y rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  />
                  <Button onClick={analyzeWithAI} disabled={analyzing}>
                    {analyzing ? (
                      <>
                        <Clock className="mr-1.5 h-4 w-4 animate-spin" />
                        Analisando com IA...
                      </>
                    ) : hasAiProfile ? (
                      <>
                        <RefreshCw className="mr-1.5 h-4 w-4" />
                        Re-analisar
                      </>
                    ) : (
                      <>
                        <Sparkles className="mr-1.5 h-4 w-4" />
                        Gerar perfil com IA
                      </>
                    )}
                  </Button>
                </div>
                {!analyzeUrl && !client.website && (
                  <div className="mt-2 text-xs text-muted-foreground">
                    Sem site? Use o campo de informações extras para descrever
                    o negócio.
                  </div>
                )}
              </div>

              {/* AI fields — view or edit */}
              {hasAiProfile && (
                <div className="flex flex-col gap-2">
                  {AI_FIELDS.map((f) => {
                    const val = aiProfile[f.key]
                    if (!val && !editingAi) return null
                    return (
                      <div
                        key={f.key}
                        className="overflow-hidden rounded-lg border border-border"
                      >
                        <div className="bg-muted/40 px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                          {f.label}
                        </div>
                        {editingAi ? (
                          <textarea
                            value={aiProfile[f.key] || ''}
                            onChange={(e) =>
                              setAiProfile((p) => ({
                                ...p,
                                [f.key]: e.target.value,
                              }))
                            }
                            className="block min-h-[60px] w-full resize-y border-0 bg-card px-3 py-2.5 text-sm leading-relaxed text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
                          />
                        ) : (
                          <div className="bg-card px-3 py-2.5 text-sm leading-relaxed text-foreground">
                            {String(val)}
                          </div>
                        )}
                      </div>
                    )
                  })}
                  {editingAi && (
                    <div className="mt-1 flex gap-2">
                      <Button
                        variant="outline"
                        onClick={() => {
                          setEditingAi(false)
                          if (client.analysis)
                            setAiProfile(
                              client.analysis as Record<string, string>,
                            )
                        }}
                        className="flex-1"
                      >
                        Cancelar
                      </Button>
                      <Button
                        onClick={saveAiProfile}
                        disabled={savingAi}
                        className="flex-[2]"
                      >
                        {savingAi ? (
                          'Salvando...'
                        ) : (
                          <>
                            <Save className="mr-1.5 h-4 w-4" />
                            Salvar perfil
                          </>
                        )}
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </Card>

        {/* Briefings history */}
        <Card className="p-5">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-1.5 text-[15px] font-bold">
                <ClipboardList className="h-4 w-4" />
                Briefings
              </div>
              <div className="mt-1 text-xs text-muted-foreground">
                {briefings.length} no histórico
              </div>
            </div>
            <Button size="sm" onClick={newBriefing}>
              <Plus className="mr-1 h-3.5 w-3.5" />
              Novo briefing
            </Button>
          </div>

          {briefings.length === 0 ? (
            <div className="py-6 text-center text-sm text-muted-foreground">
              Nenhum briefing ainda —{' '}
              <button
                onClick={newBriefing}
                className="font-mono text-primary hover:underline"
              >
                criar o primeiro
              </button>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {briefings.map((b) => (
                <div
                  key={b.id}
                  className="rounded-lg border border-border bg-muted/30 px-3.5 py-3"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="mb-1.5 text-sm font-semibold">
                        {b.type_label}
                      </div>
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span
                          className={cn(
                            'inline-flex items-center gap-1 whitespace-nowrap rounded-full border px-2 py-0.5 text-[11px] font-medium',
                            b.status === 'concluido' &&
                              'border-success/30 bg-success/10 text-success',
                            b.status === 'em_andamento' &&
                              'border-warning/30 bg-warning/10 text-warning',
                            b.status === 'visualizado' &&
                              'border-info/30 bg-info/10 text-info',
                            b.status === 'enviado' &&
                              'border-border bg-muted text-muted-foreground',
                          )}
                        >
                          <StatusIcon status={b.status} />
                          {STATUS_LABELS[b.status]}
                        </span>
                        <span className="whitespace-nowrap text-xs text-muted-foreground">
                          {fmt(b.created_at)}
                        </span>
                        {b.completed_at && (
                          <span className="whitespace-nowrap text-xs text-muted-foreground">
                            · concluído {fmt(b.completed_at)}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-1.5">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          navigator.clipboard.writeText(
                            `${window.location.origin}/${b.slug}`,
                          )
                        }
                      >
                        <LinkIcon className="mr-1 h-3.5 w-3.5" />
                        Link
                      </Button>
                      {b.status === 'concluido' && (
                        <>
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => viewResponses(b.slug)}
                          >
                            Ver respostas
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() =>
                              toggleLock(b.slug, !!b.editing_locked)
                            }
                            title={
                              b.editing_locked
                                ? 'Liberar edição'
                                : 'Bloquear edição'
                            }
                          >
                            {b.editing_locked ? (
                              <Unlock className="h-4 w-4" />
                            ) : (
                              <Lock className="h-4 w-4" />
                            )}
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* RESPONSES MODAL */}
      <Dialog
        open={!!viewingResponses}
        onOpenChange={(open) => {
          if (!open) {
            setViewingResponses(null)
            setResponses(null)
          }
        }}
      >
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{client?.company}</DialogTitle>
            <div className="text-xs text-muted-foreground">
              Respostas do briefing
            </div>
          </DialogHeader>

          <div className="mb-4 mt-2 flex gap-2">
            <Button
              variant="outline"
              onClick={() =>
                viewingResponses && copyResponses(viewingResponses)
              }
              className="flex-1"
            >
              {copiedResponses ? (
                <>
                  <ClipboardCheck className="mr-1.5 h-4 w-4" />
                  Copiado!
                </>
              ) : (
                <>
                  <Clipboard className="mr-1.5 h-4 w-4" />
                  Copiar tudo
                </>
              )}
            </Button>
          </div>

          {responseVersions2 > 1 && responseDiff2 && (
            <div className="mb-4">
              <div className="mb-2 flex gap-2">
                <Button
                  variant={!showDiff2 ? 'secondary' : 'outline'}
                  size="sm"
                  onClick={() => setShowDiff2(false)}
                  className="flex-1"
                >
                  Respostas atuais
                </Button>
                <Button
                  variant={showDiff2 ? 'secondary' : 'outline'}
                  size="sm"
                  onClick={() => setShowDiff2(true)}
                  className="flex-1"
                >
                  <Pencil className="mr-1.5 h-3 w-3" />
                  Alterações
                  <span className="ml-1.5 rounded-full bg-foreground/10 px-1.5 py-px text-[10px] font-bold text-foreground">
                    {Object.keys(responseDiff2).length}
                  </span>
                </Button>
              </div>
              {showDiff2 && (
                <div className="flex flex-col gap-2">
                  {Object.entries(responseDiff2).map(
                    ([key, { old: oldVal, new: newVal }]) => {
                      const bLang = briefings.find(
                        (b) => b.slug === viewingResponses,
                      )?.language
                      const labelMap =
                        bLang === 'en-US' ? FIELD_LABELS_EN : FIELD_LABELS_PT
                      const label = labelMap[key] || key.replace(/_/g, ' ')
                      const oldStr = Array.isArray(oldVal)
                        ? (oldVal as string[]).join(', ')
                        : String(oldVal || '')
                      const newStr = Array.isArray(newVal)
                        ? (newVal as string[]).join(', ')
                        : String(newVal || '')
                      return (
                        <div
                          key={key}
                          className="overflow-hidden rounded-lg border border-primary/30 bg-card"
                        >
                          <div className="border-b border-primary/30 bg-primary/5 px-3.5 py-1.5">
                            <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-primary">
                              <Pencil className="h-3 w-3" />
                              {label}
                            </span>
                          </div>
                          <div className="flex flex-col gap-2 px-3.5 py-2.5">
                            <div className="text-xs leading-relaxed text-muted-foreground line-through">
                              <span className="mr-1.5 text-[10px] font-semibold">
                                ERA:
                              </span>
                              {oldStr || '—'}
                            </div>
                            <div className="text-sm font-semibold leading-relaxed text-foreground">
                              <span className="mr-1.5 text-[10px] font-bold text-primary">
                                AGORA:
                              </span>
                              {newStr}
                            </div>
                          </div>
                        </div>
                      )
                    },
                  )}
                </div>
              )}
            </div>
          )}

          {loadingResponses ? (
            <div className="py-10 text-center">
              <div className="spinner" />
            </div>
          ) : responses ? (
            <ResponsesContent2
              responses={responses}
              language={
                briefings.find((b) => b.slug === viewingResponses)?.language
              }
              companyName={client?.company || 'briefing'}
              renderFileValue={renderFileValue}
              labelMapPT={FIELD_LABELS_PT}
              labelMapEN={FIELD_LABELS_EN}
            />
          ) : (
            <div className="py-8 text-center text-sm text-muted-foreground">
              Sem respostas ainda
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
