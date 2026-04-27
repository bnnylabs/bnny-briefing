'use client'

import * as React from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  Activity,
  ArrowRight,
  Bell,
  CheckCircle2,
  Clock,
  FileText,
  Pencil,
  Plus,
  Send,
  Trash2,
  type LucideIcon,
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { BrandLogo } from '@/components/brand/BrandLogo'
import { useToast, ToastContainer } from '@/components/toast'
import { cn } from '@/lib/utils'

interface Client {
  id: string
  name: string
  company: string
  email?: string
  phone?: string
}

interface Briefing {
  id: string
  slug: string
  type_label: string
  status: 'enviado' | 'visualizado' | 'em_andamento' | 'concluido'
  language?: string
  update_count?: number
  created_at: string
  completed_at: string | null
  clients: Client | null
}

interface ActivityLogEntry {
  id: string
  action: string
  details: Record<string, unknown> | null
  created_at: string
}

/**
 * /admin — when not authenticated, renders the login screen. When authed,
 * renders the dashboard. Login lives here so the unauthenticated route is
 * the predictable entry point of the panel.
 */
export default function AdminHome() {
  const [authed, setAuthed] = React.useState<boolean | null>(null)
  const router = useRouter()

  React.useEffect(() => {
    fetch('/api/briefings').then((r) => {
      setAuthed(r.status !== 401)
    })
  }, [])

  if (authed === null) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="spinner" />
      </div>
    )
  }

  if (!authed) {
    return <LoginScreen onAuthed={() => setAuthed(true)} />
  }

  return <Dashboard router={router} />
}

/* ──────────────────────────────────────────────────────────────────── */
/* Login                                                                 */
/* ──────────────────────────────────────────────────────────────────── */

