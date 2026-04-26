'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { BRIEFING_TEMPLATES, BriefingType } from '@/lib/briefing-types'

type Step = 'client' | 'type' | 'preview'

export default function NovoBriefingPage() {
  const router = useRouter()
  const [step, setStep] = useState<Step>('client')
  const [loading, setLoading] = useState(false)
  const [clientForm, setClientForm] = useState({ name: '', company: '', website: '', email: '', phone: '', extraText: '' })
  const [analysis, setAnalysis] = useState<Record<string, unknown> | null>(null)
  const [selectedType, setSelectedType] = useState<BriefingType | null>(null)
  const [generatedLink, setGeneratedLink] = useState('')
  const [emailSent, setEmailSent] = useState(false)
  const [copied, setCopied] = useState(false)

  async function handleAnalyze(e: React.FormEvent) {
    e.preventDefault()
    if (!clientForm.company) return
    setLoading(true)
    try {
      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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
    const prefilled: Record<string, unknown> = {}
    if (analysis) {
      if (analysis.company_name) prefilled.company_name = analysis.company_name
      if (analysis.segment) prefilled.segment = analysis.segment
      if (analysis.description) prefilled.description = analysis.description
      if (analysis.differentials) prefilled.differentials = analysis.differentials
      if (analysis.target_audience) prefilled.target_audience = analysis.target_audience
      if (analysis.brand_personality) prefilled.brand_personality = analysis.brand_personality
      if (analysis.price_positioning) prefilled.price_positioning = analysis.price_positioning
    }
    try {
      const res = await fetch('/api/briefings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client: { ...clientForm, analysis },
          briefingType: selectedType,
          briefingTypeLabel: template.label,
          prefilledData: prefilled,
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

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      <header style={{ borderBottom: '1px solid var(--border)', padding: '0 24px', display: 'flex', alignItems: 'center', gap: 14, height: 58 }}>
        <button onClick={() => router.push('/admin')} style={{ background: 'none', border: 'none', color: 'var(--text-3)', cursor: 'pointer', fontSize: 18 }}>←</button>
        <span style={{ fontWeight: 700, fontSize: 16, letterSpacing: '-0.02em' }}>
          <span style={{ color: 'var(--accent)' }}>Bnny</span> Labs <span style={{ color: 'var(--text-3)', fontWeight: 400 }}>/ Novo Briefing</span>
        </span>
      </header>

      {/* Progress */}
      <div style={{ borderBottom: '1px solid var(--border)', padding: '0 24px', display: 'flex', gap: 0 }}>
        {[{ key: 'client', label: '1. Cliente' }, { key: 'type', label: '2. Tipo' }, { key: 'preview', label: '3. Link' }].map(s => (
          <div key={s.key} style={{ padding: '12px 0', marginRight: 24, fontSize: 13, fontWeight: 500, borderBottom: `2px solid ${step === s.key ? 'var(--accent)' : 'transparent'}`, color: step === s.key ? 'var(--text)' : 'var(--text-3)', marginBottom: -1 }}>
            {s.label}
          </div>
        ))}
      </div>

      <div style={{ maxWidth: 600, margin: '36px auto', padding: '0 24px' }}>

        {step === 'client' && (
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

        {step === 'type' && (
          <div className="animate-in">
            {analysis && Object.keys(analysis).length > 0 && (
              <div style={{ background: 'var(--bg-2)', border: '1px solid var(--accent-border)', borderRadius: 12, padding: 18, marginBottom: 24 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>✦ Análise do Claude</div>
                <div style={{ fontSize: 14, lineHeight: 1.6 }}>{String(analysis.description || '')}</div>
                {analysis.target_audience ? <div style={{ marginTop: 8, fontSize: 13, color: 'var(--text-2)' }}><strong style={{ color: 'var(--text-3)' }}>Público: </strong>{String(analysis.target_audience)}</div> : null}
                {analysis.differentials ? <div style={{ marginTop: 6, fontSize: 13, color: 'var(--text-2)' }}><strong style={{ color: 'var(--text-3)' }}>Diferenciais: </strong>{String(analysis.differentials)}</div> : null}
              </div>
            )}
            <h2 style={{ fontSize: 21, fontWeight: 700, marginBottom: 6, letterSpacing: '-0.02em' }}>Tipo de briefing</h2>
            <p style={{ color: 'var(--text-2)', fontSize: 14, marginBottom: 20 }}>Escolha o serviço que será desenvolvido.</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 24 }}>
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
            <button onClick={handleCreate} disabled={!selectedType || loading}
              style={{ width: '100%', background: 'var(--accent)', color: '#000', fontWeight: 700, padding: '13px', borderRadius: 10, border: 'none', cursor: !selectedType || loading ? 'not-allowed' : 'pointer', fontSize: 14, opacity: !selectedType || loading ? 0.6 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
              {loading ? <><div className="spinner" /> Gerando briefing...</> : 'Gerar e enviar briefing →'}
            </button>
          </div>
        )}

        {step === 'preview' && (
          <div className="animate-in" style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 52, marginBottom: 14 }}>🎉</div>
            <h2 style={{ fontSize: 23, fontWeight: 700, marginBottom: 8, letterSpacing: '-0.02em' }}>Briefing criado!</h2>
            <p style={{ color: 'var(--text-2)', fontSize: 14, marginBottom: 28 }}>
              Pronto para <strong style={{ color: 'var(--text)' }}>{clientForm.name}</strong> da <strong style={{ color: 'var(--text)' }}>{clientForm.company}</strong>
            </p>

            {/* Email status */}
            {clientForm.email && (
              <div style={{ marginBottom: 20, padding: '12px 18px', borderRadius: 10, background: emailSent ? 'rgba(200,255,0,0.08)' : 'rgba(255,100,100,0.08)', border: `1px solid ${emailSent ? 'var(--accent-border)' : 'rgba(255,100,100,0.3)'}`, fontSize: 13, color: emailSent ? 'var(--accent)' : '#ff6464' }}>
                {emailSent ? `✅ Email enviado para ${clientForm.email}` : `⚠️ Email não enviado — copie e envie o link manualmente`}
              </div>
            )}

            <div style={{ background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 12, padding: '14px 18px', marginBottom: 14, textAlign: 'left' }}>
              <div style={{ fontSize: 11, color: 'var(--text-3)', marginBottom: 6 }}>Link do briefing</div>
              <div style={{ fontFamily: 'monospace', fontSize: 13, color: 'var(--accent)', wordBreak: 'break-all' }}>{generatedLink}</div>
            </div>

            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={copyLink} style={{ flex: 1, background: 'var(--accent)', color: '#000', fontWeight: 700, padding: '12px', borderRadius: 10, border: 'none', cursor: 'pointer', fontSize: 14 }}>
                {copied ? '✓ Copiado!' : '📋 Copiar link'}
              </button>
              <button onClick={() => router.push('/admin')} style={{ flex: 1, background: 'transparent', color: 'var(--text-2)', fontWeight: 500, padding: '12px', borderRadius: 10, border: '1px solid var(--border)', cursor: 'pointer', fontSize: 14 }}>
                Ver painel
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
