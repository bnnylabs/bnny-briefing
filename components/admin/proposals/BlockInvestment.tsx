'use client'

import { Plus, Trash2, Percent } from 'lucide-react'
import { IconButton } from '@/components/ui/icon-button'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import type { BlockContentInvestment, PaymentTerm } from '@/lib/proposal-types'
import { RewriteButton } from './RewriteButton'
import { ApplyPresetButton } from './ApplyPresetButton'

// ─── Helpers ──────────────────────────────────────────────────────────────

function fmtCurrency(amount: number): string {
  try {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency', currency: 'BRL', minimumFractionDigits: 2,
    }).format(amount)
  } catch { return `R$ ${amount.toFixed(2)}` }
}

// ─── Editor ───────────────────────────────────────────────────────────────

interface InvestmentEditorProps {
  content: BlockContentInvestment
  onChange: (content: BlockContentInvestment) => void
  /** Optional client id — passed to the IA rewrite for the intro. */
  clientId?: string | null
  onRewriteError?: (message: string) => void
}

export function InvestmentEditor({ content, onChange, clientId, onRewriteError }: InvestmentEditorProps) {
  const terms: PaymentTerm[] = Array.isArray(content.payment_terms)
    ? (content.payment_terms as PaymentTerm[])
    : []

  const updateTotal = (raw: string) => {
    // Accept "3000", "3.000", "3000,00" — normalize to float
    const num = parseFloat(raw.replace(/\./g, '').replace(',', '.'))
    onChange({ ...content, total_amount: isNaN(num) ? 0 : num })
  }

  const updateTerm = (i: number, patch: Partial<Extract<PaymentTerm, { type: 'text' }>>) => {
    const next = (terms as Extract<PaymentTerm, { type: 'text' }>[]).map((t, idx) =>
      idx === i ? { ...t, ...patch } : t,
    ) as PaymentTerm[]
    onChange({ ...content, payment_terms: next })
  }

  const removeTerm = (i: number) => {
    onChange({ ...content, payment_terms: terms.filter((_, idx) => idx !== i) as PaymentTerm[] })
  }

  const addTerm = () => {
    const newTerm: PaymentTerm = { type: 'text', label: '', description: '' }
    onChange({ ...content, payment_terms: [...terms, newTerm] })
  }

  // Format the raw number for display in the input
  const displayAmount = content.total_amount > 0
    ? String(content.total_amount).replace('.', ',')
    : ''

  return (
    <div className="space-y-5">
      {/* Intro (optional) */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <label className="text-[10px] uppercase tracking-widest text-muted-foreground">
            Introdução <span className="text-muted-foreground/60">(opcional)</span>
          </label>
          <RewriteButton
            value={content.intro ?? ''}
            kind="investment_intro"
            clientId={clientId}
            onRewritten={(text) => onChange({ ...content, intro: text })}
            onError={onRewriteError}
          />
        </div>
        <textarea
          value={content.intro ?? ''}
          onChange={(e) => onChange({ ...content, intro: e.target.value })}
          placeholder="Texto introdutório antes do valor…"
          rows={2}
          className={cn(
            'flex w-full resize-y rounded-md border border-border bg-secondary px-3 py-2',
            'text-sm text-foreground placeholder:text-muted-foreground/50',
            'focus:outline-none focus:ring-2 focus:ring-ring/30 focus:border-primary/30',
            'transition-all duration-150',
          )}
        />
      </div>

      {/* Total amount */}
      <div className="space-y-1.5">
        <label className="text-[10px] uppercase tracking-widest text-muted-foreground">
          Valor total
        </label>
        <div className="flex items-center gap-2">
          <span className="font-mono text-sm text-muted-foreground">R$</span>
          <Input
            value={displayAmount}
            onChange={(e) => updateTotal(e.target.value)}
            placeholder="3.000,00"
            className="font-mono text-lg font-bold tabular-nums"
          />
        </div>
      </div>

      {/* Payment terms */}
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <label className="text-[10px] uppercase tracking-widest text-muted-foreground">
            Condições de pagamento
          </label>
          {/* Apply preset — replaces payment_terms with the chosen preset's
              terms. Owner keeps the option to edit manually after, so applying
              isn't a one-way commitment. */}
          <ApplyPresetButton
            onApply={(presetTerms) => onChange({ ...content, payment_terms: presetTerms })}
            className="h-7 text-[11px]"
          />
        </div>

        {terms.length === 0 ? (
          <div className="rounded-md border border-dashed border-border bg-muted/20 px-4 py-4 text-center text-xs text-muted-foreground">
            Nenhuma condição adicionada
          </div>
        ) : (
          <div className="space-y-2">
            {terms.map((term, i) => {
              const t = term as Extract<PaymentTerm, { type: 'text' }>
              return (
                <div key={i} className="space-y-2 rounded-md border border-border bg-card p-3">
                  <div className="flex items-start gap-2">
                    <Input
                      value={t.label ?? ''}
                      onChange={(e) => updateTerm(i, { label: e.target.value })}
                      placeholder="Pagamento à vista"
                      className="flex-1 font-semibold"
                    />
                    <IconButton
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => removeTerm(i)}
                      icon={<Trash2 size={14} />}
                      label="Remover condição"
                      className="text-muted-foreground hover:text-destructive"
                    />
                  </div>
                  <Input
                    value={t.description ?? ''}
                    onChange={(e) => updateTerm(i, { description: e.target.value })}
                    placeholder="10% de desconto no valor total."
                    className="text-sm"
                  />
                  <div className="flex items-center gap-2">
                    <Percent size={12} className="text-muted-foreground" />
                    <Input
                      type="number"
                      min="0"
                      max="100"
                      value={t.discount_percent ?? ''}
                      onChange={(e) => {
                        const val = e.target.value === '' ? undefined : Number(e.target.value)
                        updateTerm(i, { discount_percent: val })
                      }}
                      placeholder="Desconto % (opcional)"
                      className="w-40 text-xs tabular-nums"
                    />
                  </div>
                </div>
              )
            })}
          </div>
        )}

        <Button type="button" variant="outline" size="sm" onClick={addTerm}>
          <Plus className="mr-1 h-3.5 w-3.5" />
          Adicionar condição
        </Button>
      </div>
    </div>
  )
}

