'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams } from 'next/navigation'
import { BRIEFING_TEMPLATES, BriefingType, BriefingField } from '@/lib/briefing-types'

interface BriefingData {
  id: string
  slug: string
  type: BriefingType
  type_label: string
  status: string
  prefilled_data: Record<string, unknown>
  clients: {
    name: string
    company: string
    website: string
  }
}

function FieldInput({ field, value, prefilled, onChange }: {
  field: BriefingField
  value: unknown
  prefilled: boolean
  onChange: (val: unknown) => void
}) {
  const [editing, setEditing] = useState(!prefilled)

  const inputStyle = {
    background: prefilled && !editing ? 'rgba(200,255,0,0.04)' : 'var(--bg-3)',
    border: `1px solid ${prefilled && !editing ? 'var(--accent-border)' : 'var(--border)'}`,
    color: 'var(--text)', borderRadius: 8, padding: '10px 14px',
    fontFamily: 'inherit', fontSize: 14, width: '100%', outline: 'none', transition: 'all 0.2s',
  }

  if (field.type === 'radio' && field.options) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {field.options.map(opt => (
          <label key={opt} style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', padding: '10px 14px', borderRadius: 8, border: `1px solid ${value === opt ? 'var(--accent-border)' : 'var(--border)'}`, background: value === opt ? 'var(--accent-dim)' : 'var(--bg-3)', transition: 'all 0.15s' }}>
            <input type="radio" name={field.id} value={opt} checked={value === opt} onChange={() => onChange(opt)} style={{ accentColor: 'var(--accent)', width: 'auto' }} />
            <span style={{ fontSize: 14, color: value === opt ? 'var(--accent)' : 'var(--text)' }}>{opt}</span>
          </label>
        ))}
      </div>
    )
  }

  if (field.type === 'multiselect' && field.options) {
    const vals: string[] = Array.isArray(value) ? (value as string[]) : []
    return (
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {field.options.map(opt => {
          const selected = vals.includes(opt)
          return (
            <button key={opt} type="button"
              onClick={() => onChange(selected ? vals.filter(v => v !== opt) : [...vals, opt])}
              style={{ padding: '7px 14px', borderRadius: 999, fontSize: 13, cursor: 'pointer', border: `1px solid ${selected ? 'var(--accent-border)' : 'var(--border)'}`, background: selected ? 'var(--accent-dim)' : 'var(--bg-3)', color: selected ? 'var(--accent)' : 'var(--text-2)', transition: 'all 0.15s', fontFamily: 'inherit' }}>
              {selected ? '✓ ' : ''}{opt}
            </button>
          )
        })}
      </div>
    )
  }

  if (field.type === 'textarea') {
    return (
      <textarea value={String(value || '')} onChange={e => { onChange(e.target.value); setEditing(true) }} placeholder={field.placeholder} style={{ ...inputStyle, minHeight: 90, resize: 'vertical' }} />
    )
  }

  if (field.type === 'file') {
    const files: File[] = Array.isArray(value) ? (value as File[]) : []
    return (
      <div>
        <label style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '20px', border: '2px dashed var(--border-2)', borderRadius: 10, cursor: 'pointer', background: 'var(--bg-3)', transition: 'border-color 0.2s' }}
          onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--accent-border)')}
          onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border-2)')}
        >
          <input type="file" multiple accept="image/*,.pdf,.doc,.docx,.ppt,.pptx" style={{ display: 'none' }}
            onChange={e => {
              const newFiles = Array.from(e.target.files || [])
              onChange([...files, ...newFiles])
            }}
          />
          <div style={{ fontSize: 24 }}>📎</div>
          <div style={{ fontSize: 13, color: 'var(--text-2)', textAlign: 'center' }}>Clique para anexar arquivos</div>
          <div style={{ fontSize: 11, color: 'var(--text-3)' }}>Imagens, PDFs, documentos</div>
        </label>
        {files.length > 0 && (
          <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 6 }}>
            {files.map((f, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', background: 'var(--bg-3)', borderRadius: 8, border: '1px solid var(--border)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                  <span style={{ fontSize: 16 }}>{f.type.startsWith('image/') ? '🖼️' : '📄'}</span>
                  <span style={{ fontSize: 13, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.name}</span>
                  <span style={{ fontSize: 11, color: 'var(--text-3)', flexShrink: 0 }}>{(f.size / 1024).toFixed(0)}kb</span>
                </div>
                <button type="button" onClick={() => onChange(files.filter((_, fi) => fi !== i))}
                  style={{ background: 'none', border: 'none', color: 'var(--text-3)', cursor: 'pointer', fontSize: 16, padding: '0 4px', flexShrink: 0 }}>×</button>
              </div>
            ))}
          </div>
        )}
      </div>
    )
  }

  return (
    <input type="text" value={String(value || '')} onChange={e => { onChange(e.target.value); setEditing(true) }} placeholder={field.placeholder} style={inputStyle} />
  )
}

