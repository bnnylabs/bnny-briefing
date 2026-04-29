/**
 * Helpers de formatação compartilhados pelo ProposalEditor e seus cards.
 *
 * Antes da fase J, estes 3 helpers viviam soltos no topo do
 * ProposalEditor.tsx (1551L). Movi pra cá quando os cards saíram pra
 * arquivos próprios — todos eles consomem alguma destas três funções.
 *
 * Mantém pt-BR fixo: o Briefing System é PT-only por enquanto. Quando o
 * EN do operador (não do recipient) for relevante, generaliza aqui.
 */

/** Formata número como moeda PT-BR. Fallback robusto pra currency inválido. */
export function fmtCurrency(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency,
      minimumFractionDigits: 2,
    }).format(amount)
  } catch {
    return `R$ ${amount.toFixed(2)}`
  }
}

/**
 * Formata data ISO (yyyy-mm-dd) curta: "29 abr. 2026".
 * Recebe null → "—". Cuidado com timezone: força T00:00:00 pra evitar
 * shift de dia em fusos a oeste de UTC.
 */
export function fmtDate(iso: string | null): string {
  if (!iso) return '—'
  return new Date(`${iso}T00:00:00`).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

/**
 * Formata datetime ISO completo: "29 abr. 26".
 * Diferente de fmtDate (que recebe yyyy-mm-dd e renderiza ano completo),
 * essa aceita ISO completo e usa year:'2-digit'. Usada na DocumentView
 * pra cabeçalhos compactos.
 */
export function fmtDateLong(iso: string): string {
  return new Date(iso).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'short',
    year: '2-digit',
  })
}
