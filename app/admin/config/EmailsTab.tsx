'use client'

/**
 * EmailsTab — the /admin/config "Emails" tab body.
 *
 * Drilldown UX:
 *   • Default view = list of 5 template types, language toggle on top.
 *   • Click a card → editor view replaces the list with a 2-column
 *     layout: form on the left, live-preview iframe on the right.
 *   • Editor calls /api/admin/email-templates/preview (debounced
 *     400ms) on every change so the iframe shows the exact same HTML
 *     a real send would produce — same composeEmail() pipeline, only
 *     the variable values are sample.
 *
 * State:
 *   • templates       — full snapshot keyed by `${type}:${language}`
 *   • mode            — 'list' | 'edit'
 *   • selectedType    — which template is being edited
 *   • language        — pt-BR | en-US, applied to the whole tab
 *   • draft           — the buffer the user is typing into; on save
 *                       it's PUT to the API and copied back into
 *                       templates with is_default=false
 *   • previewHtml     — srcdoc for the iframe
 *
 * Saved/default detection: each ResolvedTemplate carries an
 * is_default flag from the API. The list shows a "Customizado" badge
 * for non-defaults; the editor enables "Restaurar padrão" only when
 * is_default=false.
 */

import * as React from 'react'
import { ArrowLeft, Check, FileEdit, Languages, Mail, RotateCcw } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { IconButton } from '@/components/ui/icon-button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  TEMPLATE_BLOCKS,
  TEMPLATE_LABELS,
  TEMPLATE_TYPES,
  TEMPLATE_VARIABLES,
  type EmailTemplateContent,
  type TemplateLanguage,
  type TemplateType,
} from '@/lib/email-defaults'

// Mirrors the API's ResolvedTemplate shape.
interface ResolvedTemplate extends EmailTemplateContent {
  type: TemplateType
  language: TemplateLanguage
  is_default: boolean
}

interface PreviewResponse {
  html: string
  subject: string
  preheader: string
  title: string
  ctaText: string | null
  ctaHref: string | null
}

const BLOCK_HINTS: Record<string, { 'pt-BR': string; 'en-US': string }> = {
  fallback_link: {
    'pt-BR': 'Renderiza o link de fallback "Se o botão não funcionar, copie…"',
    'en-US': 'Renders the fallback "If the button doesn\'t work…" link',
  },
  editing_window: {
    'pt-BR': 'Card com a janela de edição de N horas (só aparece se houver link)',
    'en-US': 'Card showing the N-hour editing window (only when link exists)',
  },
  meta_card: {
    'pt-BR': 'Card de metadados com Cliente, Empresa, Tipo e horário de conclusão',
    'en-US': 'Metadata card with Client, Company, Type and completion time',
  },
  changes: {
    'pt-BR': 'Tabela de alterações comparando valores antigos e novos',
    'en-US': 'Diff table comparing old and new values',
  },
}

type ToastFn = (message: string, kind?: 'success' | 'error' | 'info', duration?: number) => void

