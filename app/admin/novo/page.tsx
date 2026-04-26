'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { BRIEFING_TEMPLATES, BriefingType } from '@/lib/briefing-types'

type Step = 'client' | 'analyze' | 'type' | 'preview'

export default function NovoBriefingPage() {
  const router = useRouter()
  const [step, setStep] = useState<Step>('client')
  const [loading, setLoading] = useState(false)

  // Client form
  const [clientForm, setClientForm] = useState({ name: '', company: '', website: '', email: '', phone: '', extraText: '' })

  // Analysis result
  const [analysis, setAnalysis] = useState<Record<string, unknown> | null>(null)

  // Briefing type
  const [selectedType, setSelectedType] = useState<BriefingType | null>(null)

  // Generated link
  const [generatedLink, setGeneratedLink] = useState('')
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

    // Build prefilled data from analysis
    const prefilled: Record<string, unknown> = {}
    if (analysis) {
      if (analysis.company_name) prefilled.company_name = analysis.company_name
      if (analysis.segment) prefilled.segment = analysis.segment
      if (analysis.description) prefilled.description = analysis.description
      if (analysis.differentials) prefilled.differentials = analysis.differentials
      if (analysis.target_audience) prefilled.target_audience = analysis.target_audience
      if (analysis.brand_personality) prefilled.brand_personality = analysis.brand_personality
      if (analysis.price_positioning) prefilled.price_positioning = analysis.price_positioning
      if (analysis.tone_of_voice) prefilled.tone_of_voice = analysis.tone_of_voice
      if (analysis.extra_notes) prefilled.extra_notes = analysis.extra_notes
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
        }),
      })
      const data = await res.json()
      setGeneratedLink(data.link)
      setStep('preview')
    } catch (e) {
      console.error(e)
    }
    setLoading(false)
  }

  async function copyLink() {
    await navigator.clipboard.writeText(generatedLink)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      {/* Header */}
      <header style={{ borderBottom: '1px solid var(--border)', padding: '0 32px', display: 'flex', alignItems: 'center', gap: 16, height: 60 }}>
        <button onClick={() => router.push('/admin')} style={{ background: 'none', border: 'none', color: 'var(--text-3)', cursor: 'pointer', fontSize: 18, padding: 4 }}>←</button>
        <span style={{ fontWeight: 700, fontSize: 16, letterSpacing: '-0.02em' }}>
          <span style={{ color: 'var(--accent)' }}>Bnny</span> Labs <span style={{ color: 'var(--text-3)', fontWeight: 400 }}>/ Novo Briefing</span>
        </span>
      </header>

      {/* Progress */}
      <div style={{ borderBottom: '1px solid var(--border)', padding: '0 32px', display: 'flex', gap: 0 }}>
        {[
          { key: 'client', label: '1. Cliente' },
          { key: 'type', label: '2. Tipo' },
          { key: 'preview', label: '3. Link' },
        ].map(s => (
          <div key={s.key} style={{ padding: '12px 0', marginRight: 28, fontSize: 13, fontWeight: 500, borderBottom: `2px solid ${['client', 'analyze'].includes(step) && s.key === 'client' ? 'var(--accent)' : step === s.key ? 'var(--accent)' : 'transparent'}`, color: step === s.key || (s.key === 'client' && ['client', 'analyze'].includes(step)) ? 'var(--text)' : 'var(--text-3)', marginBottom: -1 }}>
            {s.label}
          </div>
        ))}
      </div>

      <div style={{ maxWidth: 620, margin: '40px auto', padding: '0 24px' }}>

        {/* Step 1: Client Info */}
        {(step === 'client' || step === 'analyze') && (
          <form onSubmit={handleAnalyze} className="animate-in">
            <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 6, letterSpacing: '-0.02em' }}>Informações do cliente</h2>
            <p style={{ color: 'var(--text-2)', fontSize: 14, marginBottom: 28 }}>Preencha os dados básicos. O Claude vai analisar o site automaticamente.</p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-2)', textTransform: 'uppercase', letterSpacing: '0.08em', display: 'block', marginBottom: 6 }}>Nome do contato *</label>
                  <input value={clientForm.name} onChange={e => setClientForm(p => ({ ...p, name: e.target.value }))} placeholder="João Silva" required />
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-2)', textTransform: 'uppercase', letterSpacing: '0.08em', display: 'block', marginBottom: 6 }}>Empresa *</label>
                  <input value={clientForm.company} onChange={e => setClientForm(p => ({ ...p, company: e.target.value }))} placeholder="Nome da empresa" required />
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-2)', textTransform: 'uppercase', letterSpacing: '0.08em', display: 'block', marginBottom: 6 }}>Email</label>
                  <input type="email" value={clientForm.email} onChange={e => setClientForm(p => ({ ...p, email: e.target.value }))} placeholder="email@empresa.com" />
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-2)', textTransform: 'uppercase', letterSpacing: '0.08em', display: 'block', marginBottom: 6 }}>WhatsApp</label>
                  <input value={clientForm.phone} onChange={e => setClientForm(p => ({ ...p, phone: e.target.value }))} placeholder="(47) 99999-9999" />
                </div>
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-2)', textTransform: 'uppercase', letterSpacing: '0.08em', display: 'block', marginBottom: 6 }}>Site do cliente</label>
                <input value={clientForm.website} onChange={e => setClientForm(p => ({ ...p, website: e.target.value }))} placeholder="https://empresa.com.br" />
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-2)', textTransform: 'uppercase', letterSpacing: '0.08em', display: 'block', marginBottom: 6 }}>Informações extras (opcional)</label>
                <textarea value={clientForm.extraText} onChange={e => setClientForm(p => ({ ...p, extraText: e.target.value }))} placeholder="Cole aqui qualquer informação adicional sobre o cliente — proposta, apresentação, anotações da reunião..." style={{ minHeight: 100 }} />
              </div>
              <button type="submit" disabled={loading || !clientForm.company}
                style={{ background: 'var(--accent)', color: '#000', fontWeight: 700, padding: '13px', borderRadius: 10, border: 'none', cursor: loading ? 'not-allowed' : 'pointer', fontSize: 14, opacity: loading ? 0.7 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
                {loading ? <><div className="spinner" /> Analisando com IA...</> : '✦ Analisar cliente e continuar'}
              </button>
            </div>
          </form>
        )}

        {/* Step 2: Type selection */}
        {step === 'type' && (
          <div className="animate-in">
            {analysis && Object.keys(analysis).length > 0 && (
              <div style={{ background: 'var(--bg-2)', border: '1px solid var(--accent-border)', borderRadius: 12, padding: 20, marginBottom: 28 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12 }}>✦ Análise do Claude</div>
                <div style={{ fontSize: 14, color: 'var(--text)', lineHeight: 1.6 }}>{String(analysis.description || '')}</div>
                {analysis.target_audience ? (
                  <div style={{ marginTop: 10, fontSize: 13, color: 'var(--text-2)' }}>
                    <strong style={{ color: 'var(--text-3)' }}>Público: </strong>{String(analysis.target_audience)}
                  </div>
                ) : null}
                {analysis.differentials ? (
                  <div style={{ marginTop: 6, fontSize: 13, color: 'var(--text-2)' }}>
                    <strong style={{ color: 'var(--text-3)' }}>Diferenciais: </strong>{String(analysis.differentials)}
                  </div>
                ) : null}
              </div>
            )}

            <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 6, letterSpacing: '-0.02em' }}>Tipo de briefing</h2>
            <p style={{ color: 'var(--text-2)', fontSize: 14, marginBottom: 24 }}>Escolha o serviço que será desenvolvido.</p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 28 }}>
              {(Object.keys(BRIEFING_TEMPLATES) as BriefingType[]).map(type => {
                const t = BRIEFING_TEMPLATES[type]
                return (
                  <button key={type} onClick={() => setSelectedType(type)}
                    style={{
                      background: selectedType === type ? 'var(--accent-dim)' : 'var(--bg-2)',
                      border: `1px solid ${selectedType === type ? 'var(--accent-border)' : 'var(--border)'}`,
                      borderRadius: 10, padding: '16px 20px', cursor: 'pointer', textAlign: 'left', transition: 'all 0.15s',
                    }}>
                    <div style={{ fontWeight: 600, fontSize: 15, color: selectedType === type ? 'var(--accent)' : 'var(--text)' }}>{t.label}</div>
                    <div style={{ fontSize: 13, color: 'var(--text-3)', marginTop: 3 }}>{t.description}</div>
                  </button>
                )
              })}
            </div>

            <button onClick={handleCreate} disabled={!selectedType || loading}
              style={{ width: '100%', background: 'var(--accent)', color: '#000', fontWeight: 700, padding: '13px', borderRadius: 10, border: 'none', cursor: !selectedType || loading ? 'not-allowed' : 'pointer', fontSize: 14, opacity: !selectedType || loading ? 0.6 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
              {loading ? <><div className="spinner" /> Gerando briefing...</> : 'Gerar link do briefing →'}
            </button>
          </div>
        )}

        {/* Step 3: Link ready */}
        {step === 'preview' && (
          <div className="animate-in" style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>🎉</div>
            <h2 style={{ fontSize: 24, fontWeight: 700, marginBottom: 8, letterSpacing: '-0.02em' }}>Briefing criado!</h2>
            <p style={{ color: 'var(--text-2)', fontSize: 14, marginBottom: 32 }}>
              Envie o link abaixo para <strong style={{ color: 'var(--text)' }}>{clientForm.name}</strong> da <strong style={{ color: 'var(--text)' }}>{clientForm.company}</strong>
            </p>

            <div style={{ background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 12, padding: '16px 20px', marginBottom: 16, textAlign: 'left' }}>
              <div style={{ fontSize: 12, color: 'var(--text-3)', marginBottom: 6 }}>Link do briefing</div>
              <div style={{ fontFamily: 'DM Mono, monospace', fontSize: 13, color: 'var(--accent)', wordBreak: 'break-all' }}>{generatedLink}</div>
            </div>

            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={copyLink}
                style={{ flex: 1, background: 'var(--accent)', color: '#000', fontWeight: 700, padding: '12px', borderRadius: 10, border: 'none', cursor: 'pointer', fontSize: 14 }}>
                {copied ? '✓ Copiado!' : '📋 Copiar link'}
              </button>
              <button onClick={() => router.push('/admin')}
                style={{ flex: 1, background: 'transparent', color: 'var(--text-2)', fontWeight: 500, padding: '12px', borderRadius: 10, border: '1px solid var(--border)', cursor: 'pointer', fontSize: 14 }}>
                Ver todos os briefings
              </button>
            </div>

            <div style={{ marginTop: 24, padding: 16, background: 'rgba(200,255,0,0.05)', border: '1px solid var(--accent-border)', borderRadius: 10 }}>
              <div style={{ fontSize: 12, color: 'var(--text-2)', lineHeight: 1.6 }}>
                💡 Os campos do formulário já vêm <strong style={{ color: 'var(--text)' }}>pré-preenchidos</strong> com base na análise do Claude. O cliente pode editar qualquer campo antes de enviar.
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
