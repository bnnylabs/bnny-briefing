'use client'

/**
 * EmailsTab v2 — fixes applied over v0.6.1:
 *
 * #1  LanguageSwitch: removed Languages icon from inside the toggle
 *     container so pt-BR / en-US labels never wrap.
 * #2  Preview iframe: rendered at true 600px inside a scaled wrapper
 *     (scale 0.58, origin top-left, outer clip) so the admin always
 *     sees the desktop layout, not the mobile breakpoint layout.
 * #4  Save button: Check icon → Save icon (matches the bottom bar).
 * #5  Save button: switched from shadcn default size="sm" to an inline
 *     lime CTA that matches the bottom bar's primary style.
 * #6  "Restaurar padrão": ghost when disabled, outline+red tint when
 *     enabled — clear affordance without being alarming.
 * #7  "Customizado" badge: same pill treatment in both list row and
 *     editor subtitle, replacing the plain text "· customizado".
 * #8  Block placeholders: now clickable chips that insert {{name}}
 *     at cursor, same behaviour as variable chips.
 */

import * as React from 'react'
import { ArrowLeft, FileEdit, Mail, RotateCcw, Save, SendHorizonal } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
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
}

// Fix #8 — block descriptions used in both the legend and chip tooltips
const BLOCK_HINTS: Record<string, { 'pt-BR': string; 'en-US': string }> = {
  fallback_link: {
    'pt-BR': 'Link "Se o botão não funcionar, copie…"',
    'en-US': '"If the button doesn\'t work…" link',
  },
  editing_window: {
    'pt-BR': 'Card com janela de edição de N horas',
    'en-US': 'N-hour editing window card',
  },
  meta_card: {
    'pt-BR': 'Card: Cliente, Empresa, Tipo e conclusão',
    'en-US': 'Card: Client, Company, Type, completion',
  },
  changes: {
    'pt-BR': 'Tabela comparando valores antigos e novos',
    'en-US': 'Diff table comparing old and new values',
  },
}

type ToastFn = (message: string, kind?: 'success' | 'error' | 'info', duration?: number) => void

