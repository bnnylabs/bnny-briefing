'use client'

import { useRouter } from 'next/navigation'
import {
  BellRing,
  Check,
  ClipboardList,
  Copy,
  Eye,
  Lock,
  Mail,
  MoreHorizontal,
  Plus,
  ScrollText,
  Send,
  Unlock,
  Link as LinkIcon,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { IconButton } from '@/components/ui/icon-button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import {
  BriefingStatusIcon,
  BRIEFING_STATUS_LABELS,
} from '@/components/admin/briefings/BriefingStatusBadge'

/**
 * Briefings list card for the client detail page sidebar — shows every
 * briefing the client has, grouped status + actions per row.
 *
 * Pulled out of app/admin/clientes/[id]/page.tsx in v0.10.103. Two
 * dedup wins came along: BRIEFING_STATUS_LABELS and BriefingStatusIcon
 * were redefined locally before, even though both already lived in
 * components/admin/briefings/BriefingStatusBadge.tsx. Now imports from
 * the shared module.
 *
 * State stays in the parent (briefings, copiedSlug, actionDone are all
 * page-level useState). Each row's action dispatches a callback the
 * parent provides — `viewResponses`, `copyBriefingLink`, `sendReminder`,
 * `resendEmail`, `toggleLock`, `viewActivity`. Empty state shows a
 * single "Criar o primeiro" CTA that navigates to /admin/novo with the
 * client_id pre-selected.
 *
 * The recipient tooltip and action dropdown are inline because they
 * carry briefing-specific shape (recipients array, status-conditional
 * actions). Splitting further would create more navigation cost than it
 * saves at this size.
 */

interface BriefingRecipient {
  email: string
  name: string
  role: 'primary' | 'cc'
}

export interface ClientBriefing {
  id: string
  slug: string
  type: string
  type_label: string
  status: string
  language?: string
  created_at: string
  completed_at: string | null
  editing_locked?: boolean
  recipients?: BriefingRecipient[]
}

/**
 * Generic over briefing shape — callers may have richer types
 * (internal_notes, expires_at, etc.) that they keep in their own
 * state. The card only reads the fields above; extra fields ride
 * along untouched and flow back through `onViewActivity`.
 */
export interface ClientBriefingsCardProps<B extends ClientBriefing> {
  /** Client ID — used by the "Criar o primeiro" CTA + duplicate links. */
  clientId: string
  briefings: B[]
  /** Slug whose link was just copied — drives the temporary checkmark. */
  copiedSlug: string | null
  /** `${slug}_resend` or `${slug}_reminder` — drives the success checkmark. */
  actionDone: string | null
  /** pt-BR formatted date helper from the parent (avoids importing date utils). */
  fmt: (d: string | null) => string
  /** Open the responses modal for this slug. */
  onViewResponses: (slug: string) => void
  /** Copy the public briefing link for this slug to clipboard. */
  onCopyLink: (slug: string) => void
  /** Open the recipient picker in 'reminder' mode for this slug. */
  onSendReminder: (slug: string) => void
  /** Open the recipient picker in 'resend' mode for this slug. */
  onResendEmail: (slug: string) => void
  /** Toggle the editing lock — currentLocked is the value before flip. */
  onToggleLock: (slug: string, currentLocked: boolean) => void
  /** Open the activity history modal for this briefing. */
  onViewActivity: (b: B) => void
}

