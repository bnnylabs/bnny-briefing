'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams } from 'next/navigation'
import { CheckCircle2, Lock, Pencil, Mail, Clock } from 'lucide-react'
import { getTemplate, BriefingType, BriefingField, FieldCondition } from '@/lib/briefing-types'
import { BrandLogo } from '@/components/brand/BrandLogo'

interface BriefingData {
  id: string; slug: string; type: BriefingType; type_label: string; status: string
  prefilled_data: Record<string, unknown>
  language?: string
  canEdit?: boolean
  editing_expires_at?: string
  editing_locked?: boolean
  clients: { name: string; company: string; website: string }
}


function fieldVisible(field: BriefingField, answers: Record<string, unknown>): boolean {
  if (!field.condition) return true
  const { field: depField, values } = field.condition as FieldCondition
  const current = answers[depField]
  if (Array.isArray(current)) return (current as string[]).some(v => values.includes(v))
  return values.includes(String(current || ''))
}

function FieldInput({ field, value, prefilled, onChange }: {
  field: BriefingField; value: unknown; prefilled: boolean; onChange: (val: unknown) => void
}) {
  const baseInput = {
    background: prefilled ? 'rgba(200,255,0,0.04)' : 'var(--bg-3)',
    border: `1px solid ${prefilled ? 'var(--accent-border)' : 'var(--border)'}`,
    color: 'var(--text)', borderRadius: 10, padding: '12px 14px',
    fontFamily: 'inherit', fontSize: 16, width: '100%', outline: 'none',
    WebkitAppearance: 'none' as const, appearance: 'none' as const,
  }

  if (field.type === 'radio' && field.options) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {field.options.map(opt => (
          <label key={opt} style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer', padding: '12px 14px', borderRadius: 10, border: `1px solid ${value === opt ? 'var(--accent-border)' : 'var(--border)'}`, background: value === opt ? 'var(--accent-dim)' : 'var(--bg-3)', transition: 'all 0.15s', minHeight: 48 }}>
            <input type="radio" name={field.id} value={opt} checked={value === opt} onChange={() => onChange(opt)} style={{ accentColor: 'var(--accent)', width: 18, height: 18, flexShrink: 0 }} />
            <span style={{ fontSize: 15, color: value === opt ? 'var(--accent)' : 'var(--text)', lineHeight: 1.4 }}>{opt}</span>
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
              style={{ padding: '9px 14px', borderRadius: 999, fontSize: 14, cursor: 'pointer', border: `1px solid ${selected ? 'var(--accent-border)' : 'var(--border)'}`, background: selected ? 'var(--accent-dim)' : 'var(--bg-3)', color: selected ? 'var(--accent)' : 'var(--text-2)', transition: 'all 0.15s', fontFamily: 'inherit', minHeight: 40 }}>
              {selected ? '✓ ' : ''}{opt}
            </button>
          )
        })}
      </div>
    )
  }

  if (field.type === 'textarea') {
    return <textarea value={String(value || '')} onChange={e => onChange(e.target.value)} placeholder={field.placeholder} style={{ ...baseInput, minHeight: 100, resize: 'vertical' }} />
  }

  if (field.type === 'file') {
    const files: File[] = Array.isArray(value) ? (value as File[]).filter(v => v instanceof File) : []
    return (
      <div>
        <label style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '20px 16px', border: '2px dashed var(--border-2)', borderRadius: 12, cursor: 'pointer', background: 'var(--bg-3)', transition: 'border-color 0.2s', minHeight: 80 }}>
          <input type="file" multiple accept="image/*,.pdf,.doc,.docx,.ppt,.pptx,.ai,.eps,.svg" style={{ display: 'none' }}
            onChange={e => { const newFiles = Array.from(e.target.files || []); onChange([...files, ...newFiles]) }} />
          <div style={{ fontSize: 24 }}>📎</div>
          <div style={{ fontSize: 14, color: 'var(--text-2)', textAlign: 'center' }}>Toque para anexar arquivos</div>
          <div style={{ fontSize: 12, color: 'var(--text-3)' }}>Imagens, PDFs, documentos · máx. 10MB cada</div>
        </label>
        {files.length > 0 && (
          <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
            {files.map((f, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: 'var(--bg-3)', borderRadius: 10, border: '1px solid var(--border)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0, flex: 1 }}>
                  <span style={{ fontSize: 18 }}>{f.type.startsWith('image/') ? '🖼️' : '📄'}</span>
                  <span style={{ fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.name}</span>
                  <span style={{ fontSize: 11, color: 'var(--text-3)', flexShrink: 0 }}>{(f.size / 1024).toFixed(0)}kb</span>
                </div>
                <button type="button" onClick={() => onChange(files.filter((_, fi) => fi !== i))}
                  style={{ background: 'none', border: 'none', color: 'var(--text-3)', cursor: 'pointer', fontSize: 20, padding: '0 4px', flexShrink: 0 }}>×</button>
              </div>
            ))}
          </div>
        )}
      </div>
    )
  }

  return <input type="text" value={String(value || '')} onChange={e => onChange(e.target.value)} placeholder={field.placeholder} style={baseInput} />
}

