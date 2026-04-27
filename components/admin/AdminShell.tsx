'use client'

import * as React from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  FileText,
  LayoutDashboard,
  Users,
  ChevronUp,
  Settings,
  ScrollText,
  LogOut,
} from 'lucide-react'

import {
  Sidebar,
  MobileSidebar,
  SidebarLayout,
  type SidebarSection,
} from '@/components/ui/sidebar'
import { MobileHeader } from '@/components/admin/MobileHeader'
import { BrandLogo } from '@/components/brand/BrandLogo'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { fullVersion } from '@/lib/version'

interface AdminProfile {
  name: string
  photoUrl: string | null
  jobTitle: string
}

const PROFILE_FALLBACK: AdminProfile = {
  name: 'Bnny Labs',
  photoUrl: null,
  jobTitle: 'Admin',
}

const SECTIONS: SidebarSection[] = [
  {
    items: [
      {
        href: '/admin',
        label: 'Dashboard',
        icon: <LayoutDashboard size={15} strokeWidth={1.75} />,
      },
      {
        href: '/admin/briefings',
        label: 'Briefings',
        icon: <FileText size={15} strokeWidth={1.75} />,
        matchPrefix: '/admin/briefings',
      },
      {
        href: '/admin/clientes',
        label: 'Clientes',
        icon: <Users size={15} strokeWidth={1.75} />,
        matchPrefix: '/admin/clientes',
      },
    ],
  },
]

export function AdminShell({ children }: { children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = React.useState(false)

  const sidebarLogo = (
    <Link
      href="/admin"
      className="block w-full"
      aria-label="Bnny Labs — voltar ao início"
    >
      {/* +20% size vs phase 2.2 (h-6 → h-7) */}
      <BrandLogo className="h-7 w-auto" />
    </Link>
  )

  const sidebarFooter = <UserProfileFooter />

  return (
    <>
      {/* Desktop fixed sidebar (lg+) */}
      <Sidebar
        sections={SECTIONS}
        logo={sidebarLogo}
        footer={sidebarFooter}
      />

      {/* Mobile drawer (below lg) — same content, dialog container */}
      <MobileSidebar
        sections={SECTIONS}
        logo={sidebarLogo}
        footer={sidebarFooter}
        open={mobileOpen}
        onOpenChange={setMobileOpen}
      />

      <SidebarLayout>
        <MobileHeader onMenuClick={() => setMobileOpen(true)} />
        {children}
      </SidebarLayout>
    </>
  )
}

function UserProfileFooter() {
  const router = useRouter()
  const [profile, setProfile] =
    React.useState<AdminProfile>(PROFILE_FALLBACK)
  const [loggingOut, setLoggingOut] = React.useState(false)

  React.useEffect(() => {
    let cancelled = false
    fetch('/api/profile/me', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (cancelled || !d) return
        setProfile({
          name: d.name || PROFILE_FALLBACK.name,
          photoUrl: d.photoUrl || null,
          jobTitle: d.jobTitle || PROFILE_FALLBACK.jobTitle,
        })
      })
      .catch(() => {
        /* keep fallback */
      })
    return () => {
      cancelled = true
    }
  }, [])

  async function handleLogout() {
    if (loggingOut) return
    setLoggingOut(true)
    await fetch('/api/auth', { method: 'DELETE' })
    router.push('/admin')
    router.refresh()
  }

  const initials = getInitials(profile.name)

  return (
    <div className="space-y-1.5">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className="flex w-full items-center gap-2.5 rounded-md p-1.5 text-left transition-colors hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/15 data-[state=open]:bg-muted/60 data-[state=open]:focus-visible:ring-0"
          >
            <div className="flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-md bg-foreground/5 text-[11px] font-semibold text-foreground">
              {profile.photoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={profile.photoUrl}
                  alt={profile.name}
                  className="h-full w-full object-cover"
                />
              ) : (
                initials
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-[13px] font-medium text-foreground">
                {profile.name}
              </div>
              <div className="truncate text-[11px] text-muted-foreground">
                {profile.jobTitle}
              </div>
            </div>
            <ChevronUp
              size={14}
              strokeWidth={1.75}
              className="shrink-0 text-muted-foreground"
            />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          side="top"
          align="start"
          sideOffset={6}
          className="w-[208px]"
        >
          <DropdownMenuLabel>Conta</DropdownMenuLabel>
          <DropdownMenuItem
            onClick={() => router.push('/admin/config')}
            className="cursor-pointer"
          >
            <Settings size={14} strokeWidth={1.75} />
            <span>Config</span>
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => router.push('/admin/log')}
            className="cursor-pointer"
          >
            <ScrollText size={14} strokeWidth={1.75} />
            <span>Log de atividades</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Sair as a visible action — frequent enough to deserve being one
          tap away rather than buried inside the profile dropdown. */}
      <button
        type="button"
        onClick={handleLogout}
        disabled={loggingOut}
        className="flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-[12px] text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground disabled:opacity-50"
      >
        <LogOut size={13} strokeWidth={1.75} />
        <span>{loggingOut ? 'Saindo…' : 'Sair'}</span>
      </button>

      {/* Build identifier — useful for diagnostics, screenshots, and to
          know which deploy you're talking to. Stays subtle. */}
      <div className="px-2.5 pt-1 font-mono text-[9px] uppercase tracking-widest text-muted-foreground/50">
        {fullVersion()}
      </div>
    </div>
  )
}

function getInitials(name: string): string {
  if (!name) return 'BL'
  const parts = name.trim().split(/\s+/)
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}