export function ClientBriefingsCard<B extends ClientBriefing>({
  clientId,
  briefings,
  copiedSlug,
  actionDone,
  fmt,
  onViewResponses,
  onCopyLink,
  onSendReminder,
  onResendEmail,
  onToggleLock,
  onViewActivity,
}: ClientBriefingsCardProps<B>) {
  const router = useRouter()

  return (
    <Card className="p-5">
      <div className="mb-4 flex items-center gap-1.5 text-[15px] font-bold tracking-tight">
        <ClipboardList className="h-4 w-4" /> Briefings
        <span className="ml-1 text-xs font-normal text-muted-foreground">
          {briefings.length} no histórico
        </span>
      </div>
      {briefings.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-8 text-center">
          <ClipboardList className="h-8 w-8 text-muted-foreground/40" strokeWidth={1.5} />
          <div className="text-sm text-muted-foreground">Nenhum briefing ainda</div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => router.push(`/admin/novo?client_id=${clientId}`)}
          >
            <Plus size={13} /> Criar o primeiro
          </Button>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {briefings.map((b) => (
            <div
              key={b.id}
              className="rounded-lg border border-border bg-muted/30 px-3.5 py-3"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="mb-1.5 text-sm font-semibold">{b.type_label}</div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span
                      className={cn(
                        'inline-flex items-center gap-1 whitespace-nowrap rounded-md border px-2 py-0.5 text-[11px] font-medium',
                        b.status === 'concluido' && 'border-success/30 bg-success/10 text-success',
                        b.status === 'em_andamento' && 'border-warning/30 bg-warning/10 text-warning',
                        b.status === 'visualizado' && 'border-info/30 bg-info/10 text-info',
                        b.status === 'enviado' && 'border-border bg-muted/60 text-muted-foreground',
                      )}
                    >
                      <BriefingStatusIcon status={b.status} />
                      {BRIEFING_STATUS_LABELS[b.status]}
                    </span>
                    <span className="whitespace-nowrap text-xs text-muted-foreground">
                      {fmt(b.created_at)}
                    </span>
                    {b.completed_at && (
                      <span className="whitespace-nowrap text-xs text-muted-foreground">
                        · concluído {fmt(b.completed_at)}
                      </span>
                    )}
                    {(b.recipients?.length ?? 0) > 0 && (
                      <TooltipProvider delayDuration={200}>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="inline-flex cursor-default items-center gap-1 rounded-md border border-border bg-muted/60 px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                              <Send size={9} />
                              {b.recipients!.length}
                            </span>
                          </TooltipTrigger>
                          <TooltipContent
                            side="bottom"
                            className="bg-popover text-popover-foreground border border-border p-0 shadow-md"
                          >
                            <div className="min-w-44 p-3">
                              <div className="mb-2 text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
                                Enviado para
                              </div>
                              <div className="flex flex-col gap-2">
                                {b.recipients!.map((r, i) => (
                                  <div key={i} className="flex items-center gap-2">
                                    <div className="min-w-0 flex-1">
                                      <div className="truncate text-xs font-medium text-foreground">
                                        {r.name}
                                      </div>
                                      <div className="truncate text-[10px] text-muted-foreground">
                                        {r.email}
                                      </div>
                                    </div>
                                    <span
                                      className={cn(
                                        'shrink-0 rounded-md border px-1.5 py-0 text-[10px] font-medium',
                                        r.role === 'primary'
                                          ? 'border-success/30 bg-success/10 text-success'
                                          : 'border-border bg-muted/60 text-muted-foreground',
                                      )}
                                    >
                                      {r.role === 'primary' ? 'Principal' : 'CC'}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1.5">
                  {b.status === 'concluido' && (
                    <Button size="sm" onClick={() => onViewResponses(b.slug)}>
                      <Eye size={13} />
                      Ver respostas
                    </Button>
                  )}
                  <IconButton
                    icon={
                      copiedSlug === b.slug ? (
                        <Check className="h-4 w-4 text-success" />
                      ) : (
                        <LinkIcon className="h-4 w-4" />
                      )
                    }
                    label="Copiar link"
                    size="icon"
                    onClick={() => onCopyLink(b.slug)}
                  />
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button
                        type="button"
                        aria-label="Mais ações"
                        className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        <MoreHorizontal size={15} />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-52">
                      {b.status !== 'concluido' && (
                        <>
                          <DropdownMenuItem onClick={() => onResendEmail(b.slug)}>
                            {actionDone === b.slug + '_resend' ? (
                              <Check size={14} className="text-success" />
                            ) : (
                              <Mail size={14} />
                            )}
                            Reenviar email…
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => onSendReminder(b.slug)}>
                            {actionDone === b.slug + '_reminder' ? (
                              <Check size={14} className="text-success" />
                            ) : (
                              <BellRing size={14} />
                            )}
                            Enviar lembrete…
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                        </>
                      )}
                      {b.status === 'concluido' && (
                        <>
                          <DropdownMenuItem onClick={() => onToggleLock(b.slug, !!b.editing_locked)}>
                            {b.editing_locked ? <Unlock size={14} /> : <Lock size={14} />}
                            {b.editing_locked ? 'Liberar edição' : 'Bloquear edição'}
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                        </>
                      )}
                      <DropdownMenuItem
                        onClick={() =>
                          router.push(`/admin/novo?client_id=${clientId}&duplicate=${b.slug}`)
                        }
                      >
                        <Copy size={14} />
                        Duplicar briefing
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={() => onViewActivity(b)}>
                        <ScrollText size={14} />
                        Histórico de atividades
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  )
}