export default function BriefingFormPage() {
  const params = useParams()
  const slug = params.slug as string
  const [briefing, setBriefing] = useState<BriefingData | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [answers, setAnswers] = useState<Record<string, unknown>>({})
  const [submitting, setSubmitting] = useState(false)
  const [uploadProgress, setUploadProgress] = useState<string>('')
  const [submitted, setSubmitted] = useState(false)
  const [isUpdate, setIsUpdate] = useState(false)
  const [editingMode, setEditingMode] = useState(false)
  const [previousAnswers, setPreviousAnswers] = useState<Record<string, unknown>>({})
  const [currentSection, setCurrentSection] = useState(0)
  const [started, setStarted] = useState(false)

  const loadBriefing = useCallback(async () => {
    const res = await fetch(`/api/briefings/${slug}`)
    if (res.ok) {
      const data = await res.json()
      const b = data.briefing
      setBriefing(b)
      // If already completed, load previous answers
      if (b.status === 'concluido') {
        const rRes = await fetch(`/api/briefings/${slug}/responses`)
        if (rRes.ok) {
          const rData = await rRes.json()
          const prevAnswers = rData.answers || {}
          setPreviousAnswers(prevAnswers)
          setAnswers(prevAnswers)
          setSubmitted(true)
        }
      } else {
        setAnswers(b.prefilled_data || {})
      }
    } else setNotFound(true)
    setLoading(false)
  }, [slug])

  useEffect(() => { loadBriefing() }, [loadBriefing])

  useEffect(() => {
    if (briefing && Object.keys(answers).length > 0 && !submitted && !started) {
      setStarted(true)
      fetch(`/api/briefings/${slug}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: 'em_andamento', started_at: new Date().toISOString() }) }).catch(() => {})
    }
  }, [answers, briefing, slug, submitted, started])

  async function handleSubmit() {
    if (!briefing) return
    setSubmitting(true)
    const isEN = briefing.language === 'en-US'

    // Upload all File objects to Supabase Storage
    const serializableAnswers: Record<string, unknown> = {}
    const fileFields = Object.entries(answers).filter(
      ([, v]) => Array.isArray(v) && v.length > 0 && v[0] instanceof File
    )

    for (const [k, files] of fileFields) {
      const uploadedUrls: { url: string; name: string; size: number; type: string }[] = []
      for (const file of files as File[]) {
        setUploadProgress(isEN ? `Uploading ${file.name}...` : `Enviando ${file.name}...`)
        const fd = new FormData()
        fd.append('file', file)
        fd.append('slug', slug)
        fd.append('fieldId', k)
        try {
          const res = await fetch('/api/upload', { method: 'POST', body: fd })
          if (res.ok) {
            const data = await res.json()
            uploadedUrls.push({ url: data.url, name: data.name, size: data.size, type: data.type })
          } else {
            // Fallback: store filename if upload fails
            uploadedUrls.push({ url: '', name: file.name, size: file.size, type: file.type })
          }
        } catch {
          uploadedUrls.push({ url: '', name: file.name, size: file.size, type: file.type })
        }
      }
      serializableAnswers[k] = uploadedUrls
    }

    setUploadProgress('')

    // Copy non-file answers
    for (const [k, v] of Object.entries(answers)) {
      if (!(Array.isArray(v) && v.length > 0 && v[0] instanceof File)) {
        serializableAnswers[k] = v
      }
    }

    try {
      const res2 = await fetch(`/api/briefings/${slug}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ answers: serializableAnswers, isUpdate }),
      })
      if (res2.ok) {
        const submitData = await res2.json()
        setPreviousAnswers(serializableAnswers)
        setEditingMode(false)
        setIsUpdate(false)
        // Update briefing state with new editing window
        if (!isUpdate && submitData.editingExpiresAt) {
          setBriefing(prev => prev ? {
            ...prev,
            canEdit: true,
            editing_expires_at: submitData.editingExpiresAt,
            editing_locked: false,
            status: 'concluido'
          } : prev)
        }
        setSubmitted(true)
      }
    } catch (e) { console.error(e) }
    setSubmitting(false)
  }

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: 'var(--bg)' }}>
      <div className="spinner" />
    </div>
  )

  if (notFound) return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', background: 'var(--bg)', textAlign: 'center', padding: '0 24px' }}>
      <div style={{ fontSize: 48, marginBottom: 16 }}>🔍</div>
      <h1 style={{ fontSize: 20, fontWeight: 700, marginBottom: 8 }}>Briefing não encontrado</h1>
      <p style={{ color: 'var(--text-2)', fontSize: 14 }}>O link pode ter expirado ou estar incorreto.</p>
    </div>
  )

  if (!briefing) return null
  const template = getTemplate(briefing.type, (briefing.language as 'pt-BR' | 'en-US') || 'pt-BR')
  if (!template) return null

  if (submitted && !editingMode) {
    const isEN = briefing?.language === 'en-US'
    const canEdit = briefing?.canEdit
    const editingExpires = briefing?.editing_expires_at
    const hoursLeft = editingExpires
      ? Math.max(0, Math.round((new Date(editingExpires).getTime() - Date.now()) / 3600000))
      : null
    const clientName = briefing?.clients?.name || ''

    // Visual identity matches the admin app + transactional emails:
    // logo on top, single card with neutral palette, lime reserved for
    // the primary edit action only. No decorative emojis — semantic
    // icons where they add meaning.
    return (
      <div style={{ minHeight: '100vh', background: 'var(--bg-3)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-start', padding: '40px 20px 60px' }}>
        {/* Brand logo — anchors the page and links visually to the app/email */}
        <div style={{ marginBottom: 36 }}>
          <BrandLogo className="h-7 w-auto" />
        </div>

        {/* Main card */}
        <div style={{ width: '100%', maxWidth: 480, background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 16, padding: '36px 32px', textAlign: 'center', boxShadow: '0 1px 2px rgba(0,0,0,0.03)' }}>
          {/* Success indicator — small, semantic, not a 64px emoji */}
          <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 44, height: 44, borderRadius: 12, background: 'rgba(22, 163, 74, 0.1)', color: '#16a34a', marginBottom: 18 }}>
            <CheckCircle2 size={22} strokeWidth={2} />
          </div>

          <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 10, letterSpacing: '-0.02em', color: 'var(--text)', lineHeight: 1.2 }}>
            {isEN ? 'Briefing submitted' : 'Briefing enviado'}
          </h1>

          <p style={{ color: 'var(--text-2)', fontSize: 15, lineHeight: 1.6, margin: '0 auto', maxWidth: 380 }}>
            {isEN ? 'Thank you, ' : 'Obrigado, '}
            <strong style={{ color: 'var(--text)' }}>{clientName}</strong>!{' '}
            {isEN
              ? 'The Bnny Labs team will review your answers and get in touch soon.'
              : 'A equipe da Bnny Labs vai analisar suas respostas e em breve entrará em contato.'}
          </p>
        </div>

        {/* Editing window card — primary action when applicable */}
        {canEdit && hoursLeft !== null && hoursLeft > 0 && (
          <div style={{ marginTop: 12, width: '100%', maxWidth: 480, background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 16, padding: '20px 24px' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 14 }}>
              <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 32, height: 32, borderRadius: 8, background: 'var(--bg-3)', color: 'var(--text-2)', flexShrink: 0 }}>
                <Clock size={15} strokeWidth={1.75} />
              </div>
              <div style={{ flex: 1, textAlign: 'left' }}>
                <div style={{ fontSize: 14, color: 'var(--text)', fontWeight: 600, marginBottom: 3, lineHeight: 1.3 }}>
                  {isEN ? `${hoursLeft}h to review your answers` : `${hoursLeft}h para revisar suas respostas`}
                </div>
                <div style={{ fontSize: 13, color: 'var(--text-2)', lineHeight: 1.5 }}>
                  {isEN ? 'You can update your answers during this period.' : 'Você pode atualizar suas respostas durante este período.'}
                </div>
              </div>
            </div>
            <button
              onClick={() => { setEditingMode(true); setIsUpdate(true); setCurrentSection(0) }}
              style={{ width: '100%', background: '#a3e635', color: '#0a0a0a', fontWeight: 600, padding: '12px', borderRadius: 8, border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 14, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6, transition: 'transform 0.05s' }}
            >
              <Pencil size={14} strokeWidth={2} />
              {isEN ? 'Edit my answers' : 'Editar minhas respostas'}
            </button>
          </div>
        )}

        {/* Editing window expired */}
        {canEdit && (hoursLeft === null || hoursLeft === 0) && (
          <div style={{ marginTop: 12, width: '100%', maxWidth: 480, background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 16, padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 12 }}>
            <Clock size={16} strokeWidth={1.75} style={{ color: 'var(--text-3)', flexShrink: 0 }} />
            <span style={{ fontSize: 13, color: 'var(--text-2)', lineHeight: 1.5, textAlign: 'left' }}>
              {isEN ? 'The 48h editing period has expired. Contact us if you need to change something.' : 'O período de edição de 48h expirou. Entre em contato se precisar alterar algo.'}
            </span>
          </div>
        )}

        {/* Editing locked */}
        {!canEdit && briefing?.editing_locked && (
          <div style={{ marginTop: 12, width: '100%', maxWidth: 480, background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 16, padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 12 }}>
            <Lock size={16} strokeWidth={1.75} style={{ color: 'var(--text-3)', flexShrink: 0 }} />
            <span style={{ fontSize: 13, color: 'var(--text-2)', lineHeight: 1.5, textAlign: 'left' }}>
              {isEN ? 'Editing is currently locked. Contact us to request changes.' : 'Edição bloqueada. Entre em contato se precisar alterar algo.'}
            </span>
          </div>
        )}

        {/* Confirmation email note — quiet, last */}
        <div style={{ marginTop: 12, width: '100%', maxWidth: 480, padding: '12px 20px', display: 'flex', alignItems: 'center', gap: 10, justifyContent: 'center' }}>
          <Mail size={13} strokeWidth={1.75} style={{ color: 'var(--text-3)', flexShrink: 0 }} />
          <span style={{ fontSize: 12, color: 'var(--text-3)', lineHeight: 1.5 }}>
            {isEN ? 'A confirmation email is on the way.' : 'Um email de confirmação está a caminho.'}
          </span>
        </div>
      </div>
    )
  }

  const sections = template.sections
  const totalSections = sections.length
  const isLastSection = currentSection === totalSections - 1

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      {/* Header */}
      <header style={{ borderBottom: '1px solid var(--border)', padding: '0 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 56, position: 'sticky', top: 0, background: 'var(--bg)', zIndex: 10 }}>
        <div style={{ fontWeight: 700, fontSize: 16, letterSpacing: '-0.02em' }}>
          <span style={{ color: 'var(--accent)' }}>Bnny</span> Labs
        </div>
        <div style={{ fontSize: 13, color: 'var(--text-3)' }}>{currentSection + 1} / {totalSections}</div>
      </header>

      {/* Progress bar */}
      <div style={{ height: 3, background: 'var(--border)' }}>
        <div style={{ height: '100%', background: 'var(--accent)', width: `${((currentSection + 1) / totalSections) * 100}%`, transition: 'width 0.4s ease' }} />
      </div>

      <div style={{ maxWidth: 600, margin: '0 auto', padding: '28px 20px 100px' }}>
        {/* Editing mode banner */}
        {editingMode && (
          <div style={{ marginBottom: 20, padding: '12px 16px', background: 'rgba(200,255,0,0.08)', border: '1px solid var(--accent-border)', borderRadius: 10, display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 18 }}>✏️</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--accent)' }}>
                {briefing.language === 'en-US' ? 'Editing mode — update your answers' : 'Modo edição — atualize suas respostas'}
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 2 }}>
                {briefing.language === 'en-US' ? 'Changed fields will be highlighted for our team.' : 'Campos alterados serão destacados para nossa equipe.'}
              </div>
            </div>
            <button onClick={() => { setEditingMode(false); setIsUpdate(false); setAnswers(previousAnswers) }}
              style={{ fontSize: 12, padding: '5px 10px', borderRadius: 6, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-3)', cursor: 'pointer' }}>
              {briefing.language === 'en-US' ? 'Cancel' : 'Cancelar'}
            </button>
          </div>
        )}

        {/* Intro */}
        {currentSection === 0 && (
          <div style={{ marginBottom: 28 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8 }}>{template.label}</div>
            <h1 style={{ fontSize: 24, fontWeight: 700, letterSpacing: '-0.03em', lineHeight: 1.2, marginBottom: 10 }}>Briefing de {template.label}</h1>
            <p style={{ color: 'var(--text-2)', fontSize: 14, lineHeight: 1.7 }}>
              {briefing.language === 'en-US'
                ? <>Hello! We prepared this form for <strong style={{ color: 'var(--text)' }}>{briefing.clients?.company}</strong>. Some fields are pre-filled — feel free to edit.</>
                : <>Olá! Preparamos este formulário para <strong style={{ color: 'var(--text)' }}>{briefing.clients?.company}</strong>. Alguns campos já foram preenchidos — fique à vontade para editar.</>
              }
            </p>
            {Object.values(briefing.prefilled_data || {}).some(v => v) && (
              <div style={{ marginTop: 14, padding: '12px 14px', background: 'rgba(200,255,0,0.06)', border: '1px solid var(--accent-border)', borderRadius: 10, fontSize: 13, color: 'var(--text-2)', lineHeight: 1.5 }}>
                {briefing.language === 'en-US'
                  ? <>✦ Fields in <span style={{ background: 'rgba(200,255,0,0.1)', color: 'var(--accent)', fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 999 }}>green</span> were pre-filled automatically. Confirm or edit.</>
                  : <>✦ Campos em <span style={{ background: 'rgba(200,255,0,0.1)', color: 'var(--accent)', fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 999 }}>verde</span> foram preenchidos automaticamente. Confirme ou edite.</>
                }
              </div>
            )}
          </div>
        )}

        {/* Section */}
        <div className="animate-in" key={currentSection}>
          <h2 style={{ fontSize: 17, fontWeight: 700, marginBottom: 22, letterSpacing: '-0.01em', paddingBottom: 14, borderBottom: '1px solid var(--border)' }}>
            {sections[currentSection].title}
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            {sections[currentSection].fields.filter(field => fieldVisible(field, answers)).map(field => {
              const isPrefilled = field.id in (briefing.prefilled_data || {}) && !!briefing.prefilled_data[field.id]
              const isAutoFilled = isPrefilled && answers[field.id] === briefing.prefilled_data[field.id]
              return (
                <div key={field.id}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8, gap: 8 }}>
                    <label style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', lineHeight: 1.4 }}>
                      {field.label}{field.required && <span style={{ color: 'var(--accent)', marginLeft: 4 }}>*</span>}
                    </label>
                    {isAutoFilled && (
                      <span style={{ fontSize: 10, color: 'var(--accent)', fontWeight: 700, background: 'rgba(200,255,0,0.08)', padding: '2px 8px', borderRadius: 999, border: '1px solid var(--accent-border)', flexShrink: 0, whiteSpace: 'nowrap' }}>AUTO</span>
                    )}
                  </div>
                  {field.hint && <div style={{ fontSize: 12, color: 'var(--text-3)', marginBottom: 8, lineHeight: 1.5 }}>{field.hint}</div>}
                  <FieldInput field={field} value={answers[field.id]} prefilled={isAutoFilled} onChange={val => setAnswers(p => ({ ...p, [field.id]: val }))} />
                </div>
              )
            })}
          </div>
        </div>

        {/* Navigation */}
        <div style={{ display: 'flex', gap: 12, marginTop: 36, position: 'fixed', bottom: 0, left: 0, right: 0, padding: '16px 20px', background: 'var(--bg)', borderTop: '1px solid var(--border)', maxWidth: 600, margin: '0 auto' }}>
          {currentSection > 0 && (
            <button onClick={() => { setCurrentSection(p => p - 1); window.scrollTo(0, 0) }}
              style={{ flex: 1, padding: '14px', borderRadius: 12, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-2)', cursor: 'pointer', fontFamily: 'inherit', fontSize: 15, fontWeight: 500 }}>← Anterior</button>
          )}
          {!isLastSection ? (
            <button onClick={() => { setCurrentSection(p => p + 1); window.scrollTo(0, 0) }}
              style={{ flex: 1, padding: '14px', borderRadius: 12, border: 'none', background: 'var(--accent)', color: '#000', cursor: 'pointer', fontFamily: 'inherit', fontSize: 15, fontWeight: 700 }}>Próximo →</button>
          ) : (
            <button onClick={handleSubmit} disabled={submitting}
              style={{ flex: 1, padding: '14px', borderRadius: 12, border: 'none', background: submitting ? 'var(--bg-3)' : 'var(--accent)', color: submitting ? 'var(--text-2)' : '#000', cursor: submitting ? 'not-allowed' : 'pointer', fontFamily: 'inherit', fontSize: 15, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
              {submitting ? <><div className="spinner" /> Enviando...</> : briefing.language === 'en-US' ? '✓ Submit briefing' : '✓ Concluir briefing'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
