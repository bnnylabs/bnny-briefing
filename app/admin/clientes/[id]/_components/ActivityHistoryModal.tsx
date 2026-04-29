'use client'

import { X } from 'lucide-react'
import {
  BriefingActivityFeed,
  type ActivityEntry,
} from '@/components/admin/briefings/BriefingActivityFeed'

/**
 * Modal showing the activity history of a single briefing — sent
 * emails (admin + client), reminders/resends, and recipient-side
 * events (link opened, form started, form submitted).
 *
 * Container: hand-rolled overlay (`fixed inset-0`). Kept as-is when
 * the briefings list page also got a notification history modal in
 * v0.10.102 — that one uses Radix Dialog (Modal wrapper). Both share
 * the same body via BriefingActivityFeed; only the chrome differs.
 *
 * Migrating this one to Radix Dialog is a separate decision (focus
 * trapping, animation tokens) that doesn't belong in a refactor.
 */

export type { ActivityEntry }

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
          <BriefingActivityFeed history={history} />
        )}
      </div>
    </div>
  )
}
