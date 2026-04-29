'use client'

import { CheckCircle2, Clock, Eye, Send } from 'lucide-react'
import { Badge } from '@/components/ui/badge'

/**
 * Status badge used in the briefing list rows + detail modals.
 *
 * Status values come from the `briefings.status` column in Supabase:
 *   - `enviado`      Briefing was sent, recipient hasn't opened the link yet
 *   - `visualizado`  Recipient opened the link (link_opened activity)
 *   - `em_andamento` Recipient started filling out (form_started activity)
 *   - `concluido`    Recipient submitted (form_submitted activity)
 *
 * Each status maps to a Badge variant and an inline icon. Status values
 * we don't recognize fall back to muted variant + raw status string —
 * defensive in case a DB row has unexpected data.
 */

const STATUS_LABELS: Record<string, string> = {
  enviado: 'Enviado',
  visualizado: 'Visualizado',
  em_andamento: 'Em andamento',
  concluido: 'Concluído',
}

const STATUS_VARIANTS: Record<string, 'muted' | 'info' | 'warning' | 'success'> = {
  enviado: 'muted',
  visualizado: 'info',
  em_andamento: 'warning',
  concluido: 'success',
}

export function BriefingStatusIcon({
  status,
  size = 11,
}: {
  status: string
  size?: number
}) {
  switch (status) {
    case 'enviado':
      return <Send size={size} />
    case 'visualizado':
      return <Eye size={size} />
    case 'em_andamento':
      return <Clock size={size} />
    case 'concluido':
      return <CheckCircle2 size={size} />
    default:
      return null
  }
}

export function BriefingStatusBadge({ status }: { status: string }) {
  return (
    <Badge
      variant={STATUS_VARIANTS[status] || 'muted'}
      className="text-[11px] font-medium whitespace-nowrap"
    >
      <BriefingStatusIcon status={status} />
      {STATUS_LABELS[status] || status}
    </Badge>
  )
}

/** Re-exported in case callers want to render the label without the badge chrome. */
export { STATUS_LABELS as BRIEFING_STATUS_LABELS }
