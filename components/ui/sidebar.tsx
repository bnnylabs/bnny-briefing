'use client'

import * as React from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'

export interface SidebarItem {
  href: string
  label: string
  icon: React.ReactNode
  badge?: number | string
  /** Match this prefix (e.g. '/admin/clientes') so deeply nested routes still highlight the parent */
  matchPrefix?: string
}

export interface SidebarSection {
  /** Optional heading shown above the items, like "Overview" or "Settings" */
  label?: string
  items: SidebarItem[]
}

interface SidebarProps {
  /** Either flat items or grouped sections */
  sections: SidebarSection[]
  logo?: React.ReactNode
  /** Footer is for the user profile / account controls */
  footer?: React.ReactNode
}

export function Sidebar({ sections, logo, footer }: SidebarProps) {
  const pathname = usePathname()

  return (
    <aside className="fixed left-0 top-0 bottom-0 z-40 flex w-[240px] flex-col border-r border-border bg-sidebar">
      {/* Logo */}
      <div className="flex h-16 items-center px-5">{logo}</div>

      {/* Nav sections */}
      <nav className="flex-1 overflow-y-auto px-3 pb-3">
        {sections.map((section, sectionIdx) => (
          <div
            key={section.label ?? `section-${sectionIdx}`}
            className={cn(sectionIdx > 0 && 'mt-5')}
          >
            {section.label && (
              <div className="mb-1.5 px-2 text-[11px] font-medium uppercase tracking-wider text-muted-foreground/70">
                {section.label}
              </div>
            )}
            <ul className="space-y-0.5">
              {section.items.map((item) => {
                const matchTarget = item.matchPrefix ?? item.href
                const active =
                  pathname === item.href ||
                  (matchTarget !== '/admin' &&
                    pathname?.startsWith(matchTarget))
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className={cn(
                        'group flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-[13px] transition-colors',
                        active
                          ? 'bg-muted font-medium text-foreground'
                          : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground',
                      )}
                    >
                      <span
                        className={cn(
                          'flex h-4 w-4 shrink-0 items-center justify-center transition-colors',
                          active
                            ? 'text-foreground'
                            : 'text-muted-foreground group-hover:text-foreground',
                        )}
                      >
                        {item.icon}
                      </span>
                      <span className="flex-1 truncate">{item.label}</span>
                      {item.badge !== undefined && (
                        <span
                          className={cn(
                            'min-w-[20px] rounded px-1.5 py-0.5 text-center text-[10px] font-medium',
                            active
                              ? 'bg-foreground/10 text-foreground'
                              : 'bg-muted text-muted-foreground',
                          )}
                        >
                          {item.badge}
                        </span>
                      )}
                    </Link>
                  </li>
                )
              })}
            </ul>
          </div>
        ))}
      </nav>

      {/* User profile / footer */}
      {footer && (
        <div className="border-t border-border p-3">{footer}</div>
      )}
    </aside>
  )
}

export function SidebarLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen">
      <div className="w-[240px] shrink-0" /> {/* Spacer */}
      <main className="min-w-0 flex-1">{children}</main>
    </div>
  )
}
