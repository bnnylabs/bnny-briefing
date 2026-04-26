'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { FileText, Users, Settings, MoreHorizontal } from 'lucide-react'

import {
  Sidebar,
  SidebarLayout,
  type SidebarSection,
} from '@/components/ui/sidebar'
import { Logo } from '@/components/brand/Logo'

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const pathname = usePathname()

  // The /admin/preview route is a popup window where the client previews
  // the briefing. It must NOT have the admin chrome (sidebar, logo, etc).
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
    {
      label: 'Settings',
      items: [
        {
          href: '/admin/config',
          label: 'Config',
          icon: <Settings size={15} strokeWidth={1.75} />,
          matchPrefix: '/admin/config',
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
            <Logo className="h-5 w-auto text-foreground" />
          </Link>
        }
        footer={<UserProfileFooter />}
      />
      <SidebarLayout>{children}</SidebarLayout>
    </>
  )
}

/**
 * User profile pill shown at the bottom of the sidebar.
 * Currently static — auth is a single password gate, so there's only
 * one logical "user". When real auth lands, hydrate from session.
 */
function UserProfileFooter() {
  return (
    <button
      type="button"
      className="flex w-full items-center gap-2.5 rounded-md p-1.5 text-left transition-colors hover:bg-muted/60"
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
      <MoreHorizontal
        size={14}
        strokeWidth={1.75}
        className="shrink-0 text-muted-foreground"
      />
    </button>
  )
}
