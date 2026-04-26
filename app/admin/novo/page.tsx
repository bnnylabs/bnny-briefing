'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { BRIEFING_TEMPLATES, BriefingType } from '@/lib/briefing-types'
import { Suspense } from 'react'

interface ClientData {
  id?: string; name: string; company: string; website: string
  email: string; phone: string; extraText: string
  analysis?: Record<string, unknown> | null
}

type Step = 'client' | 'type' | 'preview'

function NovoBriefingContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const clientId = searchParams.get('client_id')

  const [step, setStep] = useState<Step>(clientId ? 'type' : 'client')
  const [loading, setLoading] = useState(false)
  const [clientForm, setClientForm] = useState<ClientData>({ name: '', company: '', website: '', email: '', phone: '', extraText: '' })
  const [analysis, setAnalysis] = useState<Record<string, unknown> | null>(null)
  const [selectedType, setSelectedType] = useState<BriefingType | null>(null)
  const [generatedLink, setGeneratedLink] = useState('')
  const [emailSent, setEmailSent] = useState(false)
  const [copied, setCopied] = useState(false)
  const [extraNote, setExtraNote] = useState('')

  // Load existing client when client_id param is present
  const loadClient = useCallback(async () => {
    if (!clientId) return
    setLoading(true)
    const res = await fetch(`/api/admin/clients/${clientId}`)
    if (res.ok) {
      const d = await res.json()
      const c = d.client
      setClientForm({
        id: c.id, name: c.name, company: c.company,
        website: c.website || '', email: c.email || '',
        phone: c.phone || '', extraText: '',
        analysis: c.analysis || null,
      })
      if (c.analysis) setAnalysis(c.analysis)
      setStep('type')
    }
    setLoading(false)
  }, [clientId])

  useEffect(() => { loadClient() }, [loadClient])

  async function handleAnalyze(e: React.FormEvent) {
    e.preventDefault()
    if (!clientForm.company) return
    setLoading(true)
    try {
      const res = await fetch('/api/analyze', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ website: clientForm.website, text: clientForm.extraText }),
      })
      const data = await res.json()
      setAnalysis(data.analysis || {})
      setStep('type')
    } catch {
      setAnalysis({})
      setStep('type')
    }
    setLoading(false)
  }

  async function handleCreate() {
    if (!selectedType) return
    setLoading(true)
    const template = BRIEFING_TEMPLATES[selectedType]
    const ai = analysis || clientForm.analysis || {}
    const prefilled: Record<string, unknown> = {}

    // ── Direct field mappings (AI key → briefing field id) ──────────────
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

    // ── Smart price_positioning matching ────────────────────────────────
    if (ai.price_positioning) {
      const p = String(ai.price_positioning).toLowerCase()
      if (p.includes('premium') || p.includes('alto')) prefilled.price_positioning = 'Premium / Alto padrão'
      else if (p.includes('intermediário') || p.includes('intermediario') || p.includes('custo')) prefilled.price_positioning = 'Intermediário'
      else if (p.includes('acess') || p.includes('popular')) prefilled.price_positioning = 'Acessível / Popular'
      else prefilled.price_positioning = ai.price_positioning
    }

    // ── Smart brand_personality matching (string → array of options) ─────
    if (ai.brand_personality) {
      const optionsMap: Record<string, string> = {
        moderna: 'Moderna', moderna_: 'Moderna', classica: 'Clássica', clássica: 'Clássica',
        ousada: 'Ousada', elegante: 'Elegante', divertida: 'Divertida', séria: 'Séria',
        seria: 'Séria', minimalista: 'Minimalista', sofisticada: 'Sofisticada',
        acessível: 'Acessível', acessivel: 'Acessível', tecnológica: 'Tecnológica',
        tecnologica: 'Tecnológica', humana: 'Humana', sustentável: 'Sustentável',
        sustentavel: 'Sustentável', inovadora: 'Moderna', criativa: 'Ousada',
        profissional: 'Séria', jovem: 'Divertida', luxo: 'Sofisticada',
      }
      const raw = String(ai.brand_personality)
      const words = raw.split(/[,\s]+/).map(w => w.trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, ''))
      const matched = [...new Set(words.map(w => optionsMap[w]).filter(Boolean))]
      if (matched.length > 0) prefilled.brand_personality = matched
    }

    // ── Smart tone_of_voice → brand_tone / content_tone matching ─────────
    if (ai.tone_of_voice) {
      const t = String(ai.tone_of_voice).toLowerCase()
      let tone = ''
      if (t.includes('formal') || t.includes('institucional')) tone = 'Formal e institucional'
      else if (t.includes('próximo') || t.includes('proximo') || t.includes('profissional')) tone = 'Profissional mas próximo'
      else if (t.includes('descontraído') || t.includes('descontraido') || t.includes('jovem')) tone = 'Descontraído e jovem'
      else if (t.includes('técnico') || t.includes('tecnico') || t.includes('especialista')) tone = 'Técnico e especialista'
      if (tone) { prefilled.brand_tone = tone; prefilled.content_tone = tone }
    }

    // ── Client contact data auto-fill ─────────────────────────────────────
    if (clientForm.name)  prefilled.responsible_name  = clientForm.name
    if (clientForm.email) prefilled.responsible_email = clientForm.email
    if (clientForm.phone) prefilled.responsible_phone = clientForm.phone

    try {
      const res = await fetch('/api/briefings', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client: { ...clientForm, analysis: ai },
          briefingType: selectedType,
          briefingTypeLabel: template.label,
          prefilledData: prefilled,
          internalNotes: extraNote || null,
          sendEmail: !!clientForm.email,
        }),
      })
      const data = await res.json()
      setGeneratedLink(data.link)
      setEmailSent(data.emailSent)
      setStep('preview')
    } catch (e) { console.error(e) }
    setLoading(false)
  }

  async function copyLink() {
    await navigator.clipboard.writeText(generatedLink)
    setCopied(true); setTimeout(() => setCopied(false), 2000)
  }

  const inputLabel = (label: string) => (
    <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-2)', textTransform: 'uppercase', letterSpacing: '0.08em', display: 'block', marginBottom: 6 }}>{label}</label>
  )

  const stepLabels = clientId
    ? [{ key: 'type', label: '1. Tipo' }, { key: 'preview', label: '2. Link' }]
    : [{ key: 'client', label: '1. Cliente' }, { key: 'type', label: '2. Tipo' }, { key: 'preview', label: '3. Link' }]

  if (loading && step === 'client') return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>
      <div className="spinner" />
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      <header style={{ borderBottom: '1px solid var(--border)', padding: '0 24px', display: 'flex', alignItems: 'center', gap: 14, height: 58 }}>
        <button onClick={() => clientId ? router.push(`/admin/clientes/${clientId}`) : router.push('/admin')}
          style={{ background: 'none', border: 'none', color: 'var(--text-3)', cursor: 'pointer', fontSize: 18 }}>←</button>
        <span style={{ fontWeight: 700, fontSize: 16, letterSpacing: '-0.02em' }}>
          <span style={{ color: 'var(--accent)' }}>Bnny</span> Labs{' '}
          <span style={{ color: 'var(--text-3)', fontWeight: 400 }}>
            / {clientId && clientForm.company ? clientForm.company + ' / ' : ''}Novo Briefing
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

        {/* STEP: client (only when no client_id) */}
        {step === 'client' && !clientId && (
          <form onSubmit={handleAnalyze} className="animate-in">
            <h2 style={{ fontSize: 21, fontWeight: 700, marginBottom: 6, letterSpacing: '-0.02em' }}>Informações do cliente</h2>
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
              <div>{inputLabel('Informações extras (opcional)')}<textarea value={clientForm.extraText} onChange={e => setClientForm(p => ({ ...p, extraText: e.target.value }))} placeholder="Cole aqui qualquer informação adicional sobre o cliente..." style={{ minHeight: 90 }} /></div>
              {clientForm.email && (
                <div style={{ padding: '12px 16px', background: 'var(--accent-dim)', border: '1px solid var(--accent-border)', borderRadius: 10, fontSize: 13, color: 'var(--text-2)', display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontSize: 20, lineHeight: 1 }}>📨</span>
                  <span>O briefing será enviado automaticamente para <strong style={{ color: 'var(--text)' }}>{clientForm.email}</strong></span>
                </div>
              )}
              <button type="submit" disabled={loading || !clientForm.company}
                style={{ background: 'var(--accent)', color: '#000', fontWeight: 700, padding: '13px', borderRadius: 10, border: 'none', cursor: loading ? 'not-allowed' : 'pointer', fontSize: 14, opacity: loading ? 0.7 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
                {loading ? <><div className="spinner" /> Analisando com IA...</> : '✦ Analisar cliente e continuar'}
              </button>
            </div>
          </form>
        )}

        {/* STEP: type */}
        {step === 'type' && (
          <div className="animate-in">
            {/* Client summary when coming from client profile */}
            {clientId && clientForm.company && (
              <div style={{ background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 10, padding: '12px 16px', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 32, height: 32, borderRadius: 8, background: 'var(--accent-dim)', border: '1px solid var(--accent-border)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 700, color: 'var(--accent)', flexShrink: 0 }}>
                  {clientForm.company[0].toUpperCase()}
                </div>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>{clientForm.company}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-3)' }}>{clientForm.name}{clientForm.email && ` · ${clientForm.email}`}</div>
                </div>
                {analysis && Object.keys(analysis).length > 0 && (
                  <span title="Perfil IA disponível" style={{ marginLeft: 'auto', fontSize: 18 }}>🤖</span>
                )}
              </div>
            )}

            {/* AI analysis summary (when analysis exists) */}
            {analysis && Object.keys(analysis).length > 0 && (
              <div style={{ background: 'var(--bg-2)', border: '1px solid var(--accent-border)', borderRadius: 12, padding: 18, marginBottom: 20 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>✦ Perfil IA do cliente</div>
                <div style={{ fontSize: 14, lineHeight: 1.6 }}>{String(analysis.description || '')}</div>
                {analysis.target_audience ? <div style={{ marginTop: 8, fontSize: 13, color: 'var(--text-2)' }}><strong style={{ color: 'var(--text-3)' }}>Público: </strong>{String(analysis.target_audience)}</div> : null}
                {analysis.differentials ? <div style={{ marginTop: 6, fontSize: 13, color: 'var(--text-2)' }}><strong style={{ color: 'var(--text-3)' }}>Diferenciais: </strong>{String(analysis.differentials)}</div> : null}
              </div>
            )}

            <h2 style={{ fontSize: 21, fontWeight: 700, marginBottom: 6, letterSpacing: '-0.02em' }}>Tipo de briefing</h2>
            <p style={{ color: 'var(--text-2)', fontSize: 14, marginBottom: 20 }}>Escolha o serviço que será desenvolvido.</p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20 }}>
              {(Object.keys(BRIEFING_TEMPLATES) as BriefingType[]).map(type => {
                const t = BRIEFING_TEMPLATES[type]
                return (
                  <button key={type} onClick={() => setSelectedType(type)}
                    style={{ background: selectedType === type ? 'var(--accent-dim)' : 'var(--bg-2)', border: `1px solid ${selectedType === type ? 'var(--accent-border)' : 'var(--border)'}`, borderRadius: 10, padding: '14px 18px', cursor: 'pointer', textAlign: 'left', transition: 'all 0.15s' }}>
                    <div style={{ fontWeight: 600, fontSize: 15, color: selectedType === type ? 'var(--accent)' : 'var(--text)' }}>{t.label}</div>
                    <div style={{ fontSize: 13, color: 'var(--text-3)', marginTop: 3 }}>{t.description}</div>
                  </button>
                )
              })}
            </div>

            {/* Extra note field */}
            <div style={{ marginBottom: 20 }}>
              <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-2)', textTransform: 'uppercase', letterSpacing: '0.08em', display: 'block', marginBottom: 6 }}>
                Observação interna (opcional)
              </label>
              <textarea value={extraNote} onChange={e => setExtraNote(e.target.value)}
                placeholder="Contexto específico deste briefing — ex: cliente quer foco em produto X, reunião marcada para dia Y, preferência por cores escuras..."
                style={{ minHeight: 80 }} />
              <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 5 }}>Visível só para você no painel. Ajuda o Claude a personalizar melhor as sugestões.</div>
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
              <button onClick={() => clientId ? router.push(`/admin/clientes/${clientId}`) : router.push('/admin')}
                style={{ flex: 1, background: 'transparent', color: 'var(--text-2)', fontWeight: 500, padding: '12px', borderRadius: 10, border: '1px solid var(--border)', cursor: 'pointer', fontSize: 14 }}>
                {clientId ? 'Ver cliente' : 'Ver painel'}
              </button>
            </div>
            {clientId && (
              <button onClick={() => router.push('/admin')} style={{ width: '100%', background: 'transparent', color: 'var(--text-3)', fontWeight: 400, padding: '10px', borderRadius: 10, border: '1px solid var(--border)', cursor: 'pointer', fontSize: 13 }}>
                Ir para o painel
              </button>
            )}
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
