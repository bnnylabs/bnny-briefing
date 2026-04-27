'use client'

import * as React from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  ArrowRight,
  Bell,
  Bot,
  CheckCircle2,
  ClipboardList,
  Clock,
  FileText,
  Pencil,
  Plus,
  Send,
  Trash2,
  TrendingUp,
  Users,
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

  const timelineItems = buildTimeline(briefings, activity).slice(0, 8)

  return (
    <div className="min-h-screen bg-background">
      <ToastContainer toasts={toasts} remove={remove} />

      <div className="mx-auto max-w-5xl p-6">
        {/* Greeting */}
        <div className="mb-7">
          <h1 className="font-mono text-2xl font-bold tracking-tight">
            {greeting}, {profile?.name?.split(' ')[0] || 'Bnny'}
          </h1>
          <p className="mt-1 text-sm capitalize text-muted-foreground">
            {today}
          </p>
        </div>

        {/* Cards row */}
        <div className="mb-5 grid grid-cols-1 gap-3 md:grid-cols-3">
          <DashCard
            title="Aguardando você"
            description="Briefings concluídos pra revisar"
            count={awaitingYou.length}
          >
            {awaitingYou.length === 0 ? (
              <EmptyMini text="Nada pendente — você está em dia." />
            ) : (
              <ul className="space-y-2">
                {awaitingYou.map((b) => (
                  <li key={b.id}>
                    <Link
                      href="/admin/briefings"
                      className="flex items-start justify-between gap-2 rounded-md px-2 py-1.5 -mx-2 hover:bg-muted/60 transition-colors"
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
          </DashCard>

          <DashCard
            title="Aguardando cliente"
            description="Você enviou, ele ainda não respondeu"
            count={awaitingClient.length}
          >
            {awaitingClient.length === 0 ? (
              <EmptyMini text="Nenhum briefing pendente do lado deles." />
            ) : (
              <ul className="space-y-2">
                {awaitingClient.map((b) => {
                  const days = daysSince(b.created_at)
                  const overdue = days >= 5
                  return (
                    <li key={b.id}>
                      <Link
                        href="/admin/briefings"
                        className="flex items-start justify-between gap-2 rounded-md px-2 py-1.5 -mx-2 hover:bg-muted/60 transition-colors"
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
          </DashCard>

          <DashCard
            title="Esta semana"
            description="Atividade dos últimos 7 dias"
          >
            <div className="space-y-3 py-1">
              <Stat
                icon={Send}
                label="Enviados"
                value={sentThisWeek}
              />
              <Stat
                icon={CheckCircle2}
                label="Concluídos"
                value={concludedThisWeek}
              />
              <Stat
                icon={TrendingUp}
                label="Taxa de conclusão"
                value={`${conversionRate}%`}
                muted={sentThisWeek === 0}
              />
            </div>
          </DashCard>
        </div>

        {/* Activity timeline */}
        <Card className="mb-5 p-5">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <div className="flex items-center gap-1.5 text-[15px] font-bold tracking-tight">
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

        {/* Quick actions */}
        <div className="flex flex-wrap items-center gap-2">
          <Button onClick={() => router.push('/admin/novo')}>
            <Plus size={14} />
            Novo briefing
            <ArrowRight size={14} className="opacity-70" />
          </Button>
          <Button
            variant="outline"
            onClick={() => router.push('/admin/clientes')}
          >
            <Users size={14} />
            Gerenciar clientes
          </Button>
          <Button
            variant="ghost"
            onClick={() => router.push('/admin/briefings')}
          >
            <ClipboardList size={14} />
            Ver todos os briefings
          </Button>
        </div>
      </div>
    </div>
  )
}

/* ──────────────────────────────────────────────────────────────────── */
/* UI bits                                                               */
/* ──────────────────────────────────────────────────────────────────── */

function DashCard({
  title,
  description,
  count,
  children,
}: {
  title: string
  description: string
  count?: number
  children: React.ReactNode
}) {
  return (
    <Card className="flex h-full flex-col p-5">
      <div className="mb-4">
        <div className="flex items-baseline justify-between gap-2">
          <h2 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
            {title}
          </h2>
          {typeof count === 'number' && (
            <span className="font-mono text-xs tabular-nums text-muted-foreground">
              {count}
            </span>
          )}
        </div>
        <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
      </div>
      <div className="flex-1">{children}</div>
    </Card>
  )
}

function EmptyMini({ text }: { text: string }) {
  return (
    <div className="py-4 text-center text-xs text-muted-foreground">{text}</div>
  )
}

function Stat({
  icon: Icon,
  label,
  value,
  muted = false,
}: {
  icon: LucideIcon
  label: string
  value: number | string
  muted?: boolean
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="flex items-center gap-2 text-sm text-muted-foreground">
        <Icon size={13} strokeWidth={1.75} />
        {label}
      </span>
      <span
        className={cn(
          'font-mono text-lg font-bold tabular-nums',
          muted && 'text-muted-foreground',
        )}
      >
        {value}
      </span>
    </div>
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

// suppress unused import warning — Bot/Clock are referenced in shared types
void Bot
void Clock
