'use client'

import { useState, useEffect, useCallback, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Bot,
  ChevronRight,
  Clipboard,
  ClipboardCheck,
  Eye,
  Globe,
  Mail,
  PartyPopper,
  Plus,
  Search,
  Send,
  Sparkles,
} from 'lucide-react'

import {
  BRIEFING_TEMPLATES,
  BriefingLanguage,
  getTemplate,
  BriefingType,
} from '@/lib/briefing-types'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { PreviewModal } from '@/components/admin/PreviewModal'
import { cn } from '@/lib/utils'

interface ClientData {
  id?: string
  name: string
  company: string
  website: string
  email: string
  phone: string
  extraText: string
  analysis?: Record<string, unknown> | null
}

interface ExistingClient {
  id: string
  name: string
  company: string
  email: string
  phone: string
  website: string | null
  analysis: Record<string, unknown> | null
}

type Step = 'select' | 'client' | 'type' | 'preview'

function buildPrefilled(
  ai: Record<string, unknown>,
  clientForm: ClientData,
): Record<string, unknown> {
  const prefilled: Record<string, unknown> = {}

  const directMap: Record<string, string[]> = {
    company_name: ['company_name'],
    segment: ['segment'],
    description: ['description'],
    differentials: ['differentials'],
    target_audience: ['target_audience'],
    key_features: ['key_features'],
    unique_value_proposition: ['unique_value_proposition', 'positioning'],
    geographic_focus: ['geographic_focus'],
    extra_notes: ['extra_notes'],
    colors_hint: ['color_preferences', 'color_palette'],
  }
  for (const [aiKey, fieldIds] of Object.entries(directMap)) {
    if (ai[aiKey]) {
      for (const fid of fieldIds) prefilled[fid] = ai[aiKey]
    }
  }

  if (ai.price_positioning) {
    const p = String(ai.price_positioning).toLowerCase()
    if (p.includes('premium') || p.includes('alto'))
      prefilled.price_positioning = 'Premium / Alto padrão'
    else if (
      p.includes('intermediário') ||
      p.includes('intermediario') ||
      p.includes('custo')
    )
      prefilled.price_positioning = 'Intermediário'
    else if (p.includes('acess') || p.includes('popular'))
      prefilled.price_positioning = 'Acessível / Popular'
    else prefilled.price_positioning = ai.price_positioning
  }

  if (ai.brand_personality) {
    const optionsMap: Record<string, string> = {
      moderna: 'Moderna',
      classica: 'Clássica',
      clássica: 'Clássica',
      ousada: 'Ousada',
      elegante: 'Elegante',
      divertida: 'Divertida',
      séria: 'Séria',
      seria: 'Séria',
      minimalista: 'Minimalista',
      sofisticada: 'Sofisticada',
      acessível: 'Acessível',
      acessivel: 'Acessível',
      tecnológica: 'Tecnológica',
      tecnologica: 'Tecnológica',
      humana: 'Humana',
      sustentável: 'Sustentável',
      sustentavel: 'Sustentável',
      inovadora: 'Moderna',
      criativa: 'Ousada',
      profissional: 'Séria',
      jovem: 'Divertida',
      luxo: 'Sofisticada',
    }
    const raw = String(ai.brand_personality)
    const words = raw
      .split(/[,\s]+/)
      .map((w: string) =>
        w
          .trim()
          .toLowerCase()
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, ''),
      )
    const matched = [
      ...new Set(words.map((w: string) => optionsMap[w]).filter(Boolean)),
    ]
    if (matched.length > 0) prefilled.brand_personality = matched
  }

  if (ai.tone_of_voice) {
    const t = String(ai.tone_of_voice).toLowerCase()
    let tone = ''
    if (t.includes('formal') || t.includes('institucional'))
      tone = 'Formal e institucional'
    else if (
      t.includes('próximo') ||
      t.includes('proximo') ||
      t.includes('profissional')
    )
      tone = 'Profissional mas próximo'
    else if (
      t.includes('descontraído') ||
      t.includes('descontraido') ||
      t.includes('jovem')
    )
      tone = 'Descontraído e jovem'
    else if (
      t.includes('técnico') ||
      t.includes('tecnico') ||
      t.includes('especialista')
    )
      tone = 'Técnico e especialista'
    if (tone) {
      prefilled.brand_tone = tone
      prefilled.content_tone = tone
    }
  }

  // Contact info now comes from client record — not pre-filled in form

  return prefilled
}

function NovoBriefingContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const clientId = searchParams.get('client_id')

  const [step, setStep] = useState<Step>(clientId ? 'type' : 'select')
  const [loading, setLoading] = useState(false)
  const [clientSearch, setClientSearch] = useState('')
  const [existingClients, setExistingClients] = useState<ExistingClient[]>([])
  const [loadingClients, setLoadingClients] = useState(false)
  const [showNewClientForm, setShowNewClientForm] = useState(false)

  const [clientForm, setClientForm] = useState<ClientData>({
    name: '',
    company: '',
    website: '',
    email: '',
    phone: '',
    extraText: '',
  })
  const [analysis, setAnalysis] = useState<Record<string, unknown> | null>(null)
  const [selectedType, setSelectedType] = useState<BriefingType | null>(null)
  const [language, setLanguage] = useState<BriefingLanguage>('pt-BR')
  const [generatedLink, setGeneratedLink] = useState('')
  const [emailSent, setEmailSent] = useState(false)
  const [copied, setCopied] = useState(false)
  const [extraNote, setExtraNote] = useState('')
  const [previewOpen, setPreviewOpen] = useState(false)

  // Load existing clients for the select step
  const loadClients = useCallback(async () => {
    setLoadingClients(true)
    const res = await fetch('/api/admin/clients')
    if (res.ok) {
      const d = await res.json()
      setExistingClients(d.clients || [])
    }
    setLoadingClients(false)
  }, [])

  // Load client when client_id param is present
  const loadClient = useCallback(async () => {
    if (!clientId) return
    setLoading(true)
    const res = await fetch(`/api/admin/clients/${clientId}`)
    if (res.ok) {
      const d = await res.json()
      const c = d.client
      setClientForm({
        id: c.id,
        name: c.name,
        company: c.company,
        website: c.website || '',
        email: c.email || '',
        phone: c.phone || '',
        extraText: '',
        analysis: c.analysis || null,
      })
      if (c.analysis) setAnalysis(c.analysis)
      setStep('type')
    }
    setLoading(false)
  }, [clientId])

  useEffect(() => {
    if (clientId) loadClient()
    else loadClients()
  }, [clientId, loadClient, loadClients])

  function selectExistingClient(c: ExistingClient) {
    setClientForm({
      id: c.id,
      name: c.name,
      company: c.company,
      website: c.website || '',
      email: c.email || '',
      phone: c.phone || '',
      extraText: '',
      analysis: c.analysis,
    })
    if (c.analysis) setAnalysis(c.analysis)
    setStep('type')
  }

  async function handleAnalyze(e: React.FormEvent) {
    e.preventDefault()
    if (!clientForm.company) return
    setLoading(true)
    try {
      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          website: clientForm.website,
          text: clientForm.extraText,
          company: clientForm.company,
          language,
        }),
      })
      const data = await res.json()
      setAnalysis(data.analysis || {})
    } catch {
      setAnalysis({})
    }
    setLoading(false)
    setStep('type')
  }

  async function handleCreate() {
    if (!selectedType) return
    setLoading(true)
    const template = getTemplate(selectedType, language)
    const ai = analysis || clientForm.analysis || {}
    const prefilled = buildPrefilled(ai as Record<string, unknown>, clientForm)

    try {
      const res = await fetch('/api/briefings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client: { ...clientForm, analysis: ai },
          briefingType: selectedType,
          briefingTypeLabel: template.label,
          prefilledData: prefilled,
          internalNotes: extraNote || null,
          language,
          sendEmail: !!clientForm.email,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        alert('Erro ao criar briefing: ' + (data.error || res.status))
        setLoading(false)
        return
      }
      setGeneratedLink(data.link || '')
      setEmailSent(data.emailSent)
      setStep('preview')
    } catch (e) {
      console.error(e)
      alert('Erro inesperado ao criar briefing')
    }
    setLoading(false)
  }

  async function copyLink() {
    await navigator.clipboard.writeText(generatedLink)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const filteredClients = existingClients.filter(
    (c) =>
      !clientSearch ||
      [c.company, c.name, c.email].some((v) =>
        v?.toLowerCase().includes(clientSearch.toLowerCase()),
      ),
  )

  const stepLabels = clientId
    ? [
        { key: 'type', label: '1. Tipo' },
        { key: 'preview', label: '2. Link' },
      ]
    : showNewClientForm
      ? [
          { key: 'select', label: '1. Cliente' },
          { key: 'client', label: '2. Dados' },
          { key: 'type', label: '3. Tipo' },
          { key: 'preview', label: '4. Link' },
        ]
      : [
          { key: 'select', label: '1. Cliente' },
          { key: 'type', label: '2. Tipo' },
          { key: 'preview', label: '3. Link' },
        ]

  function handleBack() {
    if (step === 'client') {
      setStep('select')
      setShowNewClientForm(false)
    } else if (step === 'type' && !clientId) {
      showNewClientForm ? setStep('client') : setStep('select')
    } else if (step === 'preview') {
      setStep('type')
    } else {
      clientId
        ? router.push(`/admin/clientes/${clientId}`)
        : router.push('/admin')
    }
  }

  if (loading && step === 'type' && clientId)
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="spinner" />
      </div>
    )

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="mx-auto max-w-3xl px-6 pt-6">
        <div className="mb-3 flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={handleBack}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h1 className="font-mono text-xl font-bold tracking-tight">
            {clientId && clientForm.company
              ? `${clientForm.company} / Novo Briefing`
              : 'Novo Briefing'}
          </h1>
        </div>

        {/* Progress */}
        <div className="mb-8 flex gap-6 border-b border-border">
          {stepLabels.map((s) => (
            <div
              key={s.key}
              className={cn(
                '-mb-px border-b-2 py-3 text-sm font-medium',
                step === s.key
                  ? 'border-foreground text-foreground'
                  : 'border-transparent text-muted-foreground',
              )}
            >
              {s.label}
            </div>
          ))}
        </div>
      </div>

      <div className="mx-auto max-w-2xl px-6 pb-12">
        {/* STEP: select client */}
        {step === 'select' && !showNewClientForm && (
          <div>
            <h2 className="mb-1.5 font-mono text-2xl font-bold tracking-tight">
              Para qual cliente?
            </h2>
            <p className="mb-6 text-sm text-muted-foreground">
              Selecione um cliente existente ou crie um novo.
            </p>

            {/* Search existing */}
            <div className="relative mb-3">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={clientSearch}
                onChange={(e) => setClientSearch(e.target.value)}
                placeholder="Buscar por empresa ou nome..."
                autoFocus
                className="pl-9"
              />
            </div>

            {/* Client list */}
            {loadingClients ? (
              <div className="mb-4 flex flex-col gap-2">
                {[1, 2, 3].map((i) => (
                  <Card key={i} className="p-4">
                    <div className="mb-2 h-3.5 w-2/5 animate-pulse rounded bg-muted" />
                    <div className="h-2.5 w-3/5 animate-pulse rounded bg-muted" />
                  </Card>
                ))}
              </div>
            ) : filteredClients.length > 0 ? (
              <div className="mb-4 flex max-h-80 flex-col gap-2 overflow-y-auto">
                {filteredClients.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => selectExistingClient(c)}
                    className="flex items-center gap-3 rounded-lg border border-border bg-card p-3.5 text-left transition-colors hover:border-foreground/20 hover:bg-muted/50"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 truncate text-sm font-semibold">
                        <span className="truncate">{c.company}</span>
                        {c.analysis &&
                          Object.keys(c.analysis).length > 0 && (
                            <Bot
                              className="h-3.5 w-3.5 shrink-0 text-muted-foreground"
                              aria-label="Perfil IA disponível"
                            />
                          )}
                      </div>
                      <div className="truncate text-xs text-muted-foreground">
                        {c.name}
                        {c.email && ` · ${c.email}`}
                      </div>
                    </div>
                    <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground" />
                  </button>
                ))}
              </div>
            ) : clientSearch ? (
              <div className="mb-4 py-5 text-center text-sm text-muted-foreground">
                Nenhum cliente encontrado para &ldquo;{clientSearch}&rdquo;
              </div>
            ) : (
              <div className="mb-4 py-5 text-center text-sm text-muted-foreground">
                Nenhum cliente cadastrado ainda
              </div>
            )}

            {/* Divider */}
            <div className="mb-4 flex items-center gap-3">
              <div className="h-px flex-1 bg-border" />
              <span className="shrink-0 text-xs text-muted-foreground">
                ou
              </span>
              <div className="h-px flex-1 bg-border" />
            </div>

            <Button
              variant="outline"
              className="w-full"
              onClick={() => {
                setShowNewClientForm(true)
                setStep('client')
              }}
            >
              <Plus className="mr-1.5 h-4 w-4" />
              Criar novo cliente
            </Button>
          </div>
        )}

        {/* STEP: new client form */}
        {step === 'client' && showNewClientForm && (
          <form onSubmit={handleAnalyze}>
            <h2 className="mb-1.5 font-mono text-2xl font-bold tracking-tight">
              Novo cliente
            </h2>
            <p className="mb-6 text-sm text-muted-foreground">
              Preencha os dados. O Claude vai analisar o site automaticamente.
            </p>
            <div className="flex flex-col gap-3.5">
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <div className="space-y-1.5">
                  <Label
                    htmlFor="nc-name"
                    className="text-xs uppercase tracking-wider text-muted-foreground"
                  >
                    Nome do contato *
                  </Label>
                  <Input
                    id="nc-name"
                    value={clientForm.name}
                    onChange={(e) =>
                      setClientForm((p) => ({ ...p, name: e.target.value }))
                    }
                    placeholder="João Silva"
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <Label
                    htmlFor="nc-company"
                    className="text-xs uppercase tracking-wider text-muted-foreground"
                  >
                    Empresa *
                  </Label>
                  <Input
                    id="nc-company"
                    value={clientForm.company}
                    onChange={(e) =>
                      setClientForm((p) => ({
                        ...p,
                        company: e.target.value,
                      }))
                    }
                    placeholder="Nome da empresa"
                    required
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <div className="space-y-1.5">
                  <Label
                    htmlFor="nc-email"
                    className="text-xs uppercase tracking-wider text-muted-foreground"
                  >
                    Email
                  </Label>
                  <Input
                    id="nc-email"
                    type="email"
                    value={clientForm.email}
                    onChange={(e) =>
                      setClientForm((p) => ({ ...p, email: e.target.value }))
                    }
                    placeholder="email@empresa.com"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label
                    htmlFor="nc-phone"
                    className="text-xs uppercase tracking-wider text-muted-foreground"
                  >
                    WhatsApp
                  </Label>
                  <Input
                    id="nc-phone"
                    value={clientForm.phone}
                    onChange={(e) =>
                      setClientForm((p) => ({ ...p, phone: e.target.value }))
                    }
                    placeholder="(47) 99999-9999"
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label
                  htmlFor="nc-website"
                  className="text-xs uppercase tracking-wider text-muted-foreground"
                >
                  Site do cliente
                </Label>
                <Input
                  id="nc-website"
                  value={clientForm.website}
                  onChange={(e) =>
                    setClientForm((p) => ({ ...p, website: e.target.value }))
                  }
                  placeholder="https://empresa.com.br"
                />
              </div>
              <div className="space-y-1.5">
                <Label
                  htmlFor="nc-extra"
                  className="text-xs uppercase tracking-wider text-muted-foreground"
                >
                  Informações extras (opcional)
                </Label>
                <textarea
                  id="nc-extra"
                  value={clientForm.extraText}
                  onChange={(e) =>
                    setClientForm((p) => ({
                      ...p,
                      extraText: e.target.value,
                    }))
                  }
                  placeholder="Cole aqui qualquer informação adicional sobre o cliente..."
                  className="min-h-[80px] w-full resize-y rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                />
              </div>
              {clientForm.email && (
                <Card className="flex items-center gap-2.5 border-primary/30 bg-primary/5 p-3">
                  <Mail className="h-5 w-5 shrink-0 text-primary" />
                  <span className="text-sm text-muted-foreground">
                    O briefing será enviado automaticamente para{' '}
                    <strong className="text-foreground">
                      {clientForm.email}
                    </strong>
                  </span>
                </Card>
              )}
              <Button
                type="submit"
                disabled={loading || !clientForm.company}
                size="lg"
              >
                {loading ? (
                  <>
                    <div className="spinner mr-2" /> Analisando com IA...
                  </>
                ) : (
                  <>
                    <Sparkles className="mr-1.5 h-4 w-4" />
                    Analisar e continuar
                  </>
                )}
              </Button>
            </div>
          </form>
        )}

        {/* STEP: type */}
        {step === 'type' && (
          <div>
            {/* Client summary */}
            {clientForm.company && (
              <Card className="mb-5 flex items-center gap-2.5 p-3">
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-semibold">
                    {clientForm.company}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {clientForm.name}
                    {clientForm.email && ` · ${clientForm.email}`}
                  </div>
                </div>
                {analysis && Object.keys(analysis).length > 0 && (
                  <Bot
                    className="h-4 w-4 text-muted-foreground"
                    aria-label="Perfil IA disponível — campos serão preenchidos automaticamente"
                  />
                )}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    setStep(showNewClientForm ? 'client' : 'select')
                  }
                  className="shrink-0"
                >
                  Trocar
                </Button>
              </Card>
            )}

            {/* AI profile summary */}
            {analysis && Object.keys(analysis).length > 0 && (
              <Card className="mb-5 border-primary/30 p-4">
                <div className="mb-2 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-primary">
                  <Sparkles className="h-3.5 w-3.5" />
                  Perfil IA — campos pré-preenchidos automaticamente
                </div>
                <div className="text-sm leading-relaxed">
                  {String(analysis.description || '')}
                </div>
                {analysis.target_audience ? (
                  <div className="mt-2 text-sm text-muted-foreground">
                    <strong className="text-foreground/70">Público: </strong>
                    {String(analysis.target_audience)}
                  </div>
                ) : null}
                {analysis.differentials ? (
                  <div className="mt-1.5 text-sm text-muted-foreground">
                    <strong className="text-foreground/70">
                      Diferenciais:{' '}
                    </strong>
                    {String(analysis.differentials)}
                  </div>
                ) : null}
              </Card>
            )}

            <h2 className="mb-1.5 font-mono text-2xl font-bold tracking-tight">
              Tipo de briefing
            </h2>
            <p className="mb-4 text-sm text-muted-foreground">
              Escolha o serviço que será desenvolvido.
            </p>

            {/* Language toggle */}
            <Card className="mb-5 flex items-center gap-2 p-3">
              <Globe className="h-4 w-4 text-muted-foreground" />
              <span className="flex-1 text-sm text-muted-foreground">
                Idioma do briefing para o cliente
              </span>
              <div className="flex gap-1.5">
                <Button
                  variant={language === 'pt-BR' ? 'secondary' : 'outline'}
                  size="sm"
                  onClick={() => setLanguage('pt-BR')}
                  className={cn(
                    language === 'pt-BR' &&
                      'border-foreground/20 bg-muted text-foreground hover:bg-muted/80',
                  )}
                >
                  PT
                </Button>
                <Button
                  variant={language === 'en-US' ? 'secondary' : 'outline'}
                  size="sm"
                  onClick={() => setLanguage('en-US')}
                  className={cn(
                    language === 'en-US' &&
                      'border-foreground/20 bg-muted text-foreground hover:bg-muted/80',
                  )}
                >
                  EN
                </Button>
              </div>
            </Card>

            <div className="mb-5 flex flex-col gap-2.5">
              {(Object.keys(BRIEFING_TEMPLATES) as BriefingType[]).map(
                (type) => {
                  const t = getTemplate(type, language)
                  const isSelected = selectedType === type
                  return (
                    <button
                      key={type}
                      onClick={() => setSelectedType(type)}
                      className={cn(
                        'rounded-lg border px-4 py-3.5 text-left transition-colors',
                        isSelected
                          ? 'border-primary/40 bg-primary/10'
                          : 'border-border bg-card hover:border-primary/30 hover:bg-muted/50',
                      )}
                    >
                      <div
                        className={cn(
                          'text-[15px] font-semibold',
                          isSelected ? 'text-primary' : 'text-foreground',
                        )}
                      >
                        {t.label}
                      </div>
                      <div className="mt-1 text-sm text-muted-foreground">
                        {t.description}
                      </div>
                    </button>
                  )
                },
              )}
            </div>

            {/* Preview button */}
            {selectedType && (
              <Button
                variant="outline"
                className="mb-5 w-full"
                onClick={() => setPreviewOpen(true)}
              >
                <Eye className="mr-1.5 h-4 w-4" />
                Ver preview — como o cliente vai ver
              </Button>
            )}

            {/* Preview lightbox */}
            {selectedType && (
              <PreviewModal
                open={previewOpen}
                onOpenChange={setPreviewOpen}
                type={selectedType}
                language={language}
                company={clientForm.company || 'Empresa'}
              />
            )}

            {/* Extra note */}
            <div className="mb-5 space-y-1.5">
              <Label
                htmlFor="extra-note"
                className="text-xs uppercase tracking-wider text-muted-foreground"
              >
                Observação interna (opcional)
              </Label>
              <textarea
                id="extra-note"
                value={extraNote}
                onChange={(e) => setExtraNote(e.target.value)}
                placeholder="Contexto específico deste briefing — ex: reunião dia X, foco em produto Y, preferências do cliente..."
                className="min-h-[72px] w-full resize-y rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              />
              <div className="text-xs text-muted-foreground">
                Visível só para você no painel — não aparece para o cliente.
              </div>
            </div>

            <Button
              onClick={handleCreate}
              disabled={!selectedType || loading}
              size="lg"
              className="w-full"
            >
              {loading ? (
                <>
                  <div className="spinner mr-2" /> Gerando briefing...
                </>
              ) : (
                <>
                  <Send className="mr-1.5 h-4 w-4" />
                  Gerar e enviar briefing
                  <ArrowRight className="ml-1.5 h-4 w-4" />
                </>
              )}
            </Button>
          </div>
        )}

        {/* STEP: preview */}
        {step === 'preview' && (
          <div className="text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
              <PartyPopper className="h-8 w-8 text-primary" />
            </div>
            <h2 className="mb-2 font-mono text-2xl font-bold tracking-tight">
              Briefing criado!
            </h2>
            <p className="mb-7 text-sm text-muted-foreground">
              Pronto para{' '}
              <strong className="text-foreground">{clientForm.name}</strong> da{' '}
              <strong className="text-foreground">{clientForm.company}</strong>
            </p>

            {clientForm.email && (
              <Card
                className={cn(
                  'mb-5 p-3 text-sm',
                  emailSent
                    ? 'border-success/30 bg-success/10 text-success'
                    : 'border-destructive/30 bg-destructive/10 text-destructive',
                )}
              >
                {emailSent ? (
                  <span className="inline-flex items-center gap-2">
                    <Mail className="h-4 w-4" />
                    Email enviado para {clientForm.email}
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-2">
                    <AlertCircle className="h-4 w-4" />
                    Email não enviado — copie e envie o link manualmente
                  </span>
                )}
              </Card>
            )}

            <Card className="mb-3.5 p-4 text-left">
              <div className="mb-1.5 text-xs text-muted-foreground">
                Link do briefing
              </div>
              <div className="break-all font-mono text-sm text-primary">
                {generatedLink}
              </div>
            </Card>

            <div className="mb-2.5 flex gap-2.5">
              <Button onClick={copyLink} className="flex-1">
                {copied ? (
                  <>
                    <ClipboardCheck className="mr-1.5 h-4 w-4" />
                    Copiado!
                  </>
                ) : (
                  <>
                    <Clipboard className="mr-1.5 h-4 w-4" />
                    Copiar link
                  </>
                )}
              </Button>
              <Button
                variant="outline"
                onClick={() =>
                  clientForm.id
                    ? router.push(`/admin/clientes/${clientForm.id}`)
                    : router.push('/admin')
                }
                className="flex-1"
              >
                {clientForm.id ? 'Ver cliente' : 'Ver painel'}
              </Button>
            </div>
            <Button
              variant="ghost"
              onClick={() => router.push('/admin')}
              className="w-full"
            >
              Ir para o painel
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}

export default function NovoBriefingPage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-screen items-center justify-center">
          <div className="spinner" />
        </div>
      }
    >
      <NovoBriefingContent />
    </Suspense>
  )
}