export function EmailsTab({ toast }: { toast: ToastFn }) {
  const [templates, setTemplates] = React.useState<Map<string, ResolvedTemplate>>(new Map())
  const [loading, setLoading] = React.useState(true)
  const [mode, setMode] = React.useState<'list' | 'edit'>('list')
  const [language, setLanguage] = React.useState<TemplateLanguage>('pt-BR')
  const [selectedType, setSelectedType] = React.useState<TemplateType | null>(null)

  React.useEffect(() => {
    let cancelled = false
    async function load() {
      const res = await fetch('/api/admin/email-templates')
      if (!res.ok) {
        if (!cancelled) {
          setLoading(false)
          toast('Erro ao carregar templates', 'error')
        }
        return
      }
      const { templates: list } = (await res.json()) as { templates: ResolvedTemplate[] }
      if (cancelled) return
      const next = new Map<string, ResolvedTemplate>()
      for (const t of list) next.set(`${t.type}:${t.language}`, t)
      setTemplates(next)
      setLoading(false)
    }
    load()
    return () => {
      cancelled = true
    }
  }, [toast])

  function templateFor(type: TemplateType, lang: TemplateLanguage): ResolvedTemplate | undefined {
    return templates.get(`${type}:${lang}`)
  }

  function applyResolvedToCache(t: ResolvedTemplate) {
    setTemplates((prev) => {
      const next = new Map(prev)
      next.set(`${t.type}:${t.language}`, t)
      return next
    })
  }

  if (loading) {
    return (
      <div className="flex h-40 items-center justify-center">
        <div className="spinner" />
      </div>
    )
  }

  if (mode === 'edit' && selectedType) {
    const current = templateFor(selectedType, language)
    if (!current) {
      // Shouldn't happen — the API always returns all 10 — but keep
      // the path total just in case.
      return (
        <Card className="p-5">
          <p className="text-sm text-muted-foreground">Template não encontrado.</p>
        </Card>
      )
    }
    return (
      <EmailTemplateEditor
        template={current}
        onBack={() => {
          setMode('list')
          setSelectedType(null)
        }}
        onSaved={(saved) => {
          applyResolvedToCache(saved)
          toast('Template salvo', 'success', 2000)
        }}
        onReset={(reset) => {
          applyResolvedToCache(reset)
          toast('Restaurado para o padrão', 'success', 2000)
        }}
        onError={(msg) => toast(msg, 'error')}
      />
    )
  }

  return (
    <div className="space-y-4">
      <Card className="p-5">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 text-sm font-semibold">
              <Mail size={14} />
              Templates de email
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Edite o copy de cada email transacional. A identidade visual e os blocos
              estruturais são renderizados automaticamente.
            </p>
          </div>
          <LanguageSwitch value={language} onChange={setLanguage} />
        </div>

        <div className="-mx-1 space-y-1">
          {TEMPLATE_TYPES.map((type) => {
            const t = templateFor(type, language)
            if (!t) return null
            return (
              <button
                key={type}
                type="button"
                onClick={() => {
                  setSelectedType(type)
                  setMode('edit')
                }}
                className="group flex w-full items-center justify-between gap-3 rounded-md px-3 py-3 text-left transition-colors hover:bg-muted/60"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">
                      {TEMPLATE_LABELS[type][language]}
                    </span>
                    {!t.is_default && (
                      <span className="inline-flex items-center gap-1 rounded-full border border-border px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                        <span className="h-1.5 w-1.5 rounded-full bg-foreground/70" />
                        Customizado
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 truncate text-xs text-muted-foreground">
                    {t.subject}
                  </p>
                </div>
                <FileEdit
                  size={14}
                  className="shrink-0 text-muted-foreground transition-colors group-hover:text-foreground"
                />
              </button>
            )
          })}
        </div>
      </Card>
    </div>
  )
}

/* ───────────────────────────────────────────────────────────────────── */
/* Editor                                                                 */
/* ───────────────────────────────────────────────────────────────────── */

function EmailTemplateEditor({
  template,
  onBack,
  onSaved,
  onReset,
  onError,
}: {
  template: ResolvedTemplate
  onBack: () => void
  onSaved: (t: ResolvedTemplate) => void
  onReset: (t: ResolvedTemplate) => void
  onError: (msg: string) => void
}) {
  // Each (type, language) opens a fresh editor so we key local state
  // off the template identity. When the prop changes (shouldn't in
  // current UX but cheap insurance) the buffer resets.
  const editorKey = `${template.type}:${template.language}`
  const [draft, setDraft] = React.useState<EmailTemplateContent>(() => ({
    subject: template.subject,
    preheader: template.preheader,
    title: template.title,
    body_markdown: template.body_markdown,
    cta_text: template.cta_text,
  }))

  React.useEffect(() => {
    setDraft({
      subject: template.subject,
      preheader: template.preheader,
      title: template.title,
      body_markdown: template.body_markdown,
      cta_text: template.cta_text,
    })
    // editorKey covers both type and language transitions.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editorKey])

  const dirty =
    draft.subject !== template.subject ||
    draft.preheader !== template.preheader ||
    draft.title !== template.title ||
    draft.body_markdown !== template.body_markdown ||
    draft.cta_text !== template.cta_text

  const [saving, setSaving] = React.useState(false)
  const [resetting, setResetting] = React.useState(false)

  // ── Live preview ─────────────────────────────────────────────────────
  const [previewHtml, setPreviewHtml] = React.useState<string>('')
  const [previewMeta, setPreviewMeta] = React.useState<{ subject: string; preheader: string } | null>(null)
  const [previewLoading, setPreviewLoading] = React.useState(true)
  const previewVersionRef = React.useRef(0)

  React.useEffect(() => {
    const myVersion = ++previewVersionRef.current
    setPreviewLoading(true)

    const t = setTimeout(async () => {
      try {
        const res = await fetch('/api/admin/email-templates/preview', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: template.type,
            language: template.language,
            override: draft,
          }),
        })
        // Stale response — newer keystroke landed during the request.
        if (myVersion !== previewVersionRef.current) return
        if (!res.ok) {
          setPreviewLoading(false)
          return
        }
        const data = (await res.json()) as PreviewResponse
        setPreviewHtml(data.html)
        setPreviewMeta({ subject: data.subject, preheader: data.preheader })
        setPreviewLoading(false)
      } catch {
        if (myVersion === previewVersionRef.current) setPreviewLoading(false)
      }
    }, 400)

    return () => clearTimeout(t)
  }, [
    draft.subject,
    draft.preheader,
    draft.title,
    draft.body_markdown,
    draft.cta_text,
    template.type,
    template.language,
  ])

  // ── Variable insertion ──────────────────────────────────────────────
  const bodyRef = React.useRef<HTMLTextAreaElement>(null)
  function insertVariable(name: string) {
    const el = bodyRef.current
    const placeholder = `{${name}}`
    if (!el) {
      setDraft((d) => ({ ...d, body_markdown: d.body_markdown + placeholder }))
      return
    }
    const start = el.selectionStart ?? el.value.length
    const end = el.selectionEnd ?? el.value.length
    const before = el.value.slice(0, start)
    const after = el.value.slice(end)
    const next = before + placeholder + after
    setDraft((d) => ({ ...d, body_markdown: next }))
    // Restore caret after React re-renders the textarea.
    requestAnimationFrame(() => {
      if (!bodyRef.current) return
      const caret = start + placeholder.length
      bodyRef.current.focus()
      bodyRef.current.setSelectionRange(caret, caret)
    })
  }

  // ── Actions ─────────────────────────────────────────────────────────
  async function save() {
    setSaving(true)
    const res = await fetch('/api/admin/email-templates', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: template.type,
        language: template.language,
        ...draft,
      }),
    })
    setSaving(false)
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      onError(err.error === 'subject_title_body_required' ? 'Assunto, título e corpo são obrigatórios' : 'Erro ao salvar')
      return
    }
    onSaved({
      ...template,
      ...draft,
      is_default: false,
    })
  }

  async function reset() {
    if (template.is_default) return
    if (!confirm('Restaurar este template para o padrão? As alterações serão perdidas.')) return
    setResetting(true)
    const res = await fetch(
      `/api/admin/email-templates?type=${encodeURIComponent(template.type)}&language=${encodeURIComponent(template.language)}`,
      { method: 'DELETE' },
    )
    setResetting(false)
    if (!res.ok) {
      onError('Erro ao restaurar')
      return
    }
    // Re-fetch the default copy by hitting GET — simpler than mirroring
    // EMAIL_DEFAULTS on the client.
    const refresh = await fetch('/api/admin/email-templates')
    if (!refresh.ok) {
      onError('Erro ao recarregar templates')
      return
    }
    const { templates } = (await refresh.json()) as { templates: ResolvedTemplate[] }
    const fresh = templates.find(
      (t) => t.type === template.type && t.language === template.language,
    )
    if (fresh) onReset(fresh)
  }

  const variables = TEMPLATE_VARIABLES[template.type]
  const blocks = TEMPLATE_BLOCKS[template.type]
  const langLabel = template.language === 'pt-BR' ? 'Português (BR)' : 'English (US)'

  return (
    <div className="space-y-4">
      <Card className="p-5">
        {/* Editor header — back + identity + save/reset */}
        <div className="mb-5 flex items-start justify-between gap-3">
          <div className="flex items-start gap-2">
            <IconButton
              icon={<ArrowLeft className="h-4 w-4" />}
              label="Voltar"
              size="icon"
              onClick={onBack}
            />
            <div>
              <div className="text-sm font-semibold">
                {TEMPLATE_LABELS[template.type][template.language]}
              </div>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {langLabel}
                {template.is_default ? ' · usando o padrão' : ' · customizado'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={reset}
              disabled={template.is_default || resetting}
              title={template.is_default ? 'Já está usando o padrão' : 'Restaurar padrão'}
            >
              <RotateCcw size={13} />
              Restaurar padrão
            </Button>
            <Button onClick={save} disabled={!dirty || saving} size="sm">
              {saving ? 'Salvando…' : (
                <>
                  <Check size={13} />
                  Salvar
                </>
              )}
            </Button>
          </div>
        </div>

        {/* Two-column body */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          {/* ── Form ─────────────────────────────────────────────── */}
          <div className="space-y-4">
            <EditorField
              label="Assunto"
              hint="O que aparece na caixa de entrada"
              value={draft.subject}
              onChange={(v) => setDraft((d) => ({ ...d, subject: v }))}
            />
            <EditorField
              label="Preheader"
              hint="Texto de prévia ao lado do assunto em alguns clientes"
              value={draft.preheader}
              onChange={(v) => setDraft((d) => ({ ...d, preheader: v }))}
            />
            <EditorField
              label="Título do email"
              hint="O H1 que aparece dentro do card"
              value={draft.title}
              onChange={(v) => setDraft((d) => ({ ...d, title: v }))}
            />

            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">
                Corpo (markdown)
              </Label>
              <textarea
                ref={bodyRef}
                value={draft.body_markdown}
                onChange={(e) => setDraft((d) => ({ ...d, body_markdown: e.target.value }))}
                rows={10}
                className="block w-full rounded-md border border-input bg-background px-3 py-2 font-mono text-[13px] leading-relaxed shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                spellCheck={false}
              />
              <p className="text-xs text-muted-foreground">
                Markdown: <code className="font-mono">**negrito**</code>,{' '}
                <code className="font-mono">*itálico*</code>,{' '}
                <code className="font-mono">[texto](url)</code>,{' '}
                <code className="font-mono">&gt; muted</code>
              </p>
            </div>

            <EditorField
              label="Texto do botão (CTA)"
              hint="Vazio = sem botão (válido só para Confirmação quando não há link de edição)"
              value={draft.cta_text}
              onChange={(v) => setDraft((d) => ({ ...d, cta_text: v }))}
            />

            {/* Variable chips */}
            <div className="space-y-1.5 rounded-md border border-border/60 bg-muted/30 p-3">
              <div className="text-xs uppercase tracking-wider text-muted-foreground">
                Variáveis
              </div>
              <div className="flex flex-wrap gap-1.5">
                {variables.map((v) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => insertVariable(v)}
                    className="rounded-md border border-border bg-background px-2 py-1 font-mono text-[11px] hover:bg-muted"
                    title={`Inserir {${v}} no corpo`}
                  >
                    {`{${v}}`}
                  </button>
                ))}
              </div>
              {variables.length === 0 && (
                <p className="text-xs text-muted-foreground">Nenhuma variável neste template.</p>
              )}
            </div>

            {/* Block placeholders — informational, not editable */}
            {blocks.length > 0 && (
              <div className="space-y-1.5 rounded-md border border-border/60 bg-muted/30 p-3">
                <div className="text-xs uppercase tracking-wider text-muted-foreground">
                  Blocos estruturais
                </div>
                <div className="space-y-2">
                  {blocks.map((b) => (
                    <div key={b} className="flex items-baseline gap-2 text-xs">
                      <code className="shrink-0 rounded border border-border bg-background px-1.5 py-0.5 font-mono text-[11px]">
                        {`{{${b}}}`}
                      </code>
                      <span className="text-muted-foreground">
                        {BLOCK_HINTS[b]?.[template.language] ?? ''}
                      </span>
                    </div>
                  ))}
                  <p className="pt-1 text-[11px] text-muted-foreground">
                    Posicione no corpo onde quer que o bloco apareça. Remover o
                    placeholder oculta o bloco.
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* ── Preview ──────────────────────────────────────────── */}
          <div className="lg:sticky lg:top-4 lg:self-start">
            <div className="mb-2 flex items-center justify-between">
              <div className="text-xs uppercase tracking-wider text-muted-foreground">
                Preview
              </div>
              {previewLoading && <div className="spinner" aria-hidden style={{ width: 12, height: 12, borderWidth: 1.5 }} />}
            </div>
            <div className="rounded-md border border-border bg-muted/30 p-3">
              {previewMeta && (
                <div className="mb-2 space-y-0.5 px-1">
                  <div className="truncate text-[13px] font-medium text-foreground">
                    {previewMeta.subject || <span className="text-muted-foreground">(sem assunto)</span>}
                  </div>
                  <div className="truncate text-[11px] text-muted-foreground">
                    {previewMeta.preheader || <span className="italic">(sem preheader)</span>}
                  </div>
                </div>
              )}
              <iframe
                title="Email preview"
                srcDoc={previewHtml}
                sandbox="allow-same-origin"
                className="h-[640px] w-full rounded border border-border bg-white"
              />
            </div>
          </div>
        </div>
      </Card>
    </div>
  )
}

