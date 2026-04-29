'use client'

import { Clipboard, ClipboardList, FileText, Pencil } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { FIELD_LABELS_PT, FIELD_LABELS_EN } from '@/lib/briefing-types'
import { ResponsesContent } from '@/components/admin/briefings/ResponsesContent'
import { Modal } from './Modal'
import { DiffEntries } from './DiffEntries'
import { fmt } from './formatters'

/**
 * Modal that shows a briefing's submitted responses. Two display modes
 * controlled by `showDiffView`:
 *
 *   - false (default) → renders the full response set via ResponsesContent
 *   - true            → renders just the diff entries against the previous
 *                       version (only available when responseVersions > 1)
 *
 * Toggle bar appears only when there's a previous version to diff against.
 * Both modes share the modal header (company, type, completed date) and
 * the action row (Copy all, Export PDF).
 *
 * Pulled out of app/admin/briefings/page.tsx in v0.10.102. State and
 * handlers stay in the parent (page-level useState) — this component is
 * a pure presentation surface that takes flat props.
 */

interface Briefing {
  id: string
  slug: string
  type: string
  type_label: string
  status: string
  completed_at: string | null
  language?: string
  clients: { id: string; name: string; company: string; email: string }
}

export function ResponsesModal({
  briefing,
  responses,
  responseDiff,
  responseVersions,
  showDiffView,
  copied,
  renderFileValue,
  onClose,
  onCopyAll,
  onExportPDF,
  onToggleDiff,
}: {
  briefing: Briefing
  responses: Record<string, unknown> | null
  responseDiff: Record<string, { old: unknown; new: unknown }> | null
  responseVersions: number
  showDiffView: boolean
  copied: boolean
  renderFileValue: (v: unknown) => React.ReactNode
  onClose: () => void
  onCopyAll: () => void
  onExportPDF: () => void
  onToggleDiff: (showDiff: boolean) => void
}) {
  return (
    <Modal onClose={onClose} wide>
      <div className="mb-5 pb-4 border-b border-border/60">
        <div className="font-bold text-lg tracking-tight">{briefing.clients?.company}</div>
        <div className="flex items-center gap-2 mt-1.5 flex-wrap">
          <Badge variant="outline" className="text-[11px] font-medium">{briefing.type_label}</Badge>
          {briefing.clients?.name && (
            <span className="text-sm text-muted-foreground">{briefing.clients.name}</span>
          )}
        </div>
        {briefing.completed_at && (
          <div className="text-xs text-muted-foreground mt-1.5">Concluído em {fmt(briefing.completed_at)}</div>
        )}
      </div>
      <div className="flex gap-2 mb-5">
        <Button onClick={onCopyAll} variant="outline" className="flex-1">
          <Clipboard size={14} />{copied ? 'Copiado!' : 'Copiar tudo'}
        </Button>
        <Button onClick={onExportPDF} variant="outline" className="flex-1">
          <FileText size={14} /> Exportar PDF
        </Button>
      </div>
      {responseVersions > 1 && responseDiff && (
        <div className="mb-4">
          <div className="flex gap-2">
            <button
              onClick={() => onToggleDiff(false)}
              className={`flex-1 text-xs py-2 rounded-lg border transition-colors inline-flex items-center justify-center gap-1.5 ${
                !showDiffView
                  ? 'border-foreground/20 bg-muted text-foreground font-medium'
                  : 'border-border text-muted-foreground hover:bg-muted/40 hover:text-foreground'
              }`}
            >
              <ClipboardList size={12} /> Respostas atuais
            </button>
            <button
              onClick={() => onToggleDiff(true)}
              className={`flex-1 text-xs py-2 rounded-lg border transition-colors inline-flex items-center justify-center gap-2 ${
                showDiffView
                  ? 'border-foreground/20 bg-muted text-foreground font-medium'
                  : 'border-border text-muted-foreground hover:bg-muted/40 hover:text-foreground'
              }`}
            >
              <Pencil size={12} /> Ver alterações
              <span className="rounded-md border border-border bg-muted/60 px-1.5 py-0.5 text-[10px] font-bold text-foreground">
                {Object.keys(responseDiff).length}
              </span>
            </button>
          </div>
          {showDiffView && (
            <div className="mt-3 flex flex-col gap-2">
              {Object.keys(responseDiff).length === 0 ? (
                <div className="text-center py-8 text-muted-foreground text-sm">
                  Nenhuma alteração detectada
                </div>
              ) : (
                <DiffEntries diff={responseDiff} language={briefing.language} />
              )}
            </div>
          )}
        </div>
      )}
      {responses && !showDiffView && (
        <ResponsesContent
          responses={responses}
          language={briefing.language}
          companyName={briefing.clients?.company || 'briefing'}
          renderFileValue={renderFileValue}
          labelMapPT={FIELD_LABELS_PT}
          labelMapEN={FIELD_LABELS_EN}
        />
      )}
      {!responses && (
        <div className="flex justify-center py-10">
          <div className="spinner" />
        </div>
      )}
    </Modal>
  )
}