// Fix #7 — shared badge so list and editor use the exact same element
function CustomizedBadge() {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-border px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
      <span className="h-1.5 w-1.5 rounded-full bg-foreground/70" />
      Customizado
    </span>
  )
}

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
        if (!cancelled) { setLoading(false); toast('Erro ao carregar templates', 'error') }
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
    return () => { cancelled = true }
  }, [toast])

  function templateFor(type: TemplateType, lang: TemplateLanguage) {
    return templates.get(`${type}:${lang}`)
  }

  function applyToCache(t: ResolvedTemplate) {
    setTemplates((prev) => { const n = new Map(prev); n.set(`${t.type}:${t.language}`, t); return n })
  }

  if (loading) {
    return <div className="flex h-40 items-center justify-center"><div className="spinner" /></div>
  }

  if (mode === 'edit' && selectedType) {
    const current = templateFor(selectedType, language)
    if (!current) return (
      <Card className="p-5">
        <p className="text-sm text-muted-foreground">Template não encontrado.</p>
      </Card>
    )
    return (
      <EmailTemplateEditor
        template={current}
        onBack={() => { setMode('list'); setSelectedType(null) }}
        onSaved={(t) => { applyToCache(t); toast('Template salvo', 'success', 2000) }}
        onReset={(t) => { applyToCache(t); toast('Restaurado para o padrão', 'success', 2000) }}
        onError={(msg) => toast(msg, 'error')}
        onTestSent={(to) => toast(`Teste enviado para ${to}`, 'success', 4000)}
      />
    )
  }

  return (
    <div className="space-y-4">
      <Card className="p-5">
        {/* Header row — description left, language toggle right */}
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-sm font-semibold">
              <Mail size={14} />
              Templates de email
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Edite o copy de cada email transacional. Identidade visual e blocos
              estruturais são renderizados automaticamente.
            </p>
          </div>
          {/* Fix #1 — no Languages icon inside the pill, no wrapping */}
          <LanguageSwitch value={language} onChange={setLanguage} />
        </div>

        <div className="-mx-1 space-y-0.5">
          {TEMPLATE_TYPES.map((type) => {
            const t = templateFor(type, language)
            if (!t) return null
            return (
              <button
                key={type}
                type="button"
                onClick={() => { setSelectedType(type); setMode('edit') }}
                className="group flex w-full items-center justify-between gap-3 rounded-md px-3 py-3 text-left transition-colors hover:bg-muted/60"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">{TEMPLATE_LABELS[type][language]}</span>
                    {/* Fix #7 — shared badge component */}
                    {!t.is_default && <CustomizedBadge />}
                  </div>
                  <p className="mt-0.5 truncate text-xs text-muted-foreground">{t.subject}</p>
                </div>
                <FileEdit size={14} className="shrink-0 text-muted-foreground transition-colors group-hover:text-foreground" />
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
  template, onBack, onSaved, onReset, onError, onTestSent,
}: {
  template: ResolvedTemplate
  onBack: () => void
  onSaved: (t: ResolvedTemplate) => void
  onReset: (t: ResolvedTemplate) => void
  onError: (msg: string) => void
  onTestSent: (to: string) => void
}) {
  const editorKey = `${template.type}:${template.language}`
  const [draft, setDraft] = React.useState<EmailTemplateContent>({
    subject: template.subject,
    preheader: template.preheader,
    title: template.title,
    body_markdown: template.body_markdown,
    cta_text: template.cta_text,
  })

  React.useEffect(() => {
    setDraft({
      subject: template.subject,
      preheader: template.preheader,
      title: template.title,
      body_markdown: template.body_markdown,
      cta_text: template.cta_text,
    })
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
  const [sending, setSending] = React.useState(false)
  // Confirmation dialog for the destructive 'reset to default' action.
  const [resetConfirmOpen, setResetConfirmOpen] = React.useState(false)

  // Live preview
  const [previewHtml, setPreviewHtml] = React.useState('')
  const [previewMeta, setPreviewMeta] = React.useState<{ subject: string; preheader: string; ctaText: string | null } | null>(null)
  const [previewLoading, setPreviewLoading] = React.useState(true)
  const previewVersion = React.useRef(0)

  React.useEffect(() => {
    const ver = ++previewVersion.current
    setPreviewLoading(true)
    const tid = setTimeout(async () => {
      try {
        const res = await fetch('/api/admin/email-templates/preview', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type: template.type, language: template.language, override: draft }),
        })
        if (ver !== previewVersion.current) return
        if (!res.ok) { setPreviewLoading(false); return }
        const data = (await res.json()) as PreviewResponse
        setPreviewHtml(data.html)
        setPreviewMeta({ subject: data.subject, preheader: data.preheader, ctaText: data.ctaText })
        setPreviewLoading(false)
      } catch {
        if (ver === previewVersion.current) setPreviewLoading(false)
      }
    }, 400)
    return () => clearTimeout(tid)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft.subject, draft.preheader, draft.title, draft.body_markdown, draft.cta_text, template.type, template.language])

  // Variable / block insertion — shared util
  const bodyRef = React.useRef<HTMLTextAreaElement>(null)
  function insertAtCursor(text: string) {
    const el = bodyRef.current
    if (!el) { setDraft((d) => ({ ...d, body_markdown: d.body_markdown + text })); return }
    const start = el.selectionStart ?? el.value.length
    const end = el.selectionEnd ?? el.value.length
    const next = el.value.slice(0, start) + text + el.value.slice(end)
    setDraft((d) => ({ ...d, body_markdown: next }))
    requestAnimationFrame(() => {
      if (!bodyRef.current) return
      const caret = start + text.length
      bodyRef.current.focus()
      bodyRef.current.setSelectionRange(caret, caret)
    })
  }

  // Actions
  async function sendTest() {
    setSending(true)
    const res = await fetch('/api/admin/email-templates/test-send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: template.type, language: template.language, override: draft }),
    })
    setSending(false)
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      if (err.error === 'no_notification_email') {
        onError('Configure um email de notificação em Configurações → Geral primeiro')
      } else {
        onError('Falha ao enviar email de teste')
      }
      return
    }
    const { to } = await res.json()
    onSaved({ ...template }) // refresh is_default badge without losing draft
    // Use onError with success styling via toast — pass through parent
    onTestSent(to)
  }

  async function save() {
    setSaving(true)
    const res = await fetch('/api/admin/email-templates', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: template.type, language: template.language, ...draft }),
    })
    setSaving(false)
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      onError(err.error === 'subject_title_body_required' ? 'Assunto, título e corpo são obrigatórios' : 'Erro ao salvar')
      return
    }
    onSaved({ ...template, ...draft, is_default: false })
  }

  async function reset() {
    if (template.is_default) return
    setResetting(true)
    const res = await fetch(
      `/api/admin/email-templates?type=${encodeURIComponent(template.type)}&language=${encodeURIComponent(template.language)}`,
      { method: 'DELETE' },
    )
    if (!res.ok) { setResetting(false); onError('Erro ao restaurar'); return }
    const refresh = await fetch('/api/admin/email-templates')
    setResetting(false)
    if (!refresh.ok) { onError('Erro ao recarregar templates'); return }
    const { templates } = (await refresh.json()) as { templates: ResolvedTemplate[] }
    const fresh = templates.find((t) => t.type === template.type && t.language === template.language)
    if (fresh) onReset(fresh)
  }

  const variables = TEMPLATE_VARIABLES[template.type]
  const blocks = TEMPLATE_BLOCKS[template.type]
  const langLabel = template.language === 'pt-BR' ? 'Português (BR)' : 'English (US)'

  return (
    <div className="space-y-4">
      <Card className="p-5">
        {/* Header */}
        <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            <IconButton icon={<ArrowLeft className="h-4 w-4" />} label="Voltar" size="icon" onClick={onBack} />
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold">{TEMPLATE_LABELS[template.type][template.language]}</span>
                {!template.is_default && <CustomizedBadge />}
              </div>
              <p className="mt-0.5 text-xs text-muted-foreground">{langLabel}</p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap justify-end">
            {/* Fix #6 — distinct visual states for restore button */}
            <button
              type="button"
              onClick={() => setResetConfirmOpen(true)}
              disabled={template.is_default || resetting}
              title={template.is_default ? 'Já está usando o padrão' : 'Restaurar para o copy original'}
              className={[
                'inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium transition-colors',
                template.is_default || resetting
                  ? 'cursor-not-allowed border-border/40 text-muted-foreground/40'
                  : 'border-destructive/30 text-destructive hover:bg-destructive/5',
              ].join(' ')}
            >
              <RotateCcw size={12} />
              {resetting ? 'Restaurando…' : 'Restaurar padrão'}
            </button>

            {/* Test-send — fires real email to notification_email using draft + sample data */}
            <button
              type="button"
              onClick={sendTest}
              disabled={sending}
              title="Envia um email de teste para o seu endereço de notificação"
              className={[
                'inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs font-medium transition-colors',
                sending
                  ? 'cursor-not-allowed text-muted-foreground/50'
                  : 'text-muted-foreground hover:border-foreground/30 hover:text-foreground',
              ].join(' ')}
            >
              <SendHorizonal size={12} />
              {sending ? 'Enviando…' : 'Enviar teste'}
            </button>

            {/* Fix #4 + #5 — Save icon (not Check), full lime CTA */}
            <button
              type="button"
              onClick={save}
              disabled={!dirty || saving}
              className={[
                'inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors',
                dirty && !saving
                  ? 'bg-primary text-neutral-900 hover:bg-primary/85'
                  : 'cursor-not-allowed bg-muted text-muted-foreground',
              ].join(' ')}
            >
              <Save size={12} />
              {saving ? 'Salvando…' : 'Salvar'}
            </button>
          </div>
        </div>

        {/* Two-column body */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">

          {/* ── Form col ─────────────────────────────────────────── */}
          <div className="space-y-4">
            <EditorField label="Assunto" hint="Aparece na caixa de entrada"
              value={draft.subject} onChange={(v) => setDraft((d) => ({ ...d, subject: v }))} />
            <EditorField label="Preheader" hint="Texto de prévia em alguns clientes de email"
              value={draft.preheader} onChange={(v) => setDraft((d) => ({ ...d, preheader: v }))} />
            <EditorField label="Título do email" hint="H1 dentro do card branco"
              value={draft.title} onChange={(v) => setDraft((d) => ({ ...d, title: v }))} />

            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">Corpo (markdown)</Label>
              <textarea
                ref={bodyRef}
                value={draft.body_markdown}
                onChange={(e) => setDraft((d) => ({ ...d, body_markdown: e.target.value }))}
                rows={10}
                spellCheck={false}
                className="block w-full rounded-md border border-input bg-background px-3 py-2 font-mono text-[13px] leading-relaxed shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
              <p className="text-xs text-muted-foreground">
                <code className="font-mono">**negrito**</code>
                {' · '}
                <code className="font-mono">*itálico*</code>
                {' · '}
                <code className="font-mono">[texto](url)</code>
                {' · '}
                <code className="font-mono">&gt; muted</code>
              </p>
            </div>

            <EditorField label="Texto do botão (CTA)"
              hint="Deixe vazio para ocultar o botão"
              value={draft.cta_text} onChange={(v) => setDraft((d) => ({ ...d, cta_text: v }))} />

            {/* Variables */}
            <ChipSection label="Variáveis" emptyLabel="Nenhuma variável neste template.">
              {variables.map((v) => (
                <Chip key={v} onClick={() => insertAtCursor(`{${v}}`)} title={`Inserir {${v}}`}>
                  {`{${v}}`}
                </Chip>
              ))}
            </ChipSection>

            {/* Fix #8 — Block placeholders now insertable */}
            {blocks.length > 0 && (
              <ChipSection
                label="Blocos estruturais"
                footer="Clique para inserir no cursor. Remover o placeholder oculta o bloco."
              >
                {blocks.map((b) => (
                  <div key={b} className="flex w-full items-start gap-2">
                    <Chip onClick={() => insertAtCursor(`{{${b}}}`)} title={`Inserir {{${b}}}`}>
                      {`{{${b}}}`}
                    </Chip>
                    <span className="pt-0.5 text-[11px] text-muted-foreground leading-relaxed">
                      {BLOCK_HINTS[b]?.[template.language] ?? ''}
                    </span>
                  </div>
                ))}
              </ChipSection>
            )}
          </div>

          {/* ── Preview col — Fix #2: scaled 600px iframe ────────── */}
          <div className="lg:sticky lg:top-4 lg:self-start">
            <div className="mb-2 flex items-center justify-between">
              <div className="text-xs uppercase tracking-wider text-muted-foreground">Preview</div>
              {previewLoading && (
                <div className="spinner" aria-hidden style={{ width: 12, height: 12, borderWidth: 1.5 }} />
              )}
            </div>

            <div className="rounded-md border border-border bg-muted/30 p-2.5">
              {/* Inbox snippet */}
              {previewMeta && (
                <div className="mb-2 rounded border border-border/50 bg-background px-3 py-2 shadow-sm">
                  <div className="flex items-center gap-2">
                    {/* Sender avatar stand-in */}
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-neutral-200 text-[10px] font-bold text-neutral-600">
                      BL
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-baseline gap-1.5">
                        <span className="text-[12px] font-semibold text-foreground">Bnny Labs</span>
                        <span className="truncate text-[11px] text-muted-foreground">
                          {previewMeta.subject || '(sem assunto)'}
                        </span>
                      </div>
                      <div className="truncate text-[11px] text-muted-foreground">
                        {previewMeta.preheader || <em>(sem preheader)</em>}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/*
                Scale wrapper — renders the email at its native 600px width
                then scales down so the admin sees the true desktop layout.
                Scale: 0.58 → rendered width ≈ 348px, fits the ~360px column.
                Outer clip height = inner height * scale = 1070 * 0.58 ≈ 620px.
              */}
              <div
                className="relative overflow-hidden rounded border border-border bg-white"
                style={{ height: 620 }}
              >
                <div style={{ width: 600, transform: 'scale(0.58)', transformOrigin: 'top left' }}>
                  <iframe
                    title="Email preview"
                    srcDoc={previewHtml}
                    sandbox="allow-same-origin"
                    style={{ width: 600, height: 1070, border: 'none', display: 'block' }}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </Card>

      <ConfirmDialog
        open={resetConfirmOpen}
        onOpenChange={setResetConfirmOpen}
        title="Restaurar para o padrão?"
        description="As alterações salvas neste template serão perdidas e o copy original voltará."
        icon={RotateCcw}
        variant="destructive"
        confirmLabel="Sim, restaurar"
        loading={resetting}
        onConfirm={async () => {
          setResetConfirmOpen(false)
          await reset()
        }}
      />
    </div>
  )
}

/* ───────────────────────────────────────────────────────────────────── */
/* Primitives                                                             */
/* ───────────────────────────────────────────────────────────────────── */

function EditorField({
  label, hint, value, onChange,
}: {
  label: string; hint?: string; value: string; onChange: (v: string) => void
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs uppercase tracking-wider text-muted-foreground">{label}</Label>
      <Input value={value} onChange={(e) => onChange(e.target.value)} />
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  )
}

function ChipSection({
  label, children, emptyLabel, footer,
}: {
  label: string; children: React.ReactNode; emptyLabel?: string; footer?: string
}) {
  const hasChildren = React.Children.count(children) > 0
  return (
    <div className="space-y-2 rounded-md border border-border/60 bg-muted/30 p-3">
      <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{label}</div>
      {hasChildren
        ? <div className="flex flex-wrap gap-1.5">{children}</div>
        : emptyLabel && <p className="text-xs text-muted-foreground">{emptyLabel}</p>}
      {footer && <p className="pt-0.5 text-[11px] text-muted-foreground">{footer}</p>}
    </div>
  )
}

function Chip({ children, onClick, title }: { children: React.ReactNode; onClick: () => void; title?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className="rounded border border-border bg-background px-2 py-0.5 font-mono text-[11px] transition-colors hover:border-foreground/30 hover:bg-muted"
    >
      {children}
    </button>
  )
}

// Fix #1 — LanguageSwitch without icon inside so labels never wrap
function LanguageSwitch({ value, onChange }: { value: TemplateLanguage; onChange: (v: TemplateLanguage) => void }) {
  return (
    <div className="inline-flex shrink-0 items-center rounded-md border border-border bg-muted/40 p-0.5 text-xs">
      {(['pt-BR', 'en-US'] as TemplateLanguage[]).map((lang) => (
        <button
          key={lang}
          type="button"
          onClick={() => onChange(lang)}
          className={[
            'rounded px-2.5 py-1 font-medium transition-colors whitespace-nowrap',
            value === lang
              ? 'bg-background text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground',
          ].join(' ')}
        >
          {lang}
        </button>
      ))}
    </div>
  )
}
