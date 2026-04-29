'use client'

import { Pencil, Search } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Modal } from './Modal'
import { DiffEntries } from './DiffEntries'

/**
 * Dedicated diff view — opened from the "Nx atualizado" badge in a
 * briefing row. Different from the diff toggle inside ResponsesModal
 * because this one is the operator's primary intent (they clicked
 * specifically to see the changes), so:
 *
 *   - The header surfaces the update count prominently
 *   - The empty state is more apologetic ("Não foi possível comparar")
 *     because reaching this view with empty diff usually means an
 *     older record without versioning history
 *   - There's a follow-up button to jump straight to the full
 *     responses view
 *
 * Pulled out of app/admin/briefings/page.tsx in v0.10.102.
 */

interface Briefing {
  id: string
  slug: string
  type: string
  type_label: string
  status: string
  language?: string
  update_count?: number
  clients: { id: string; name: string; company: string; email: string }
}

export function DiffModal({
  briefing,
  diff,
  loading,
  onClose,
  onViewResponses,
}: {
  briefing: Briefing
  diff: Record<string, { old: unknown; new: unknown }>
  loading: boolean
  onClose: () => void
  /**
   * Called when the user wants to bail out of the diff view and see
   * the full response set instead. Caller closes this modal and opens
   * the responses one.
   */
  onViewResponses: () => void
}) {
  return (
    <Modal onClose={onClose} wide>
      <div className="mb-5 pb-4 border-b border-border/60">
        <div className="font-bold text-lg tracking-tight">{briefing.clients?.company}</div>
        <div className="flex items-center gap-2 mt-1.5">
          <Badge variant="outline" className="text-[10px] font-medium gap-1">
            <Pencil size={10} /> {briefing.update_count}x atualizado
          </Badge>
          <span className="text-sm text-muted-foreground">{briefing.type_label}</span>
        </div>
      </div>
      {loading ? (
        <div className="flex justify-center py-10">
          <div className="spinner" />
        </div>
      ) : Object.keys(diff).length === 0 ? (
        <div className="text-center py-10 text-muted-foreground">
          <Search className="h-10 w-10 mx-auto mb-3 opacity-40" />
          <div className="text-sm mb-4">Não foi possível comparar versões.</div>
          <Button variant="outline" onClick={onViewResponses}>
            Ver respostas →
          </Button>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <div className="text-xs text-muted-foreground mb-1">
            {Object.keys(diff).length} campos alterados
          </div>
          <DiffEntries diff={diff} language={briefing.language} />
          <Button variant="ghost" onClick={onViewResponses} className="mt-1">
            Ver todas as respostas →
          </Button>
        </div>
      )}
    </Modal>
  )
}