// ─── Preview / Document ───────────────────────────────────────────────────

interface InvestmentPreviewProps {
  content: BlockContentInvestment
}

export function InvestmentPreview({ content }: InvestmentPreviewProps) {
  // Filter on visibility AND on having actual content. A payment term
  // with label='' and no description is owner-forgot data — better to
  // hide than render an empty card. Mirrors the same filter applied in
  // the PDF renderer (lib/proposal-pdf.tsx).
  const terms = (Array.isArray(content.payment_terms)
    ? (content.payment_terms as PaymentTerm[])
    : [])
    .filter((t) => (t as { visible?: boolean }).visible !== false)
    .filter((t) => {
      const hasLabel = typeof t.label === 'string' && t.label.trim().length > 0
      const hasDesc =
        typeof t.description === 'string' && t.description.trim().length > 0
      return hasLabel || hasDesc
    })
  const amount = content.total_amount ?? 0

  return (
    <div className="space-y-5">
      {content.intro?.trim() && (
        <p className="text-sm leading-relaxed text-foreground/85">{content.intro}</p>
      )}

      {/* Total */}
      <div>
        <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Total</div>
        <div className="mt-1 font-mono text-3xl font-bold tabular-nums text-foreground">
          {fmtCurrency(amount)}
        </div>
      </div>

      {/* Payment terms grid */}
      {terms.length > 0 && (
        <div
          className={cn(
            'grid gap-4',
            terms.length >= 2 ? 'grid-cols-2' : 'grid-cols-1',
          )}
        >
          {terms.map((term, i) => {
            const t = term as Extract<PaymentTerm, { type: 'text' }>
            return (
              <div key={i} className="space-y-1 rounded-lg border border-border bg-muted/30 p-4">
                <div className="text-sm font-bold text-foreground">{t.label}</div>
                {t.description && (
                  <p className="text-xs leading-relaxed text-muted-foreground">{t.description}</p>
                )}
                {t.discount_percent && (
                  <div className="mt-1 inline-flex rounded bg-success/15 px-1.5 py-0.5 font-mono text-[10px] text-success">
                    {t.discount_percent}% de desconto
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
