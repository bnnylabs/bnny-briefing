'use client'

/**
 * Investment card — barra lateral direita do ProposalEditor.
 *
 * Edita valor total + lista de condições de pagamento (toggleable). O
 * valor renderiza formatado "3.000,00" quando blur, e em raw editável
 * quando focused — UX que evita perder o cursor durante digitação.
 *
 * Condições de pagamento vêm de presets aplicados no createProposal —
 * aqui só toggle de visibilidade. Adicionar novos termos passa pelo
 * ApplyPresetButton (não está neste card).
 *
 * Extraído do ProposalEditor.tsx na fase J (v0.10.97).
 */

import type { ReactNode } from 'react'
import { useState } from 'react'
import { DollarSign } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { cn } from '@/lib/utils'
import { CardHeader, FieldLabel } from './EditorPrimitives'
import type {
  BlockContentInvestment,
  PaymentTerm,
  ProposalBlock,
  ProposalBlockContent,
} from '@/lib/proposal-types'

export function InvestimentoCard({
  block,
  onChange,
  headerExtra,
}: {
  block: ProposalBlock
  onChange: (c: ProposalBlockContent) => void
  headerExtra?: ReactNode
}) {
  const content = block.content as BlockContentInvestment
  const terms = (content.payment_terms as PaymentTerm[] | undefined) ?? []

  const [focused, setFocused] = useState(false)

  const updateTotal = (raw: string) => {
    // Strip everything except digits, comma, period
    const num = parseFloat(
      raw.replace(/[^\d,.-]/g, '').replace(/\./g, '').replace(',', '.'),
    )
    onChange({ ...content, total_amount: isNaN(num) ? 0 : num })
  }

  const toggleTerm = (i: number) => {
    const next = terms.map((t, idx) =>
      idx === i
        ? {
            ...t,
            visible:
              (t as { visible?: boolean }).visible === false ? true : false,
          }
        : t,
    ) as PaymentTerm[]
    onChange({ ...content, payment_terms: next })
  }

  // Display: raw editable value when focused, formatted "3.000,00" when blurred
  const displayAmount = focused
    ? content.total_amount > 0
      ? String(content.total_amount).replace('.', ',')
      : ''
    : content.total_amount > 0
      ? content.total_amount.toLocaleString('pt-BR', {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })
      : ''

  return (
    <Card className="p-5">
      <CardHeader
        icon={<DollarSign className="h-4 w-4" />}
        title="Investimento"
        action={headerExtra}
      />

      <div className="space-y-5">
        {/* Total */}
        <div>
          <FieldLabel>Valor total</FieldLabel>
          <div className="mt-1.5 flex items-center gap-2">
            <span className="font-mono text-sm text-muted-foreground">R$</span>
            <Input
              value={displayAmount}
              onChange={(e) => updateTotal(e.target.value)}
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
              placeholder="0,00"
              className="font-mono text-lg font-bold tabular-nums"
            />
          </div>
        </div>

        {/* Payment terms */}
        {terms.length > 0 && (
          <div>
            <FieldLabel>Condições de pagamento</FieldLabel>
            <div className="mt-2 space-y-2">
              {terms.map((term, i) => {
                const t = term as {
                  label?: string
                  description?: string
                  discount_percent?: number
                  visible?: boolean
                }
                const active = t.visible !== false
                return (
                  <label
                    key={i}
                    className={cn(
                      'flex cursor-pointer items-start gap-3 rounded-lg border border-border p-3 transition-colors',
                      active ? 'bg-card' : 'opacity-50',
                    )}
                  >
                    <Checkbox
                      checked={active}
                      onCheckedChange={() => toggleTerm(i)}
                      className="mt-0.5 shrink-0 data-[state=checked]:bg-foreground data-[state=checked]:border-foreground data-[state=checked]:text-background"
                    />
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-foreground">
                        {t.label || 'Sem título'}
                      </div>
                      {t.description && (
                        <div className="text-xs leading-relaxed text-muted-foreground">
                          {t.description}
                        </div>
                      )}
                      {t.discount_percent && (
                        <div className="mt-1 inline-flex rounded bg-success/15 px-1.5 py-0.5 font-mono text-[10px] text-success">
                          {t.discount_percent}% de desconto
                        </div>
                      )}
                    </div>
                  </label>
                )
              })}
            </div>
          </div>
        )}
      </div>
    </Card>
  )
}
