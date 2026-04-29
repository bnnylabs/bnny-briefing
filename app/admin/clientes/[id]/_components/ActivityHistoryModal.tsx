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
  X,
} from 'lucide-react'

/**
 * Modal showing the activity history of a single briefing — sent
 * emails (admin + client), reminders/resends, and recipient-side
 * events (link opened, form started, form submitted).
 *
 * Extracted from the client detail page (v0.10.99). Why an isolated
 * component makes sense:
 *   - ~70L of its own JSX with internal label/icon mapping
 *   - No write actions (read-only feed) — props are flat data
 *   - Same UI shape regardless of which briefing is being inspected
 *
 * Implementation note: this is a hand-rolled overlay (`fixed inset-0
 * z-50 ...`) rather than the Radix Dialog. Kept as-is during the
 * refactor — switching to Dialog is a separate decision (focus
 * trapping, animation tokens) that doesn't belong in a "no-behavior-
 * change" extraction.
 */

export interface ActivityEntry {
  type: string
  status: string
  sent_at: string
  details: Record<string, string>
}

export interface ActivityHistoryModalProps {
  /** Truthy = open. The label string is rendered as the briefing label. */
  briefingLabel: string | null
  companyName: string
  loading: boolean
  history: ActivityEntry[]
  onClose: () => void
}

export function ActivityHistoryModal({
  briefingLabel,
  companyName,
  loading,
  history,
  onClose,
}: ActivityHistoryModalProps) {
  if (!briefingLabel) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-in fade-in-0 duration-150"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-md rounded-xl bg-card border border-border p-6 shadow-2xl animate-in fade-in-0 zoom-in-95 slide-in-from-bottom-1 duration-200 max-h-[88vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          aria-label="Fechar histórico"
          className="absolute right-3.5 top-3.5 flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <X size={15} />
        </button>
        <div className="mb-5">
          <div className="font-bold text-lg tracking-tight">Histórico de atividades</div>
          <div className="text-sm text-muted-foreground mt-0.5">
            {companyName} · {briefingLabel}
          </div>
        </div>
        {loading ? (
          <div className="py-8 text-center text-sm text-muted-foreground">Carregando…</div>
        ) : history.length === 0 ? (
          <div className="py-8 text-center text-sm text-muted-foreground">
            Nenhuma atividade registrada
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {history.map((n, i) => {
              const isClientEvent = [
                'link_opened',
                'form_started',
                'form_submitted',
              ].includes(n.type)
              const lblMap: Record<string, { icon: React.ReactNode; label: string }> = {
                email_client: { icon: <Send size={13} />, label: 'Email enviado' },
                email_admin: { icon: <Mail size={13} />, label: 'Notificação ao admin' },
                reminder: { icon: <Bell size={13} />, label: 'Lembrete enviado' },
                resend: { icon: <RefreshCw size={13} />, label: 'Reenvio' },
                link_opened: {
                  icon: <Eye size={13} className="text-info" />,
                  label: 'Link acessado',
                },
                form_started: {
                  icon: <Clock size={13} className="text-warning" />,
                  label: 'Preenchimento iniciado',
                },
                form_submitted: {
                  icon: <CheckCircle2 size={13} className="text-success" />,
                  label: 'Briefing concluído',
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
                        <span className="rounded-md border border-border bg-muted/60 px-1.5 py-0.5 text-[10px] font-medium">
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
        )}
      </div>
    </div>
  )
}