export default function BriefingFormPage() {
  const params = useParams()
  const slug = params.slug as string

  const [briefing, setBriefing] = useState<BriefingData | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [answers, setAnswers] = useState<Record<string, unknown>>({})
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [currentSection, setCurrentSection] = useState(0)
  const [started, setStarted] = useState(false)

  const loadBriefing = useCallback(async () => {
    const res = await fetch(`/api/briefings/${slug}`)
    if (res.ok) {
      const data = await res.json()
      setBriefing(data.briefing)
      setAnswers(data.briefing.prefilled_data || {})
    } else {
      setNotFound(true)
    }
    setLoading(false)
  }, [slug])

  useEffect(() => { loadBriefing() }, [loadBriefing])

  useEffect(() => {
    if (briefing && Object.keys(answers).length > 0 && !submitted && !started) {
      setStarted(true)
      fetch(`/api/briefings/${slug}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'em_andamento', started_at: new Date().toISOString() }),
      }).catch(() => {})
    }
  }, [answers, briefing, slug, submitted, started])

  async function handleSubmit() {
    if (!briefing) return
    setSubmitting(true)
    try {
      await fetch(`/api/briefings/${slug}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ answers }),
      })
      setSubmitted(true)
    } catch (e) { console.error(e) }
    setSubmitting(false)
  }

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: 'var(--bg)' }}>
      <div className="spinner" />
    </div>
  )

  if (notFound) return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', background: 'var(--bg)', textAlign: 'center' }}>
      <div style={{ fontSize: 48, marginBottom: 16 }}>🔍</div>
      <h1 style={{ fontSize: 20, fontWeight: 700, marginBottom: 8 }}>Briefing não encontrado</h1>
      <p style={{ color: 'var(--text-2)', fontSize: 14 }}>O link pode ter expirado ou estar incorreto.</p>
    </div>
  )

  if (!briefing) return null
  const template = BRIEFING_TEMPLATES[briefing.type]
  if (!template) return null

  if (submitted) return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: 'var(--bg)', textAlign: 'center', padding: 24 }}>
      <div style={{ fontSize: 56, marginBottom: 20 }}>✅</div>
      <h1 style={{ fontSize: 26, fontWeight: 700, marginBottom: 10, letterSpacing: '-0.02em' }}>Briefing enviado!</h1>
      <p style={{ color: 'var(--text-2)', fontSize: 15, maxWidth: 400, lineHeight: 1.6 }}>
        Obrigado, <strong style={{ color: 'var(--text)' }}>{String(answers.responsible_name || briefing.clients?.name || '')}</strong>! Recebemos seu briefing e em breve a equipe da <strong style={{ color: 'var(--accent)' }}>Bnny Labs</strong> entrará em contato.
      </p>
    </div>
  )

  const sections = template.sections
  const totalSections = sections.length
  const isLastSection = currentSection === totalSections - 1

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      <header style={{ borderBottom: '1px solid var(--border)', padding: '0 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 58 }}>
        <div style={{ fontWeight: 700, fontSize: 16, letterSpacing: '-0.02em' }}>
          <span style={{ color: 'var(--accent)' }}>Bnny</span> Labs
        </div>
        <div style={{ fontSize: 13, color: 'var(--text-3)', fontVariantNumeric: 'tabular-nums' }}>{currentSection + 1} / {totalSections}</div>
      </header>

      <div style={{ height: 2, background: 'var(--border)' }}>
        <div style={{ height: '100%', background: 'var(--accent)', width: `${((currentSection + 1) / totalSections) * 100}%`, transition: 'width 0.4s ease' }} />
      </div>

      <div style={{ maxWidth: 640, margin: '0 auto', padding: '40px 24px 80px' }}>
        {currentSection === 0 && (
          <div style={{ marginBottom: 32 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8 }}>{template.label}</div>
            <h1 style={{ fontSize: 26, fontWeight: 700, letterSpacing: '-0.03em', lineHeight: 1.2, marginBottom: 10 }}>Briefing de {template.label}</h1>
            <p style={{ color: 'var(--text-2)', fontSize: 14, lineHeight: 1.6 }}>
              Olá! Preparamos este formulário para entender melhor o projeto de{' '}
              <strong style={{ color: 'var(--text)' }}>{briefing.clients?.company}</strong>.
              Alguns campos já foram preenchidos automaticamente — fique à vontade para editar qualquer informação.
            </p>
            {Object.values(briefing.prefilled_data || {}).some(v => v) && (
              <div style={{ marginTop: 14, padding: '10px 14px', background: 'rgba(200,255,0,0.06)', border: '1px solid var(--accent-border)', borderRadius: 8, fontSize: 13, color: 'var(--text-2)' }}>
                ✦ Campos com a etiqueta <span style={{ background: 'rgba(200,255,0,0.1)', color: 'var(--accent)', fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 999 }}>AUTO</span> foram preenchidos automaticamente. Confirme ou edite.
              </div>
            )}
          </div>
        )}

        <div className="animate-in" key={currentSection}>
          <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 24, letterSpacing: '-0.01em', paddingBottom: 14, borderBottom: '1px solid var(--border)' }}>
            {sections[currentSection].title}
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
            {sections[currentSection].fields.map(field => {
              const isPrefilled = field.id in (briefing.prefilled_data || {}) && !!briefing.prefilled_data[field.id]
              return (
                <div key={field.id}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                    <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>
                      {field.label}{field.required && <span style={{ color: 'var(--accent)', marginLeft: 4 }}>*</span>}
                    </label>
                    {isPrefilled && answers[field.id] === briefing.prefilled_data[field.id] && (
                      <span style={{ fontSize: 10, color: 'var(--accent)', fontWeight: 700, background: 'rgba(200,255,0,0.08)', padding: '2px 8px', borderRadius: 999, letterSpacing: '0.06em', border: '1px solid var(--accent-border)', flexShrink: 0, marginLeft: 8 }}>AUTO</span>
                    )}
                  </div>
                  {field.hint && <div style={{ fontSize: 12, color: 'var(--text-3)', marginBottom: 8 }}>{field.hint}</div>}
                  <FieldInput field={field} value={answers[field.id]} prefilled={isPrefilled && answers[field.id] === briefing.prefilled_data[field.id]} onChange={val => setAnswers(p => ({ ...p, [field.id]: val }))} />
                </div>
              )
            })}
          </div>
        </div>

        <div style={{ display: 'flex', gap: 12, marginTop: 36 }}>
          {currentSection > 0 && (
            <button onClick={() => setCurrentSection(p => p - 1)} style={{ flex: 1, padding: '13px', borderRadius: 10, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-2)', cursor: 'pointer', fontFamily: 'inherit', fontSize: 14, fontWeight: 500 }}>← Anterior</button>
          )}
          {!isLastSection ? (
            <button onClick={() => setCurrentSection(p => p + 1)} style={{ flex: 1, padding: '13px', borderRadius: 10, border: 'none', background: 'var(--accent)', color: '#000', cursor: 'pointer', fontFamily: 'inherit', fontSize: 14, fontWeight: 700 }}>Próximo →</button>
          ) : (
            <button onClick={handleSubmit} disabled={submitting} style={{ flex: 1, padding: '13px', borderRadius: 10, border: 'none', background: submitting ? 'var(--bg-3)' : 'var(--accent)', color: submitting ? 'var(--text-2)' : '#000', cursor: submitting ? 'not-allowed' : 'pointer', fontFamily: 'inherit', fontSize: 14, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
              {submitting ? <><div className="spinner" /> Enviando...</> : '✓ Concluir e enviar briefing'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
