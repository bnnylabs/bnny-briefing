/**
 * Briefing list page formatters — date display + ISO day conversion.
 *
 * Extracted from app/admin/briefings/page.tsx (v0.10.101). Kept under
 * the briefings folder rather than promoted to a global utils file
 * because two of these helpers (`fmt`, `timeAgo`) have briefing-list-
 * specific formatting choices (pt-BR locale hardcoded, "há X" prefix)
 * that don't belong in a generic date library.
 *
 * If a sibling page (e.g. proposals list) ends up needing the same
 * shape, promote then. Premature global utility = leaks specific
 * formatting choices into other pages by accident.
 */

/** Format Date as YYYY-MM-DD string in local time (matches existing date filter format). */
export function toIsoDay(d: Date): string {
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

/** Compact pt-BR date+time. Returns '—' on null. */
export function fmt(d: string | null): string {
  if (!d) return '—'
  return new Date(d).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

/**
 * Relative time in pt-BR — "há 5min", "há 2h", "há 3 dias".
 * Coarse on purpose: the briefing list shows a column of these and a
 * fixed format reads better than "há 1 dia, 4 horas atrás".
 */
export function timeAgo(d: string): string {
  const diff = Date.now() - new Date(d).getTime()
  const mins = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days = Math.floor(diff / 86400000)
  if (mins < 60) return `há ${mins}min`
  if (hours < 24) return `há ${hours}h`
  if (days === 1) return 'há 1 dia'
  return `há ${days} dias`
}
