'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams } from 'next/navigation'
import { CheckCircle2, Lock, Pencil, Mail, Clock, Paperclip, FileText as FileIcon, Image as ImageIcon, X } from 'lucide-react'
import { getTemplate, BriefingType, BriefingField, FieldCondition } from '@/lib/briefing-types'
import { BrandLogo } from '@/components/brand/BrandLogo'
import { cn } from '@/lib/utils'

// ─────────────────────────────────────────────────────────────────────────
// Public briefing form — the surface clients fill out.
//
// Migrated from inline `style={{ var(--*) }}` to Tailwind tokens. Every
// color now resolves through hsl(var(--primary)) / hsl(var(--background))
// etc, so a brand change touches only globals.css. Spacing and typography
// follow the rest of the admin app's conventions.
// ─────────────────────────────────────────────────────────────────────────

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

// ── Form fields ─────────────────────────────────────────────────────────

const inputBase =
  'w-full rounded-lg border px-3.5 py-3 text-base outline-none ' +
  'transition-colors focus:border-primary/40 focus:ring-2 focus:ring-primary/15 ' +
  'appearance-none [-webkit-appearance:none]'

function FieldInput({ field, value, prefilled, onChange }: {
  field: BriefingField; value: unknown; prefilled: boolean; onChange: (val: unknown) => void
}) {
  const baseColor = prefilled
    ? 'bg-primary/5 border-primary/25 text-foreground'
    : 'bg-muted border-border text-foreground'

  if (field.type === 'radio' && field.options) {
    return (
      <div className="flex flex-col gap-2">
        {field.options.map(opt => {
          const selected = value === opt
          return (
            <label
              key={opt}
              className={cn(
                'flex min-h-[48px] cursor-pointer items-center gap-3 rounded-lg border px-3.5 py-3 transition-colors',
                selected
                  ? 'border-primary/30 bg-primary/10'
                  : 'border-border bg-muted hover:bg-muted/70',
              )}
            >
              <input
                type="radio"
                name={field.id}
                value={opt}
                checked={selected}
                onChange={() => onChange(opt)}
                className="h-[18px] w-[18px] shrink-0 accent-primary"
              />
              <span className={cn('text-[15px] leading-snug', selected ? 'text-primary' : 'text-foreground')}>
                {opt}
              </span>
            </label>
          )
        })}
      </div>
    )
  }

  if (field.type === 'multiselect' && field.options) {
    const vals: string[] = Array.isArray(value) ? (value as string[]) : []
    return (
      <div className="flex flex-wrap gap-2">
        {field.options.map(opt => {
          const selected = vals.includes(opt)
          return (
            <button
              key={opt}
              type="button"
              onClick={() => onChange(selected ? vals.filter(v => v !== opt) : [...vals, opt])}
              className={cn(
                'min-h-[40px] rounded-full border px-3.5 py-2 text-sm transition-colors',
                selected
                  ? 'border-primary/30 bg-primary/10 text-primary'
                  : 'border-border bg-muted text-muted-foreground hover:bg-muted/70',
              )}
            >
              {selected ? '✓ ' : ''}{opt}
            </button>
          )
        })}
      </div>
    )
  }

  if (field.type === 'textarea') {
    return (
      <textarea
        value={String(value || '')}
        onChange={e => onChange(e.target.value)}
        placeholder={field.placeholder}
        className={cn(inputBase, baseColor, 'min-h-[100px] resize-y')}
      />
    )
  }

  if (field.type === 'file') {
    const files: File[] = Array.isArray(value) ? (value as File[]).filter(v => v instanceof File) : []
    return (
      <div>
        <label className="flex min-h-[80px] cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border bg-muted px-4 py-5 transition-colors hover:border-primary/30">
          <input
            type="file"
            multiple
            accept="image/*,.pdf,.doc,.docx,.ppt,.pptx,.ai,.eps,.svg"
            className="hidden"
            onChange={e => { const newFiles = Array.from(e.target.files || []); onChange([...files, ...newFiles]) }}
          />
          <Paperclip className="h-5 w-5 text-muted-foreground" />
          <div className="text-center text-sm text-muted-foreground">Toque para anexar arquivos</div>
          <div className="text-xs text-muted-foreground/70">Imagens, PDFs, documentos · máx. 10MB cada</div>
        </label>
        {files.length > 0 && (
          <div className="mt-2.5 flex flex-col gap-2">
            {files.map((f, i) => (
              <div key={i} className="flex items-center justify-between gap-2 rounded-lg border border-border bg-muted px-3.5 py-2.5">
                <div className="flex min-w-0 flex-1 items-center gap-2">
                  {f.type.startsWith('image/')
                    ? <ImageIcon className="h-4 w-4 shrink-0 text-muted-foreground" />
                    : <FileIcon className="h-4 w-4 shrink-0 text-muted-foreground" />}
                  <span className="truncate text-[13px]">{f.name}</span>
                  <span className="shrink-0 text-[11px] text-muted-foreground/70">{(f.size / 1024).toFixed(0)}kb</span>
                </div>
                <button
                  type="button"
                  onClick={() => onChange(files.filter((_, fi) => fi !== i))}
                  aria-label={`Remover ${f.name}`}
                  className="shrink-0 rounded p-0.5 text-muted-foreground/70 transition-colors hover:bg-muted-foreground/10 hover:text-destructive"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    )
  }

  return (
    <input
      type="text"
      value={String(value || '')}
      onChange={e => onChange(e.target.value)}
      placeholder={field.placeholder}
      className={cn(inputBase, baseColor)}
    />
  )
}

// ── Page ────────────────────────────────────────────────────────────────

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

  // Track link_opened when briefing is first loaded in 'enviado' state
  useEffect(() => {
    if (briefing && briefing.status === 'enviado') {
      fetch(`/api/briefings/${slug}/track`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ event: 'link_opened' }),
      }).catch(() => {})
    }
  }, [briefing, slug])

  useEffect(() => {
    if (briefing && Object.keys(answers).length > 0 && !submitted && !started) {
      setStarted(true)
      fetch(`/api/briefings/${slug}/track`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ event: 'form_started' }),
      }).catch(() => {})
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
    <div className="flex h-screen items-center justify-center bg-background">
      <div className="spinner" />
    </div>
  )

  if (notFound) return (
    <div className="flex h-screen flex-col items-center justify-center bg-background px-6 text-center">
      <div className="mb-2 text-5xl">🔍</div>
      <h1 className="mb-2 text-xl font-bold tracking-tight">Briefing não encontrado</h1>
      <p className="text-sm text-muted-foreground">O link pode ter expirado ou estar incorreto.</p>
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
    // logo on top, single card with neutral palette, primary reserved for
    // the edit action only. No decorative emojis — semantic icons where
    // they add meaning.
    return (
      <div className="flex min-h-screen flex-col items-center bg-muted px-5 pt-10 pb-16">
        {/* Brand logo — anchors the page and links visually to the app/email */}
        <div className="mb-9">
          <BrandLogo className="h-7 w-auto" />
        </div>

        {/* Main card */}
        <div className="w-full max-w-[480px] rounded-2xl border border-border bg-background px-8 py-9 text-center shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
          {/* Success indicator — small, semantic, not a 64px emoji */}
          <div className="mb-4 inline-flex h-11 w-11 items-center justify-center rounded-xl bg-green-600/10 text-green-600">
            <CheckCircle2 className="h-5 w-5" strokeWidth={2} />
          </div>

          <h1 className="mb-2.5 text-[22px] font-bold leading-tight tracking-tight text-foreground">
            {isEN ? 'Briefing submitted' : 'Briefing enviado'}
          </h1>

          <p className="mx-auto max-w-[380px] text-[15px] leading-relaxed text-muted-foreground">
            {isEN ? 'Thank you, ' : 'Obrigado, '}
            <strong className="text-foreground">{clientName}</strong>!{' '}
            {isEN
              ? 'The Bnny Labs team will review your answers and get in touch soon.'
              : 'A equipe da Bnny Labs vai analisar suas respostas e em breve entrará em contato.'}
          </p>
        </div>

        {/* Editing window card — primary action when applicable */}
        {canEdit && hoursLeft !== null && hoursLeft > 0 && (
          <div className="mt-3 w-full max-w-[480px] rounded-2xl border border-border bg-background p-5">
            <div className="mb-3.5 flex items-start gap-3">
              <div className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                <Clock className="h-[15px] w-[15px]" strokeWidth={1.75} />
              </div>
              <div className="flex-1 text-left">
                <div className="mb-0.5 text-sm font-semibold leading-tight text-foreground">
                  {isEN ? `${hoursLeft}h to review your answers` : `${hoursLeft}h para revisar suas respostas`}
                </div>
                <div className="text-[13px] leading-snug text-muted-foreground">
                  {isEN ? 'You can update your answers during this period.' : 'Você pode atualizar suas respostas durante este período.'}
                </div>
              </div>
            </div>
            <button
              onClick={() => { setEditingMode(true); setIsUpdate(true); setCurrentSection(0) }}
              className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-primary px-3 py-3 text-sm font-semibold text-primary-foreground transition-transform active:scale-[0.99]"
            >
              <Pencil className="h-3.5 w-3.5" strokeWidth={2} />
              {isEN ? 'Edit my answers' : 'Editar minhas respostas'}
            </button>
          </div>
        )}

        {/* Editing window expired */}
        {canEdit && (hoursLeft === null || hoursLeft === 0) && (
          <div className="mt-3 flex w-full max-w-[480px] items-center gap-3 rounded-2xl border border-border bg-background px-5 py-4">
            <Clock className="h-4 w-4 shrink-0 text-muted-foreground/70" strokeWidth={1.75} />
            <span className="text-left text-[13px] leading-snug text-muted-foreground">
              {isEN ? 'The 48h editing period has expired. Contact us if you need to change something.' : 'O período de edição de 48h expirou. Entre em contato se precisar alterar algo.'}
            </span>
          </div>
        )}

        {/* Editing locked */}
        {!canEdit && briefing?.editing_locked && (
          <div className="mt-3 flex w-full max-w-[480px] items-center gap-3 rounded-2xl border border-border bg-background px-5 py-4">
            <Lock className="h-4 w-4 shrink-0 text-muted-foreground/70" strokeWidth={1.75} />
            <span className="text-left text-[13px] leading-snug text-muted-foreground">
              {isEN ? 'Editing is currently locked. Contact us to request changes.' : 'Edição bloqueada. Entre em contato se precisar alterar algo.'}
            </span>
          </div>
        )}

        {/* Confirmation email note — quiet, last */}
        <div className="mt-3 flex w-full max-w-[480px] items-center justify-center gap-2.5 px-5 py-3">
          <Mail className="h-3 w-3 shrink-0 text-muted-foreground/70" strokeWidth={1.75} />
          <span className="text-xs leading-snug text-muted-foreground/70">
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
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-10 flex h-14 items-center justify-between border-b border-border bg-background px-5">
        <div className="text-base font-bold tracking-tight">
          <span className="text-primary">Bnny</span> Labs
        </div>
        <div className="text-[13px] text-muted-foreground/70">{currentSection + 1} / {totalSections}</div>
      </header>

      {/* Progress bar */}
      <div className="h-[3px] bg-border">
        <div
          className="h-full bg-primary transition-[width] duration-[400ms] ease-out"
          style={{ width: `${((currentSection + 1) / totalSections) * 100}%` }}
        />
      </div>

      <div className="mx-auto max-w-[600px] px-5 pb-24 pt-7">
        {/* Editing mode banner */}
        {editingMode && (
          <div className="mb-5 flex items-center gap-2.5 rounded-lg border border-primary/25 bg-primary/10 px-4 py-3">
            <Pencil className="h-[18px] w-[18px] shrink-0 text-primary" />
            <div className="flex-1">
              <div className="text-[13px] font-semibold text-primary">
                {briefing.language === 'en-US' ? 'Editing mode — update your answers' : 'Modo edição — atualize suas respostas'}
              </div>
              <div className="mt-0.5 text-xs text-muted-foreground/70">
                {briefing.language === 'en-US' ? 'Changed fields will be highlighted for our team.' : 'Campos alterados serão destacados para nossa equipe.'}
              </div>
            </div>
            <button
              onClick={() => { setEditingMode(false); setIsUpdate(false); setAnswers(previousAnswers) }}
              className="rounded-md border border-border bg-transparent px-2.5 py-1 text-xs text-muted-foreground/70 transition-colors hover:bg-muted hover:text-foreground"
            >
              {briefing.language === 'en-US' ? 'Cancel' : 'Cancelar'}
            </button>
          </div>
        )}

        {/* Intro */}
        {currentSection === 0 && (
          <div className="mb-7">
            <div className="mb-2 text-[11px] font-bold uppercase tracking-[0.1em] text-primary">
              {template.label}
            </div>
            <h1 className="mb-2.5 text-2xl font-bold leading-tight tracking-tight">
              Briefing de {template.label}
            </h1>
            <p className="text-sm leading-relaxed text-muted-foreground">
              {briefing.language === 'en-US'
                ? <>Hello! We prepared this form for <strong className="text-foreground">{briefing.clients?.company}</strong>. Some fields are pre-filled — feel free to edit.</>
                : <>Olá! Preparamos este formulário para <strong className="text-foreground">{briefing.clients?.company}</strong>. Alguns campos já foram preenchidos — fique à vontade para editar.</>
              }
            </p>
            {Object.values(briefing.prefilled_data || {}).some(v => v) && (
              <div className="mt-3.5 rounded-lg border border-primary/25 bg-primary/5 px-3.5 py-3 text-[13px] leading-snug text-muted-foreground">
                {briefing.language === 'en-US'
                  ? <>✦ Fields with the <span className="rounded-full bg-primary/15 px-1.5 py-px text-[10px] font-bold text-primary">AUTO</span> tag were pre-filled automatically. Confirm or edit.</>
                  : <>✦ Campos com a tag <span className="rounded-full bg-primary/15 px-1.5 py-px text-[10px] font-bold text-primary">AUTO</span> foram preenchidos automaticamente. Confirme ou edite.</>
                }
              </div>
            )}
          </div>
        )}

        {/* Section */}
        <div className="animate-in fade-in-0 duration-200" key={currentSection}>
          <h2 className="mb-5 border-b border-border pb-3.5 text-[17px] font-bold tracking-tight">
            {sections[currentSection].title}
          </h2>
          <div className="flex flex-col gap-6">
            {sections[currentSection].fields.filter(field => fieldVisible(field, answers)).map(field => {
              const isPrefilled = field.id in (briefing.prefilled_data || {}) && !!briefing.prefilled_data[field.id]
              const isAutoFilled = isPrefilled && answers[field.id] === briefing.prefilled_data[field.id]
              return (
                <div key={field.id}>
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <label className="text-sm font-semibold leading-snug text-foreground">
                      {field.label}
                      {field.required && <span className="ml-1 text-primary">*</span>}
                    </label>
                    {isAutoFilled && (
                      <span className="shrink-0 whitespace-nowrap rounded-full border border-primary/25 bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary">
                        AUTO
                      </span>
                    )}
                  </div>
                  {field.hint && (
                    <div className="mb-2 text-xs leading-snug text-muted-foreground/70">{field.hint}</div>
                  )}
                  <FieldInput
                    field={field}
                    value={answers[field.id]}
                    prefilled={isAutoFilled}
                    onChange={val => setAnswers(p => ({ ...p, [field.id]: val }))}
                  />
                </div>
              )
            })}
          </div>
        </div>

        {/* Navigation */}
        <div className="fixed bottom-0 left-0 right-0 mx-auto flex max-w-[600px] gap-3 border-t border-border bg-background px-5 py-4">
          {currentSection > 0 && (
            <button
              onClick={() => { setCurrentSection(p => p - 1); window.scrollTo(0, 0) }}
              className="flex-1 rounded-xl border border-border bg-transparent px-4 py-3.5 text-[15px] font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              ← {briefing.language === 'en-US' ? 'Back' : 'Anterior'}
            </button>
          )}
          {!isLastSection ? (
            <button
              onClick={() => { setCurrentSection(p => p + 1); window.scrollTo(0, 0) }}
              className="flex-1 rounded-xl bg-primary px-4 py-3.5 text-[15px] font-bold text-primary-foreground transition-colors hover:bg-primary/90"
            >
              {briefing.language === 'en-US' ? 'Next →' : 'Próximo →'}
            </button>
          ) : (
            <button
              onClick={handleSubmit}
              disabled={submitting}
              className={cn(
                'flex flex-1 items-center justify-center gap-2 rounded-xl px-4 py-3.5 text-[15px] font-bold transition-colors',
                submitting
                  ? 'cursor-not-allowed bg-muted text-muted-foreground'
                  : 'bg-primary text-primary-foreground hover:bg-primary/90',
              )}
            >
              {submitting ? (
                <><div className="spinner" /> {uploadProgress || (briefing.language === 'en-US' ? 'Sending…' : 'Enviando…')}</>
              ) : (
                briefing.language === 'en-US' ? '✓ Submit briefing' : '✓ Concluir briefing'
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
