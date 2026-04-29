'use client'

import {
  Bell,
  Check,
  CheckCircle2,
  Clock,
  Eye,
  Mail,
  RefreshCw,
  Send,
  Trash2,
} from 'lucide-react'

/**
 * The activity feed body — list of email sends + recipient-side events
 * (link opened, form started, form submitted) for a single briefing.
 *
 * Just the content, no container/modal/header. Two callers wrap it:
 *
 *   - app/admin/clientes/[id]/_components/ActivityHistoryModal.tsx
 *     (hand-rolled overlay, used in client detail page)
 *   - app/admin/briefings/_components/NotifHistoryModal.tsx
 *     (Radix Dialog wrapper, used in briefings list)
 *
 * Each container handles its own header/empty/loading shell. This
 * component is the shared inner body — events list with icon mapping,
 * status badges (sent/failed), and recipient role markers (CC vs
 * Principal). Originally inline-duplicated in both pages; consolidated
 * v0.10.102.
 */

export interface ActivityEntry {
  type: string
  status: string
  sent_at: string
  details: Record<string, string>
}

export function BriefingActivityFeed({ history }: { history: ActivityEntry[] }) {
  return (
    <div className="flex flex-col gap-2">
      {history.map((n, i) => {
        const isClientEvent = [
          'link_opened',
          'form_started',
          'form_submitted',
        ].includes(n.type)

        const lblMap: Record<
          string,
          { icon: React.ReactNode; label: string; clientEvent?: boolean }
        > = {
          // Admin sends
          email_client: { icon: <Send size={13} />, label: 'Email enviado' },
          email_admin: { icon: <Mail size={13} />, label: 'Notificação ao admin' },
          reminder: { icon: <Bell size={13} />, label: 'Lembrete enviado' },
          resend: { icon: <RefreshCw size={13} />, label: 'Reenvio' },
          // Client activity
          link_opened: {
            icon: <Eye size={13} className="text-info" />,
            label: 'Link acessado',
            clientEvent: true,
          },
          form_started: {
            icon: <Clock size={13} className="text-warning" />,
            label: 'Preenchimento iniciado',
            clientEvent: true,
          },
          form_submitted: {
            icon: <CheckCircle2 size={13} className="text-success" />,
            label: 'Briefing concluído',
            clientEvent: true,
          },
        }
        const entry = lblMap[n.type] || { icon: <Bell size={13} />, label: n.type }

        return (
          <div
            key={i}
            className={`rounded-lg border px-4 py-3 ${
              isClientEvent ? 'border-border bg-card' : 'border-border bg-muted/30'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="inline-flex items-center gap-1.5 text-sm font-medium">
                {entry.icon} {entry.label}
              </span>
              {!isClientEvent && (
                <span
                  className={`inline-flex items-center gap-1 text-xs font-medium ${
                    n.status === 'sent' ? 'text-success' : 'text-destructive'
                  }`}
                >
                  {n.status === 'sent' ? (
                    <>
                      <Check size={12} /> Entregue
                    </>
                  ) : (
                    <>
                      <Trash2 size={12} /> Falhou
                    </>
                  )}
                </span>
              )}
            </div>
            {n.details?.to && (
              <div className="mt-1.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                {n.details.role === 'cc' && (
                  <span className="rounded-md border border-border bg-muted/60 px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                    CC
                  </span>
                )}
                {n.details.role === 'primary' && (
                  <span className="rounded-md border border-success/30 bg-success/10 px-1.5 py-0.5 text-[10px] font-medium text-success">
                    Principal
                  </span>
                )}
                {n.details.name && (
                  <span className="font-medium text-foreground">{n.details.name}</span>
                )}
                {n.details.name && <span className="text-muted-foreground/50">·</span>}
                <span>{n.details.to}</span>
              </div>
            )}
            <div className="text-[10px] text-muted-foreground/60 mt-1">
              {new Date(n.sent_at).toLocaleString('pt-BR')}
            </div>
          </div>
        )
      })}
    </div>
  )
}
