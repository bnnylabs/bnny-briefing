'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { BRIEFING_TEMPLATES, BriefingLanguage, getTemplate, BriefingType } from '@/lib/briefing-types'
import { Suspense } from 'react'

interface ClientData {
  id?: string; name: string; company: string; website: string
  email: string; phone: string; extraText: string
  analysis?: Record<string, unknown> | null
}

interface ExistingClient {
  id: string; name: string; company: string; email: string
  phone: string; website: string | null; analysis: Record<string, unknown> | null
}

type Step = 'select' | 'client' | 'type' | 'preview'

function buildPrefilled(ai: Record<string, unknown>, clientForm: ClientData): Record<string, unknown> {
  const prefilled: Record<string, unknown> = {}

  const directMap: Record<string, string[]> = {
    company_name:             ['company_name'],
    segment:                  ['segment'],
    description:              ['description'],
    differentials:            ['differentials'],
    target_audience:          ['target_audience'],
    key_features:             ['key_features'],
    unique_value_proposition: ['unique_value_proposition', 'positioning'],
    geographic_focus:         ['geographic_focus'],
    extra_notes:              ['extra_notes'],
    colors_hint:              ['color_preferences', 'color_palette'],
  }
  for (const [aiKey, fieldIds] of Object.entries(directMap)) {
    if (ai[aiKey]) { for (const fid of fieldIds) prefilled[fid] = ai[aiKey] }
  }

  if (ai.price_positioning) {
    const p = String(ai.price_positioning).toLowerCase()
    if (p.includes('premium') || p.includes('alto')) prefilled.price_positioning = 'Premium / Alto padrão'
    else if (p.includes('intermediário') || p.includes('intermediario') || p.includes('custo')) prefilled.price_positioning = 'Intermediário'
    else if (p.includes('acess') || p.includes('popular')) prefilled.price_positioning = 'Acessível / Popular'
    else prefilled.price_positioning = ai.price_positioning
  }

  if (ai.brand_personality) {
    const optionsMap: Record<string, string> = {
      moderna: 'Moderna', classica: 'Clássica', clássica: 'Clássica', ousada: 'Ousada',
      elegante: 'Elegante', divertida: 'Divertida', séria: 'Séria', seria: 'Séria',
      minimalista: 'Minimalista', sofisticada: 'Sofisticada', acessível: 'Acessível',
      acessivel: 'Acessível', tecnológica: 'Tecnológica', tecnologica: 'Tecnológica',
      humana: 'Humana', sustentável: 'Sustentável', sustentavel: 'Sustentável',
      inovadora: 'Moderna', criativa: 'Ousada', profissional: 'Séria', jovem: 'Divertida',
      luxo: 'Sofisticada',
    }
    const raw = String(ai.brand_personality)
    const words = raw.split(/[,\s]+/).map((w: string) => w.trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, ''))
    const matched = [...new Set(words.map((w: string) => optionsMap[w]).filter(Boolean))]
    if (matched.length > 0) prefilled.brand_personality = matched
  }

  if (ai.tone_of_voice) {
    const t = String(ai.tone_of_voice).toLowerCase()
    let tone = ''
    if (t.includes('formal') || t.includes('institucional')) tone = 'Formal e institucional'
    else if (t.includes('próximo') || t.includes('proximo') || t.includes('profissional')) tone = 'Profissional mas próximo'
    else if (t.includes('descontraído') || t.includes('descontraido') || t.includes('jovem')) tone = 'Descontraído e jovem'
    else if (t.includes('técnico') || t.includes('tecnico') || t.includes('especialista')) tone = 'Técnico e especialista'
    if (tone) { prefilled.brand_tone = tone; prefilled.content_tone = tone }
  }

  if (clientForm.name)  prefilled.responsible_name  = clientForm.name
  if (clientForm.email) prefilled.responsible_email = clientForm.email
  if (clientForm.phone) prefilled.responsible_phone = clientForm.phone

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

  const [clientForm, setClientForm] = useState<ClientData>({ name: '', company: '', website: '', email: '', phone: '', extraText: '' })
  const [analysis, setAnalysis] = useState<Record<string, unknown> | null>(null)
  const [selectedType, setSelectedType] = useState<BriefingType | null>(null)
  const [language, setLanguage] = useState<BriefingLanguage>('pt-BR')
  const [generatedLink, setGeneratedLink] = useState('')
  const [emailSent, setEmailSent] = useState(false)
  const [copied, setCopied] = useState(false)
  const [extraNote, setExtraNote] = useState('')

  // Load existing clients for the select step
  const loadClients = useCallback(async () => {
    setLoadingClients(true)
    const res = await fetch('/api/admin/clients')
    if (res.ok) { const d = await res.json(); setExistingClients(d.clients || []) }
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
      setClientForm({ id: c.id, name: c.name, company: c.company, website: c.website || '', email: c.email || '', phone: c.phone || '', extraText: '', analysis: c.analysis || null })
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
    setClientForm({ id: c.id, name: c.name, company: c.company, website: c.website || '', email: c.email || '', phone: c.phone || '', extraText: '', analysis: c.analysis })
    if (c.analysis) setAnalysis(c.analysis)
    setStep('type')
  }

  async function handleAnalyze(e: React.FormEvent) {
    e.preventDefault()
    if (!clientForm.company) return
    setLoading(true)
    try {
      const res = await fetch('/api/analyze', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ website: clientForm.website, text: clientForm.extraText, company: clientForm.company }),
      })
      const data = await res.json()
      setAnalysis(data.analysis || {})
    } catch { setAnalysis({}) }
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
        method: 'POST', headers: { 'Content-Type': 'application/json' },
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
    } catch (e) { console.error(e); alert('Erro inesperado ao criar briefing') }
    setLoading(false)
  }

  async function copyLink() {
    await navigator.clipboard.writeText(generatedLink)
    setCopied(true); setTimeout(() => setCopied(false), 2000)
  }

  const filteredClients = existingClients.filter(c =>
    !clientSearch || [c.company, c.name, c.email].some(v => v?.toLowerCase().includes(clientSearch.toLowerCase()))
  )

  const inputLabel = (label: string) => (
    <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-2)', textTransform: 'uppercase', letterSpacing: '0.08em', display: 'block', marginBottom: 6 }}>{label}</label>
  )

  const stepLabels = clientId
    ? [{ key: 'type', label: '1. Tipo' }, { key: 'preview', label: '2. Link' }]
    : showNewClientForm
    ? [{ key: 'select', label: '1. Cliente' }, { key: 'client', label: '2. Dados' }, { key: 'type', label: '3. Tipo' }, { key: 'preview', label: '4. Link' }]
    : [{ key: 'select', label: '1. Cliente' }, { key: 'type', label: '2. Tipo' }, { key: 'preview', label: '3. Link' }]

  if (loading && step === 'type' && clientId) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}><div className="spinner" /></div>
  )

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      <header style={{ borderBottom: '1px solid var(--border)', padding: '0 24px', display: 'flex', alignItems: 'center', gap: 14, height: 58, position: 'sticky', top: 0, background: 'rgba(10,10,10,0.92)', backdropFilter: 'blur(10px)', zIndex: 10 }}>
        <button onClick={() => {
          if (step === 'client') { setStep('select'); setShowNewClientForm(false) }
          else if (step === 'type' && !clientId) { showNewClientForm ? setStep('client') : setStep('select') }
          else if (step === 'preview') setStep('type')
          else clientId ? router.push(`/admin/clientes/${clientId}`) : router.push('/admin')
        }} style={{ background: 'none', border: 'none', color: 'var(--text-3)', cursor: 'pointer', fontSize: 18 }}>←</button>
        <span style={{ fontWeight: 700, fontSize: 16, letterSpacing: '-0.02em' }}>
          <span style={{ color: 'var(--accent)' }}>Bnny</span> Labs{' '}
          <span style={{ color: 'var(--text-3)', fontWeight: 400 }}>
            {clientId && clientForm.company ? `/ ${clientForm.company} / ` : '/ '}Novo Briefing
          </span>
        </span>
      </header>

      {/* Progress */}
      <div style={{ borderBottom: '1px solid var(--border)', padding: '0 24px', display: 'flex', gap: 0 }}>
        {stepLabels.map(s => (
          <div key={s.key} style={{ padding: '12px 0', marginRight: 24, fontSize: 13, fontWeight: 500, borderBottom: `2px solid ${step === s.key ? 'var(--accent)' : 'transparent'}`, color: step === s.key ? 'var(--text)' : 'var(--text-3)', marginBottom: -1 }}>
            {s.label}
          </div>
        ))}
      </div>

      <div style={{ maxWidth: 600, margin: '36px auto', padding: '0 24px' }}>

        {/* STEP: select client */}
        {step === 'select' && !showNewClientForm && (
          <div className="animate-in">
            <h2 style={{ fontSize: 21, fontWeight: 700, marginBottom: 6, letterSpacing: '-0.02em' }}>Para qual cliente?</h2>
            <p style={{ color: 'var(--text-2)', fontSize: 14, marginBottom: 24 }}>Selecione um cliente existente ou crie um novo.</p>

            {/* Search existing */}
            <input value={clientSearch} onChange={e => setClientSearch(e.target.value)}
              placeholder="🔍  Buscar por empresa ou nome..."
              autoFocus style={{ marginBottom: 12 }} />

            {/* Client list */}
            {loadingClients ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
                {[1,2,3].map(i => (
                  <div key={i} style={{ background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 10, padding: '14px 16px' }}>
                    <div className="skeleton" style={{ height: 14, width: '40%', marginBottom: 8 }} />
                    <div className="skeleton" style={{ height: 11, width: '60%' }} />
                  </div>
                ))}
              </div>
            ) : filteredClients.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16, maxHeight: 320, overflowY: 'auto' }}>
                {filteredClients.map(c => (
                  <button key={c.id} onClick={() => selectExistingClient(c)}
                    style={{ background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 10, padding: '14px 16px', cursor: 'pointer', textAlign: 'left', transition: 'all 0.15s', display: 'flex', alignItems: 'center', gap: 12 }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--accent-border)'; e.currentTarget.style.background = 'var(--bg-3)' }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.background = 'var(--bg-2)' }}>
                    <div style={{ width: 36, height: 36, borderRadius: 9, background: 'var(--accent-dim)', border: '1px solid var(--accent-border)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, fontWeight: 700, color: 'var(--accent)', flexShrink: 0 }}>
                      {c.company?.[0]?.toUpperCase() || '?'}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {c.company}
                        {c.analysis && Object.keys(c.analysis).length > 0 && <span style={{ marginLeft: 6, fontSize: 11 }} title="Perfil IA disponível">🤖</span>}
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--text-3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {c.name}{c.email && ` · ${c.email}`}
                      </div>
                    </div>
                    <span style={{ color: 'var(--text-3)', fontSize: 18, flexShrink: 0 }}>›</span>
                  </button>
                ))}
              </div>
            ) : clientSearch ? (
              <div style={{ padding: '20px 0', textAlign: 'center', color: 'var(--text-3)', fontSize: 14, marginBottom: 16 }}>
                Nenhum cliente encontrado para &ldquo;{clientSearch}&rdquo;
              </div>
            ) : (
              <div style={{ padding: '20px 0', textAlign: 'center', color: 'var(--text-3)', fontSize: 14, marginBottom: 16 }}>
                Nenhum cliente cadastrado ainda
              </div>
            )}

            {/* Divider */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
              <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
              <span style={{ fontSize: 12, color: 'var(--text-3)', flexShrink: 0 }}>ou</span>
              <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
            </div>

            <button onClick={() => { setShowNewClientForm(true); setStep('client') }}
              style={{ width: '100%', background: 'transparent', color: 'var(--text-2)', fontWeight: 600, padding: '13px', borderRadius: 10, border: '1px solid var(--border)', cursor: 'pointer', fontFamily: 'inherit', fontSize: 14, transition: 'all 0.15s' }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--accent-border)'; e.currentTarget.style.color = 'var(--accent)' }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-2)' }}>
              + Criar novo cliente
            </button>
          </div>
        )}

        {/* STEP: new client form */}
        {step === 'client' && showNewClientForm && (
          <form onSubmit={handleAnalyze} className="animate-in">
            <h2 style={{ fontSize: 21, fontWeight: 700, marginBottom: 6, letterSpacing: '-0.02em' }}>Novo cliente</h2>
            <p style={{ color: 'var(--text-2)', fontSize: 14, marginBottom: 26 }}>Preencha os dados. O Claude vai analisar o site automaticamente.</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>{inputLabel('Nome do contato *')}<input value={clientForm.name} onChange={e => setClientForm(p => ({ ...p, name: e.target.value }))} placeholder="João Silva" required /></div>
                <div>{inputLabel('Empresa *')}<input value={clientForm.company} onChange={e => setClientForm(p => ({ ...p, company: e.target.value }))} placeholder="Nome da empresa" required /></div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>{inputLabel('Email')}<input type="email" value={clientForm.email} onChange={e => setClientForm(p => ({ ...p, email: e.target.value }))} placeholder="email@empresa.com" /></div>
                <div>{inputLabel('WhatsApp')}<input value={clientForm.phone} onChange={e => setClientForm(p => ({ ...p, phone: e.target.value }))} placeholder="(47) 99999-9999" /></div>
              </div>
              <div>{inputLabel('Site do cliente')}<input value={clientForm.website} onChange={e => setClientForm(p => ({ ...p, website: e.target.value }))} placeholder="https://empresa.com.br" /></div>
              <div>{inputLabel('Informações extras (opcional)')}<textarea value={clientForm.extraText} onChange={e => setClientForm(p => ({ ...p, extraText: e.target.value }))} placeholder="Cole aqui qualquer informação adicional sobre o cliente..." style={{ minHeight: 80 }} /></div>
              {clientForm.email && (
                <div style={{ padding: '12px 16px', background: 'var(--accent-dim)', border: '1px solid var(--accent-border)', borderRadius: 10, fontSize: 13, color: 'var(--text-2)', display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontSize: 20, lineHeight: 1 }}>📨</span>
                  <span>O briefing será enviado automaticamente para <strong style={{ color: 'var(--text)' }}>{clientForm.email}</strong></span>
                </div>
              )}
              <button type="submit" disabled={loading || !clientForm.company}
                style={{ background: 'var(--accent)', color: '#000', fontWeight: 700, padding: '13px', borderRadius: 10, border: 'none', cursor: loading ? 'not-allowed' : 'pointer', fontSize: 14, opacity: loading ? 0.7 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
                {loading ? <><div className="spinner" /> Analisando com IA...</> : '✦ Analisar e continuar'}
              </button>
            </div>
          </form>
        )}

        {/* STEP: type */}
        {step === 'type' && (
          <div className="animate-in">
            {/* Client summary */}
            {clientForm.company && (
              <div style={{ background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 10, padding: '12px 16px', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 32, height: 32, borderRadius: 8, background: 'var(--accent-dim)', border: '1px solid var(--accent-border)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 700, color: 'var(--accent)', flexShrink: 0 }}>
                  {clientForm.company[0].toUpperCase()}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>{clientForm.company}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-3)' }}>{clientForm.name}{clientForm.email && ` · ${clientForm.email}`}</div>
                </div>
                {analysis && Object.keys(analysis).length > 0 && (
                  <span title="Perfil IA disponível — campos serão preenchidos automaticamente" style={{ fontSize: 18 }}>🤖</span>
                )}
                <button onClick={() => setStep(showNewClientForm ? 'client' : 'select')}
                  style={{ fontSize: 12, padding: '4px 10px', borderRadius: 6, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-3)', cursor: 'pointer', flexShrink: 0 }}>Trocar</button>
              </div>
            )}

            {/* AI profile summary */}
            {analysis && Object.keys(analysis).length > 0 && (
              <div style={{ background: 'var(--bg-2)', border: '1px solid var(--accent-border)', borderRadius: 12, padding: 18, marginBottom: 20 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>✦ Perfil IA — campos pré-preenchidos automaticamente</div>
                <div style={{ fontSize: 14, lineHeight: 1.6 }}>{String(analysis.description || '')}</div>
                {analysis.target_audience ? <div style={{ marginTop: 8, fontSize: 13, color: 'var(--text-2)' }}><strong style={{ color: 'var(--text-3)' }}>Público: </strong>{String(analysis.target_audience)}</div> : null}
                {analysis.differentials ? <div style={{ marginTop: 6, fontSize: 13, color: 'var(--text-2)' }}><strong style={{ color: 'var(--text-3)' }}>Diferenciais: </strong>{String(analysis.differentials)}</div> : null}
              </div>
            )}

            <h2 style={{ fontSize: 21, fontWeight: 700, marginBottom: 6, letterSpacing: '-0.02em' }}>Tipo de briefing</h2>
            <p style={{ color: 'var(--text-2)', fontSize: 14, marginBottom: 16 }}>Escolha o serviço que será desenvolvido.</p>

            {/* Language toggle */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 20, padding: '12px 16px', background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 10 }}>
              <span style={{ fontSize: 13, color: 'var(--text-2)', flex: 1 }}>🌐 Idioma do briefing para o cliente</span>
              <div style={{ display: 'flex', gap: 6 }}>
                <button onClick={() => setLanguage('pt-BR')} style={{ fontSize: 12, padding: '5px 12px', borderRadius: 6, border: `1px solid ${language === 'pt-BR' ? 'var(--accent-border)' : 'var(--border)'}`, background: language === 'pt-BR' ? 'var(--accent-dim)' : 'transparent', color: language === 'pt-BR' ? 'var(--accent)' : 'var(--text-3)', cursor: 'pointer', fontFamily: 'inherit', fontWeight: language === 'pt-BR' ? 700 : 400 }}>🇧🇷 Português</button>
                <button onClick={() => setLanguage('en-US')} style={{ fontSize: 12, padding: '5px 12px', borderRadius: 6, border: `1px solid ${language === 'en-US' ? 'var(--accent-border)' : 'var(--border)'}`, background: language === 'en-US' ? 'var(--accent-dim)' : 'transparent', color: language === 'en-US' ? 'var(--accent)' : 'var(--text-3)', cursor: 'pointer', fontFamily: 'inherit', fontWeight: language === 'en-US' ? 700 : 400 }}>🇺🇸 English</button>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20 }}>
              {(Object.keys(BRIEFING_TEMPLATES) as BriefingType[]).map(type => {
                const t = getTemplate(type, language)
                return (
                  <button key={type} onClick={() => setSelectedType(type)}
                    style={{ background: selectedType === type ? 'var(--accent-dim)' : 'var(--bg-2)', border: `1px solid ${selectedType === type ? 'var(--accent-border)' : 'var(--border)'}`, borderRadius: 10, padding: '14px 18px', cursor: 'pointer', textAlign: 'left', transition: 'all 0.15s' }}>
                    <div style={{ fontWeight: 600, fontSize: 15, color: selectedType === type ? 'var(--accent)' : 'var(--text)' }}>{t.label}</div>
                    <div style={{ fontSize: 13, color: 'var(--text-3)', marginTop: 3 }}>{t.description}</div>
                  </button>
                )
              })}
            </div>

            {/* Extra note */}
            <div style={{ marginBottom: 20 }}>
              <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-2)', textTransform: 'uppercase', letterSpacing: '0.08em', display: 'block', marginBottom: 6 }}>Observação interna (opcional)</label>
              <textarea value={extraNote} onChange={e => setExtraNote(e.target.value)}
                placeholder="Contexto específico deste briefing — ex: reunião dia X, foco em produto Y, preferências do cliente..." style={{ minHeight: 72 }} />
              <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 5 }}>Visível só para você no painel — não aparece para o cliente.</div>
            </div>

            <button onClick={handleCreate} disabled={!selectedType || loading}
              style={{ width: '100%', background: 'var(--accent)', color: '#000', fontWeight: 700, padding: '13px', borderRadius: 10, border: 'none', cursor: !selectedType || loading ? 'not-allowed' : 'pointer', fontSize: 14, opacity: !selectedType || loading ? 0.6 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
              {loading ? <><div className="spinner" /> Gerando briefing...</> : 'Gerar e enviar briefing →'}
            </button>
          </div>
        )}

        {/* STEP: preview */}
        {step === 'preview' && (
          <div className="animate-in" style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 52, marginBottom: 14 }}>🎉</div>
            <h2 style={{ fontSize: 23, fontWeight: 700, marginBottom: 8, letterSpacing: '-0.02em' }}>Briefing criado!</h2>
            <p style={{ color: 'var(--text-2)', fontSize: 14, marginBottom: 28 }}>
              Pronto para <strong style={{ color: 'var(--text)' }}>{clientForm.name}</strong> da <strong style={{ color: 'var(--text)' }}>{clientForm.company}</strong>
            </p>

            {clientForm.email && (
              <div style={{ marginBottom: 20, padding: '12px 18px', borderRadius: 10, background: emailSent ? 'rgba(200,255,0,0.08)' : 'rgba(255,100,100,0.08)', border: `1px solid ${emailSent ? 'var(--accent-border)' : 'rgba(255,100,100,0.3)'}`, fontSize: 13, color: emailSent ? 'var(--accent)' : '#ff6464' }}>
                {emailSent ? `✅ Email enviado para ${clientForm.email}` : `⚠️ Email não enviado — copie e envie o link manualmente`}
              </div>
            )}

            <div style={{ background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 12, padding: '14px 18px', marginBottom: 14, textAlign: 'left' }}>
              <div style={{ fontSize: 11, color: 'var(--text-3)', marginBottom: 6 }}>Link do briefing</div>
              <div style={{ fontFamily: 'monospace', fontSize: 13, color: 'var(--accent)', wordBreak: 'break-all' }}>{generatedLink}</div>
            </div>

            <div style={{ display: 'flex', gap: 10, marginBottom: 10 }}>
              <button onClick={copyLink} style={{ flex: 1, background: 'var(--accent)', color: '#000', fontWeight: 700, padding: '12px', borderRadius: 10, border: 'none', cursor: 'pointer', fontSize: 14 }}>
                {copied ? '✓ Copiado!' : '📋 Copiar link'}
              </button>
              <button onClick={() => clientForm.id ? router.push(`/admin/clientes/${clientForm.id}`) : router.push('/admin')}
                style={{ flex: 1, background: 'transparent', color: 'var(--text-2)', fontWeight: 500, padding: '12px', borderRadius: 10, border: '1px solid var(--border)', cursor: 'pointer', fontSize: 14 }}>
                {clientForm.id ? 'Ver cliente' : 'Ver painel'}
              </button>
            </div>
            <button onClick={() => router.push('/admin')} style={{ width: '100%', background: 'transparent', color: 'var(--text-3)', fontWeight: 400, padding: '10px', borderRadius: 10, border: '1px solid var(--border)', cursor: 'pointer', fontSize: 13 }}>
              Ir para o painel
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

export default function NovoBriefingPage() {
  return (
    <Suspense fallback={<div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}><div className="spinner" /></div>}>
      <NovoBriefingContent />
    </Suspense>
  )
}
