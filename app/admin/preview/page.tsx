'use client'

import { useSearchParams } from 'next/navigation'
import { Suspense } from 'react'
import { Eye, Paperclip } from 'lucide-react'
import { getTemplate, BriefingType, BriefingLanguage } from '@/lib/briefing-types'

// ─────────────────────────────────────────────────────────────────────────
// Preview popup — opens in a new window from the admin novo flow.
// Renders a frozen mock of the public briefing page so the owner can
// sanity-check fields, copy and ordering before sending. All inputs are
// non-interactive on purpose.
//
// Migrated from inline `style={{ var(--*) }}` to Tailwind tokens —
// matches the public briefing rewrite of v0.10.45.
// ─────────────────────────────────────────────────────────────────────────

function PreviewContent() {
  const params = useSearchParams()
  const type = (params.get('type') || 'logo') as BriefingType
  const lang = (params.get('lang') || 'pt-BR') as BriefingLanguage
  const company = params.get('company') || 'Empresa'
  const template = getTemplate(type, lang)
  const isEN = lang === 'en-US'

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-10 flex h-14 items-center justify-between border-b border-border bg-background px-5">
        <div className="text-base font-bold tracking-tight">
          <span className="text-primary">Bnny</span> Labs
        </div>
        <div className="flex items-center gap-2.5">
          <span className="inline-flex items-center gap-1.5 rounded-md border border-primary/25 bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary">
            <Eye className="h-3 w-3" />
            {isEN ? 'Preview — not the real briefing' : 'Preview — não é o briefing real'}
          </span>
          <button
            onClick={() => window.close()}
            className="rounded-md border border-border bg-transparent px-3 py-1 text-[13px] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            {isEN ? 'Close' : 'Fechar'}
          </button>
        </div>
      </header>

      <div className="h-[3px] bg-border">
        <div className="h-full w-[14%] bg-primary" />
      </div>

      <div className="mx-auto max-w-[600px] px-5 pb-30 pt-7">
        <div className="mb-7">
          <div className="mb-2 text-[11px] font-bold uppercase tracking-[0.1em] text-primary">
            {template.label}
          </div>
          <h1 className="mb-2.5 text-2xl font-bold leading-tight tracking-tight">
            {isEN ? `${template.label} Briefing` : `Briefing de ${template.label}`}
          </h1>
          <p className="text-sm leading-relaxed text-muted-foreground">
            {isEN
              ? <>Hello! We prepared this form for <strong className="text-foreground">{company}</strong>. Some fields are pre-filled.</>
              : <>Olá! Preparamos este formulário para <strong className="text-foreground">{company}</strong>. Alguns campos já foram preenchidos.</>
            }
          </p>
          <div className="mt-3.5 rounded-lg border border-primary/25 bg-primary/5 px-3.5 py-3 text-[13px] leading-snug text-muted-foreground">
            {isEN
              ? <>✦ Fields with the <span className="rounded-full bg-primary/15 px-1.5 py-px text-[10px] font-bold text-primary">AUTO</span> tag were pre-filled automatically.</>
              : <>✦ Campos com a tag <span className="rounded-full bg-primary/15 px-1.5 py-px text-[10px] font-bold text-primary">AUTO</span> foram preenchidos automaticamente.</>
            }
          </div>
        </div>

        {template.sections.map((section, si) => (
          <div key={si} className="mb-10">
            <div className="mb-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground/70">
              {isEN ? `Section ${si + 1} of ${template.sections.length}` : `Seção ${si + 1} de ${template.sections.length}`}
            </div>
            <h2 className="mb-5 border-b border-border pb-3.5 text-[17px] font-bold tracking-tight">
              {section.title}
            </h2>
            <div className="flex flex-col gap-5">
              {section.fields.map(field => (
                <div key={field.id}>
                  <div className="mb-2 flex items-center gap-2">
                    <label className="text-sm font-semibold text-foreground">
                      {field.label}
                      {field.required && <span className="ml-1 text-primary">*</span>}
                    </label>
                  </div>
                  {field.hint && (
                    <div className="mb-2 text-xs leading-snug text-muted-foreground/70">{field.hint}</div>
                  )}
                  {field.type === 'radio' && field.options && (
                    <div className="flex flex-col gap-2">
                      {field.options.map(opt => (
                        <div
                          key={opt}
                          className="flex min-h-[48px] items-center gap-3 rounded-lg border border-border bg-muted px-3.5 py-3"
                        >
                          <div className="h-[18px] w-[18px] shrink-0 rounded-full border-2 border-border" />
                          <span className="text-[15px] text-muted-foreground">{opt}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  {field.type === 'multiselect' && field.options && (
                    <div className="flex flex-wrap gap-2">
                      {field.options.map(opt => (
                        <div
                          key={opt}
                          className="rounded-full border border-border bg-muted px-3.5 py-2 text-sm text-muted-foreground"
                        >
                          {opt}
                        </div>
                      ))}
                    </div>
                  )}
                  {field.type === 'textarea' && (
                    <div className="min-h-[80px] rounded-lg border border-border bg-muted px-3.5 py-3 text-sm leading-relaxed text-muted-foreground/70">
                      {field.placeholder || ''}
                    </div>
                  )}
                  {field.type === 'text' && (
                    <div className="flex h-12 items-center rounded-lg border border-border bg-muted px-3.5 text-sm text-muted-foreground/70">
                      {field.placeholder || ''}
                    </div>
                  )}
                  {field.type === 'file' && (
                    <div className="flex min-h-[80px] flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border bg-muted px-4 py-5">
                      <Paperclip className="h-5 w-5 text-muted-foreground" />
                      <div className="text-sm text-muted-foreground">
                        {isEN ? 'Tap to attach files' : 'Toque para anexar arquivos'}
                      </div>
                      <div className="text-xs text-muted-foreground/70">
                        {isEN ? 'Images, PDFs · max. 10MB' : 'Imagens, PDFs · máx. 10MB'}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}

        <div className="fixed bottom-0 left-0 right-0 mx-auto flex max-w-[600px] gap-3 border-t border-border bg-background px-5 py-4">
          <div className="flex-1 rounded-xl border border-border bg-transparent px-4 py-3.5 text-center text-[15px] font-medium text-muted-foreground/70">
            {isEN ? '← Back' : '← Anterior'}
          </div>
          <div className="flex-1 rounded-xl bg-primary/60 px-4 py-3.5 text-center text-[15px] font-bold text-primary-foreground opacity-60">
            {isEN ? 'Next →' : 'Próximo →'}
          </div>
        </div>
      </div>
    </div>
  )
}

export default function PreviewPage() {
  return (
    <Suspense fallback={
      <div className="flex h-screen items-center justify-center">
        <div className="spinner" />
      </div>
    }>
      <PreviewContent />
    </Suspense>
  )
}