function LoginScreen({ onAuthed }: { onAuthed: () => void }) {
  const router = useRouter()
  const [password, setPassword] = React.useState('')
  const [loginError, setLoginError] = React.useState('')
  const [submitting, setSubmitting] = React.useState(false)

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    const res = await fetch('/api/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    })
    setSubmitting(false)
    if (res.ok) {
      onAuthed()
      // Force the server layout to re-evaluate the cookie so the sidebar
      // appears (the layout had already rendered before the cookie was set).
      router.refresh()
    } else {
      setLoginError('Senha incorreta')
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm animate-in fade-in-0 duration-300">
        <div className="mb-8 flex flex-col items-center gap-1.5">
          <BrandLogo className="h-7 w-auto" />
          <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground/70">
            Painel
          </p>
        </div>
        <form onSubmit={handleLogin} className="flex flex-col gap-3">
          <Input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Senha de acesso"
            autoFocus
            className="h-11 text-base"
          />
          {loginError && (
            <p className="text-center text-sm text-destructive">{loginError}</p>
          )}
          <Button
            type="submit"
            disabled={submitting || !password}
            className="h-11 text-base font-bold"
          >
            {submitting ? 'Entrando…' : 'Entrar'}
          </Button>
        </form>
      </div>
    </div>
  )
}

/* ──────────────────────────────────────────────────────────────────── */
/* Dashboard                                                             */
/* ──────────────────────────────────────────────────────────────────── */

interface ProfileResponse {
  name: string
  photoUrl: string | null
  jobTitle: string
}

function Dashboard({ router }: { router: ReturnType<typeof useRouter> }) {
  const { toasts, remove } = useToast()
  const [briefings, setBriefings] = React.useState<Briefing[]>([])
  const [activity, setActivity] = React.useState<ActivityLogEntry[]>([])
  const [profile, setProfile] = React.useState<ProfileResponse | null>(null)
  const [loading, setLoading] = React.useState(true)

  React.useEffect(() => {
    let cancelled = false
    Promise.all([
      fetch('/api/briefings').then((r) => (r.ok ? r.json() : { briefings: [] })),
      fetch('/api/admin/activity-log').then((r) => (r.ok ? r.json() : { logs: [] })),
      fetch('/api/profile/me').then((r) => (r.ok ? r.json() : null)),
    ])
      .then(([b, a, p]) => {
        if (cancelled) return
        setBriefings(b.briefings || [])
        setActivity(a.logs || [])
        setProfile(p)
        setLoading(false)
      })
      .catch(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="spinner" />
      </div>
    )
  }

  const greeting = greet(profile?.name)
  const today = new Date().toLocaleDateString('pt-BR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  })

  // Derive widget data once
  const now = Date.now()
  const SEVEN_DAYS = 7 * 24 * 60 * 60 * 1000
  const recentlyConcluded = briefings
    .filter(
      (b) =>
        b.status === 'concluido' &&
        b.completed_at &&
        now - new Date(b.completed_at).getTime() < SEVEN_DAYS,
    )
    .sort(
      (a, b) =>
        new Date(b.completed_at!).getTime() -
        new Date(a.completed_at!).getTime(),
    )

  const recentlyEdited = briefings
    .filter((b) => (b.update_count || 0) > 0 && b.status === 'concluido')
    .sort(
      (a, b) =>
        new Date(b.completed_at || b.created_at).getTime() -
        new Date(a.completed_at || a.created_at).getTime(),
    )

  const awaitingYou = uniqueById([...recentlyConcluded, ...recentlyEdited]).slice(
    0,
    5,
  )

  const awaitingClient = briefings
    .filter((b) => b.status !== 'concluido')
    .sort(
      (a, b) =>
        new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
    )
    .slice(0, 5)

  const sentThisWeek = briefings.filter(
    (b) => now - new Date(b.created_at).getTime() < SEVEN_DAYS,
  ).length
  const concludedThisWeek = briefings.filter(
    (b) =>
      b.status === 'concluido' &&
      b.completed_at &&
      now - new Date(b.completed_at).getTime() < SEVEN_DAYS,
  ).length
  const conversionRate =
    sentThisWeek === 0
      ? 0
      : Math.round((concludedThisWeek / sentThisWeek) * 100)

  // Average completion time across every concluded briefing — measures
  // how long clients typically take from receiving the link to finishing.
  // Lifetime, not weekly, so the metric is stable as the operation grows.
  const completedBriefings = briefings.filter((b) => b.completed_at)
  const avgCompletionMs =
    completedBriefings.length === 0
      ? null
      : completedBriefings.reduce((sum, b) => {
          return (
            sum +
            (new Date(b.completed_at!).getTime() -
              new Date(b.created_at).getTime())
          )
        }, 0) / completedBriefings.length

  // 7-day sparkline: count of briefings sent on each of the last 7 days,
  // oldest → newest left to right. Plotted as bars below.
  const last7Days = Array.from({ length: 7 }, (_, i) => {
    const day = new Date()
    day.setDate(day.getDate() - (6 - i))
    day.setHours(0, 0, 0, 0)
    const next = new Date(day)
    next.setDate(next.getDate() + 1)
    return briefings.filter((b) => {
      const t = new Date(b.created_at).getTime()
      return t >= day.getTime() && t < next.getTime()
    }).length
  })

  const timelineItems = buildTimeline(briefings, activity).slice(0, 8)

  return (
    <div className="min-h-screen bg-background">
      <ToastContainer toasts={toasts} remove={remove} />

      <div className="mx-auto max-w-5xl p-6">
        {/* Greeting + primary CTA */}
        <div className="mb-7 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="font-mono text-xl font-bold tracking-tight">
              {greeting}, {profile?.name?.split(' ')[0] || 'Bnny'}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              <span className="capitalize">{today}</span>
              {awaitingYou.length > 0 && (
                <>
                  {' · '}
                  <span className="text-foreground">
                    {awaitingYou.length} briefing{awaitingYou.length > 1 ? 's' : ''} pra revisar
                  </span>
                </>
              )}
            </p>
          </div>
          <Button onClick={() => router.push('/admin/novo')} className="shrink-0">
            <Plus size={14} />
            Novo briefing
            <ArrowRight size={14} className="opacity-70" />
          </Button>
        </div>

        {/* KPI row — three focused metrics, no actions */}
        <div className="mb-3 grid grid-cols-1 gap-3 md:grid-cols-3">
          {/* Taxa semanal */}
          <Card className="flex h-full flex-col p-5">
            <h2 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
              Taxa semanal
            </h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Concluídos vs enviados
            </p>
            <div className="mt-5 flex flex-1 flex-col justify-end">
              <div className="font-mono text-3xl font-bold leading-none tabular-nums">
                {sentThisWeek === 0 ? '—' : `${conversionRate}%`}
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                {sentThisWeek === 0
                  ? 'Sem envios na semana'
                  : `${concludedThisWeek} de ${sentThisWeek} ${sentThisWeek === 1 ? 'envio' : 'envios'}`}
              </p>
            </div>
          </Card>

          {/* Tempo médio até concluir */}
          <Card className="flex h-full flex-col p-5">
            <h2 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
              Tempo médio
            </h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Até o cliente concluir
            </p>
            <div className="mt-5 flex flex-1 flex-col justify-end">
              <div className="font-mono text-3xl font-bold leading-none tabular-nums">
                {formatDuration(avgCompletionMs)}
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                {completedBriefings.length === 0
                  ? 'Sem briefings concluídos ainda'
                  : `${completedBriefings.length} ${completedBriefings.length === 1 ? 'briefing' : 'briefings'} considerado${completedBriefings.length === 1 ? '' : 's'}`}
              </p>
            </div>
          </Card>

          {/* Atividade 7 dias */}
          <Card className="flex h-full flex-col p-5">
            <h2 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
              Atividade
            </h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Volume dos últimos 7 dias
            </p>
            <div className="mt-5 flex flex-1 flex-col justify-end">
              <Sparkline data={last7Days} />
              <p className="mt-2 text-xs text-muted-foreground">
                {sentThisWeek} {sentThisWeek === 1 ? 'enviado' : 'enviados'}
                {' · '}
                {concludedThisWeek}{' '}
                {concludedThisWeek === 1 ? 'concluído' : 'concluídos'}
              </p>
            </div>
          </Card>
        </div>

        {/* Queue: awaiting your review */}
        <Card className="mb-3 p-5">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <div className="flex items-center gap-1.5 text-[15px] font-bold tracking-tight">
                <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
                Pra você revisar
              </div>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Briefings concluídos pelos clientes
              </p>
            </div>
            <span className="font-mono text-xs tabular-nums text-muted-foreground">
              {awaitingYou.length}
            </span>
          </div>
          {awaitingYou.length === 0 ? (
            <EmptyMini text="Nada pendente — você está em dia." />
          ) : (
            <ul className="space-y-1">
              {awaitingYou.map((b) => (
                <li key={b.id}>
                  <Link
                    href="/admin/briefings"
                    className="-mx-2 flex items-center justify-between gap-2 rounded-md px-2 py-2 transition-colors hover:bg-muted/60"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium">
                        {b.clients?.company || 'Cliente'}
                      </div>
                      <div className="truncate text-xs text-muted-foreground">
                        {b.type_label}
                        {(b.update_count || 0) > 0 && (
                          <span className="ml-1 inline-flex items-center gap-0.5 text-foreground/70">
                            · <Pencil size={9} /> {b.update_count}x
                          </span>
                        )}
                      </div>
                    </div>
                    <Badge variant="success" className="shrink-0 text-[10px]">
                      Concluído
                    </Badge>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>

        {/* Queue: awaiting client */}
        <Card className="mb-5 p-5">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <div className="flex items-center gap-1.5 text-[15px] font-bold tracking-tight">
                <Clock className="h-4 w-4 text-muted-foreground" />
                Aguardando cliente
              </div>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Você enviou, eles ainda não responderam
              </p>
            </div>
            <span className="font-mono text-xs tabular-nums text-muted-foreground">
              {awaitingClient.length}
            </span>
          </div>
          {awaitingClient.length === 0 ? (
            <EmptyMini text="Nenhum briefing pendente do lado deles." />
          ) : (
            <ul className="space-y-1">
              {awaitingClient.map((b) => {
                const days = daysSince(b.created_at)
                const overdue = days >= 5
                return (
                  <li key={b.id}>
                    <Link
                      href="/admin/briefings"
                      className="-mx-2 flex items-center justify-between gap-2 rounded-md px-2 py-2 transition-colors hover:bg-muted/60"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-medium">
                          {b.clients?.company || 'Cliente'}
                        </div>
                        <div className="truncate text-xs text-muted-foreground">
                          {b.type_label}
                        </div>
                      </div>
                      <span
                        className={cn(
                          'shrink-0 whitespace-nowrap text-xs tabular-nums',
                          overdue
                            ? 'font-medium text-destructive'
                            : 'text-muted-foreground',
                        )}
                      >
                        {formatDays(days)}
                      </span>
                    </Link>
                  </li>
                )
              })}
            </ul>
          )}
        </Card>

        {/* Activity timeline */}
        <Card className="mb-5 p-5">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <div className="flex items-center gap-1.5 text-[15px] font-bold tracking-tight">
                <Activity className="h-4 w-4 text-muted-foreground" />
                Atividade recente
              </div>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Os últimos eventos do painel
              </p>
            </div>
            <Link
              href="/admin/log"
              className="text-xs text-muted-foreground transition-colors hover:text-foreground"
            >
              Ver tudo →
            </Link>
          </div>
          {timelineItems.length === 0 ? (
            <EmptyMini text="Sem atividade ainda — crie um briefing para começar." />
          ) : (
            <ol className="space-y-1">
              {timelineItems.map((item) => (
                <li
                  key={`${item.kind}-${item.id}`}
                  className="flex items-start gap-3 rounded-md py-1.5"
                >
                  <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
                    <item.icon size={13} strokeWidth={1.75} />
                  </span>
                  <div className="min-w-0 flex-1 pt-0.5">
                    <div className="text-sm leading-snug">{item.text}</div>
                  </div>
                  <span className="shrink-0 whitespace-nowrap pt-1 text-xs tabular-nums text-muted-foreground">
                    {timeAgo(item.timestamp)}
                  </span>
                </li>
              ))}
            </ol>
          )}
        </Card>
      </div>
    </div>
  )
}

/* ──────────────────────────────────────────────────────────────────── */
/* UI bits                                                               */
/* ──────────────────────────────────────────────────────────────────── */

function EmptyMini({ text }: { text: string }) {
  return (
    <div className="py-4 text-center text-xs text-muted-foreground">{text}</div>
  )
}

/**
 * Tiny inline bar chart for the 'Atividade' KPI card. Renders one bar
 * per data point, height proportional to the largest value in the
 * series. Pure SVG, no chart library.
 *
 * Designed to sit at the bottom of a Card next to a 1-line subtitle —
 * the bars themselves are the visual hook, not exact values.
 */
function Sparkline({ data }: { data: number[] }) {
  const max = Math.max(...data, 1)
  const barCount = data.length
  const barWidth = 8
  const gap = 4
  const totalWidth = barCount * barWidth + (barCount - 1) * gap
  const height = 28
  return (
    <svg
      viewBox={`0 0 ${totalWidth} ${height}`}
      width={totalWidth}
      height={height}
      role="img"
      aria-label={`Volume diário: ${data.join(', ')}`}
      className="overflow-visible"
    >
      {data.map((value, i) => {
        const h = max === 0 ? 1 : Math.max(1, (value / max) * (height - 2))
        const isLast = i === data.length - 1
        return (
          <rect
            key={i}
            x={i * (barWidth + gap)}
            y={height - h}
            width={barWidth}
            height={h}
            rx={1.5}
            className={isLast ? 'fill-foreground' : 'fill-foreground/25'}
          />
        )
      })}
    </svg>
  )
}

/* ──────────────────────────────────────────────────────────────────── */
/* Helpers                                                               */
/* ──────────────────────────────────────────────────────────────────── */

function uniqueById<T extends { id: string }>(items: T[]): T[] {
  const seen = new Set<string>()
  return items.filter((b) => {
    if (seen.has(b.id)) return false
    seen.add(b.id)
    return true
  })
}

function greet(name?: string | null): string {
  void name
  const h = new Date().getHours()
  if (h < 5) return 'Boa madrugada'
  if (h < 12) return 'Bom dia'
  if (h < 18) return 'Boa tarde'
  return 'Boa noite'
}

function daysSince(iso: string): number {
  const diff = Date.now() - new Date(iso).getTime()
  return Math.floor(diff / (24 * 60 * 60 * 1000))
}

function formatDays(days: number): string {
  if (days < 1) return 'hoje'
  if (days === 1) return '1 dia'
  return `${days} dias`
}

/**
 * Format a duration in milliseconds into a compact pt-BR string:
 *   < 1 hora  → '42min'
 *   < 1 dia   → '3h 12min' (no min when exactly an hour boundary)
 *   ≥ 1 dia   → '2d 4h'
 *
 * Returns '—' when the input is null (no completed briefings yet).
 */
function formatDuration(ms: number | null): string {
  if (ms === null) return '—'
  const mins = Math.round(ms / 60_000)
  if (mins < 60) return `${mins}min`
  const hours = Math.floor(mins / 60)
  const remMins = mins % 60
  if (hours < 24) return remMins ? `${hours}h ${remMins}min` : `${hours}h`
  const days = Math.floor(hours / 24)
  const remHours = hours % 24
  return remHours ? `${days}d ${remHours}h` : `${days}d`
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days = Math.floor(diff / 86400000)
  if (mins < 1) return 'agora'
  if (mins < 60) return `${mins}min`
  if (hours < 24) return `${hours}h`
  if (days === 1) return 'ontem'
  if (days < 7) return `${days}d`
  return new Date(iso).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
  })
}

interface TimelineItem {
  id: string
  kind: string
  timestamp: string
  text: React.ReactNode
  icon: LucideIcon
}

const ACTION_META: Record<string, { label: string; icon: LucideIcon }> = {
  delete_briefing: { label: 'Briefing excluído', icon: Trash2 },
  bulk_delete_briefings: { label: 'Exclusão em lote', icon: Trash2 },
  duplicate_briefing: { label: 'Briefing duplicado', icon: FileText },
}

function buildTimeline(
  briefings: Briefing[],
  activity: ActivityLogEntry[],
): TimelineItem[] {
  const items: TimelineItem[] = []

  for (const b of briefings) {
    const company = b.clients?.company || 'Cliente'
    items.push({
      id: `bcreate-${b.id}`,
      kind: 'briefing-created',
      timestamp: b.created_at,
      icon: Send,
      text: (
        <>
          <strong className="font-semibold">{company}</strong> recebeu um
          briefing de {b.type_label.toLowerCase()}
        </>
      ),
    })

    if (b.completed_at) {
      items.push({
        id: `bdone-${b.id}`,
        kind: 'briefing-completed',
        timestamp: b.completed_at,
        icon: CheckCircle2,
        text: (
          <>
            <strong className="font-semibold">{company}</strong> completou o
            briefing de {b.type_label.toLowerCase()}
          </>
        ),
      })
    }

    if ((b.update_count || 0) > 0 && b.completed_at) {
      items.push({
        id: `bedit-${b.id}`,
        kind: 'briefing-edited',
        timestamp: b.completed_at,
        icon: Pencil,
        text: (
          <>
            <strong className="font-semibold">{company}</strong> editou o
            briefing ({b.update_count} {b.update_count === 1 ? 'alteração' : 'alterações'})
          </>
        ),
      })
    }
  }

  for (const log of activity) {
    const meta = ACTION_META[log.action]
    const company = (log.details?.company as string) || ''
    items.push({
      id: `log-${log.id}`,
      kind: 'log',
      timestamp: log.created_at,
      icon: meta?.icon || Bell,
      text: (
        <>
          {meta?.label || log.action}
          {company ? (
            <>
              {' · '}
              <span className="text-muted-foreground">{company}</span>
            </>
          ) : null}
        </>
      ),
    })
  }

  items.sort(
    (a, b) =>
      new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
  )
  return items
}
