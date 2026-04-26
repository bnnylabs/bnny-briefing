'use client'
import * as React from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { FileText, Users, ScrollText, Settings, Plus } from 'lucide-react'
import { Button } from './button'
import { Separator } from './separator'

interface SidebarItem {
  href: string
  label: string
  icon: React.ReactNode
  badge?: number | string
}

interface SidebarProps {
  items: SidebarItem[]
  actions?: React.ReactNode
  logo?: React.ReactNode
  footer?: React.ReactNode
}

export function Sidebar({ items, actions, logo, footer }: SidebarProps) {
  const pathname = usePathname()

  return (
    <aside className="fixed left-0 top-0 bottom-0 w-[220px] flex flex-col border-r border-border bg-sidebar z-40" style={{ boxShadow: "1px 0 0 0 hsl(var(--sidebar-border))" }}>
      {/* Logo */}
      <div className="h-14 flex items-center px-5">
        {logo ?? (
          <Link href="/admin" className="flex items-center gap-2.5">
            <div className="w-6 h-6 rounded-md bg-primary flex items-center justify-center text-primary-foreground font-black text-xs leading-none font-mono">B</div>
            <span className="font-mono font-bold text-[13px] tracking-tight text-sidebar-foreground">Bnny Labs</span>
          </Link>
        )}
      </div>

      <Separator />

      {/* Nav items */}
      <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-0.5">
        {items.map((item) => {
          const active = pathname === item.href || (item.href !== '/admin' && pathname.startsWith(item.href))
          return (
            <Link key={item.href} href={item.href}>
              <div className={cn(
                'flex items-center gap-2.5 px-3 py-1.5 rounded-md text-[13px] font-medium transition-all duration-150 cursor-pointer',
                active
                  ? 'bg-primary text-primary-foreground'
                  : 'text-sidebar-foreground/60 hover:bg-sidebar-accent hover:text-sidebar-foreground'
              )}>
                <span className="w-4 h-4 flex items-center justify-center shrink-0 text-base leading-none">{item.icon}</span>
                <span className="flex-1">{item.label}</span>
                {item.badge !== undefined && (
                  <span className={cn(
                    'text-xs font-bold px-1.5 py-0.5 rounded-full min-w-[20px] text-center',
                    active ? 'bg-black/20 text-primary-foreground' : 'bg-primary/15 text-primary'
                  )}>
                    {item.badge}
                  </span>
                )}
              </div>
            </Link>
          )
        })}
      </nav>

      {/* Actions slot */}
      {actions && (
        <div className="px-3 pb-3">
          {actions}
        </div>
      )}

      {footer && (
        <>
          <Separator />
          <div className="p-3">{footer}</div>
        </>
      )}
    </aside>
  )
}

export function SidebarLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen">
      <div className="w-[220px] shrink-0" /> {/* Spacer */}
      <main className="flex-1 min-w-0">
        {children}
      </main>
    </div>
  )
}