/* ───────────────────────────────────────────────────────────────────── */
/* Small helpers                                                          */
/* ───────────────────────────────────────────────────────────────────── */

function EditorField({
  label,
  hint,
  value,
  onChange,
}: {
  label: string
  hint?: string
  value: string
  onChange: (v: string) => void
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs uppercase tracking-wider text-muted-foreground">
        {label}
      </Label>
      <Input value={value} onChange={(e) => onChange(e.target.value)} />
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  )
}

function LanguageSwitch({
  value,
  onChange,
}: {
  value: TemplateLanguage
  onChange: (v: TemplateLanguage) => void
}) {
  return (
    <div className="inline-flex items-center gap-0.5 rounded-md border border-border bg-muted/40 p-0.5 text-xs">
      <Languages size={12} className="ml-1.5 mr-0.5 text-muted-foreground" />
      <button
        type="button"
        onClick={() => onChange('pt-BR')}
        className={`rounded px-2 py-1 font-medium transition-colors ${
          value === 'pt-BR' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
        }`}
      >
        pt-BR
      </button>
      <button
        type="button"
        onClick={() => onChange('en-US')}
        className={`rounded px-2 py-1 font-medium transition-colors ${
          value === 'en-US' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
        }`}
      >
        en-US
      </button>
    </div>
  )
}
