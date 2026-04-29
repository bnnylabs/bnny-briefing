'use client'

import {
  BriefingActivityFeed,
  type ActivityEntry,
} from '@/components/admin/briefings/BriefingActivityFeed'
import { Modal } from './Modal'

/**
 * Notification history modal — opened from the briefing list row's
 * activity action. Same body as `ActivityHistoryModal` in the client
 * detail page (uses the same shared `BriefingActivityFeed`), but
 * wrapped in the briefing list's Radix Dialog scaffold instead of the
 * hand-rolled overlay used over there.
 *
 * Pulled out of app/admin/briefings/page.tsx in v0.10.102.
 */

export type { ActivityEntry }

interface Briefing {
  id: string
  type_label: string
  clients: { company: string }
}

export function NotifHistoryModal({
  briefing,
  history,
  onClose,
}: {
  briefing: Briefing
  history: ActivityEntry[]
  onClose: () => void
}) {
  return (
    <Modal onClose={onClose}>
      <div className="mb-5">
        <div className="font-bold text-lg tracking-tight">Histórico de atividades</div>
        <div className="text-sm text-muted-foreground mt-0.5">
          {briefing.clients?.company} · {briefing.type_label}
        </div>
      </div>
      {history.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground text-sm">
          Nenhuma atividade registrada
        </div>
      ) : (
        <BriefingActivityFeed history={history} />
      )}
    </Modal>
  )
}
