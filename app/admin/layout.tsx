'use client'

import * as React from 'react'
import Link from 'next/link'
import { useRouter, usePathname } from 'next/navigation'
import {
  FileText,
  Users,
  ChevronUp,
  Settings,
  ScrollText,
  LogOut,
} from 'lucide-react'

import {
  Sidebar,
  SidebarLayout,
  type SidebarSection,
} from '@/components/ui/sidebar'
import { BrandLogo } from '@/components/brand/BrandLogo'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { fullVersion } from '@/lib/version'

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const pathname = usePathname()

  // /admin/preview is a popup window where the client previews
  // the briefing. It must NOT have admin chrome (sidebar, logo, etc).
  const isStandalone = pathname?.startsWith('/admin/preview')

  if (isStandalone) {
    return <>{children}</>
  }

  const sections: SidebarSection[] = [
    {
      items: [
        {
          href: '/admin',
          label: 'Briefings',
          icon: <FileText size={15} strokeWidth={1.75} />,
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

  return (
    <>
      <Sidebar
        sections={sections}
        logo={
          <Link href="/admin" className="flex items-center">
            <BrandLogo />
          </Link>
        }
        footer={<UserProfileFooter />}
      />
      <SidebarLayout>
        <VersionTag />
        {children}
      </SidebarLayout>
    </>
  )
}

/**
 * Version pill rendered in the top-right of every admin page.
 * Stays out of the way but always visible — confirms which build is live.
 */
function VersionTag() {
  return (
    <div className="pointer-events-none fixed right-4 top-3 z-30 select-none rounded-full border border-border/60 bg-card/80 px-2 py-0.5 font-mono text-[10px] tracking-wider text-muted-foreground/70 backdrop-blur">
      {fullVersion()}
    </div>
  )
}

/**
 * Footer of the sidebar: profile pill (opens dropdown with Config / Log)
 * and an always-visible Logout button just below.
 */
function UserProfileFooter() {
  const router = useRouter()
  const [loggingOut, setLoggingOut] = React.useState(false)

  async function handleLogout() {
    if (loggingOut) return
    setLoggingOut(true)
    await fetch('/api/auth', { method: 'DELETE' })
    router.push('/admin')
    router.refresh()
  }

  return (
    <div className="space-y-1.5">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className="flex w-full items-center gap-2.5 rounded-md p-1.5 text-left transition-colors hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring data-[state=open]:bg-muted/60"
          >
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-foreground/5 text-[11px] font-semibold text-foreground">
              BL
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-[13px] font-medium text-foreground">
                Bnny Labs
              </div>
              <div className="truncate text-[11px] text-muted-foreground">
                Admin
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
          <DropdownMenuSeparator />
          <DropdownMenuLabel>Versão</DropdownMenuLabel>
          <div className="px-2 pb-1.5 font-mono text-[11px] text-muted-foreground">
            {fullVersion()}
          </div>
        </DropdownMenuContent>
      </DropdownMenu>

      <button
        type="button"
        onClick={handleLogout}
        disabled={loggingOut}
        className="flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-[12px] text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground disabled:opacity-50"
      >
        <LogOut size={13} strokeWidth={1.75} />
        <span>{loggingOut ? 'Saindo…' : 'Sair'}</span>
      </button>
    </div>
  )
}
