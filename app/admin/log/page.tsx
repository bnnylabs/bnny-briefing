'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import {
  ArrowLeft,
  ClipboardList,
  Copy,
  Trash2,
  type LucideIcon,
} from 'lucide-react'

import { Button } from '@/components/ui/button'

interface ActivityLog {
  id: string
  action: string
  details: Record<string, unknown> | null
  created_at: string
}

const ACTION_META: Record<string, { label: string; icon: LucideIcon }> = {
  delete_briefing: { label: 'Briefing excluído', icon: Trash2 },
  bulk_delete_briefings: { label: 'Exclusão em lote', icon: Trash2 },
  duplicate_briefing: { label: 'Briefing duplicado', icon: Copy },
}

function fmt(d: string) {
  return new Date(d).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export default function ActivityLogPage() {
  const router = useRouter()
  const [logs, setLogs] = React.useState<ActivityLog[]>([])
  const [loading, setLoading] = React.useState(true)

  React.useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      const res = await fetch('/api/admin/activity-log')
      if (res.status === 401) {
        router.push('/admin')
        return
      }
      if (res.ok) {
        const d = await res.json()
        if (!cancelled) setLogs(d.logs || [])
      }
      if (!cancelled) setLoading(false)
    }
    load()
    return () => {
      cancelled = true
    }
  }, [router])

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-4xl p-6">
        <div className="mb-6 flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.push('/admin')}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="font-mono text-xl font-bold tracking-tight">
              Log de atividades
            </h1>
            <p className="text-xs text-muted-foreground">
              Histórico das últimas 100 ações no painel
            </p>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="spinner" />
          </div>
        ) : logs.length === 0 ? (
          <div className="py-20 text-center text-muted-foreground">
            <ClipboardList className="mx-auto mb-3 h-10 w-10 opacity-40" />
            <div className="font-medium">Nenhuma atividade registrada ainda</div>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {logs.map((log) => {
              const meta = ACTION_META[log.action]
              const Icon = meta?.icon ?? ClipboardList
              const label = meta?.label ?? log.action
              return (
                <div
                  key={log.id}
                  className="flex items-start justify-between gap-4 rounded-lg border border-border bg-card px-4 py-3"
                >
                  <div className="flex min-w-0 items-start gap-3">
                    <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
                      <Icon size={13} strokeWidth={1.75} />
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm font-semibold">{label}</div>
                      {log.details?.company ? (
                        <div className="mt-1 text-xs text-muted-foreground">
                          {String(log.details.company)}
                          {log.details.type_label
                            ? ` · ${String(log.details.type_label)}`
                            : ''}
                        </div>
                      ) : null}
                      {log.details?.count ? (
                        <div className="mt-1 text-xs text-muted-foreground">
                          {String(log.details.count)} briefings excluídos
                        </div>
                      ) : null}
                    </div>
                  </div>
                  <span className="shrink-0 whitespace-nowrap text-xs text-muted-foreground">
                    {fmt(log.created_at)}
                  </span>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
