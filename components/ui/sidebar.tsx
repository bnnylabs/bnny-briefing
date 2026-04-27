'use client'

import * as React from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import * as DialogPrimitive from '@radix-ui/react-dialog'
import { X } from 'lucide-react'
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

/**
 * Renders just the inside of a sidebar — logo, nav, footer — with no
 * outer container. Reused by both the desktop fixed aside and the
 * mobile dialog drawer below, so the markup stays in sync between the
 * two surfaces.
 */
function SidebarContent({
  sections,
  logo,
  footer,
  onNavigate,
}: SidebarProps & { onNavigate?: () => void }) {
  const pathname = usePathname()

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex h-16 shrink-0 items-center px-5">{logo}</div>

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
                      onClick={onNavigate}
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

      {footer && (
        <div className="shrink-0 border-t border-border p-3">{footer}</div>
      )}
    </div>
  )
}

/**
 * Desktop fixed sidebar — visible from `lg` (1024px) up. Below that,
 * the MobileSidebar drawer takes over.
 */
export function Sidebar({ sections, logo, footer }: SidebarProps) {
  return (
    <aside className="fixed left-0 top-0 bottom-0 z-40 hidden w-[240px] flex-col border-r border-border bg-sidebar lg:flex">
      <SidebarContent sections={sections} logo={logo} footer={footer} />
    </aside>
  )
}

/**
 * Mobile slide-in drawer — same content, rendered through Radix Dialog
 * so it gets focus trap, ESC to close, and overlay click to close for
 * free. Closes itself when a nav link is followed (onNavigate).
 */
export function MobileSidebar({
  sections,
  logo,
  footer,
  open,
  onOpenChange,
}: SidebarProps & {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 lg:hidden" />
        <DialogPrimitive.Content
          className="fixed inset-y-0 left-0 z-50 flex w-[280px] flex-col border-r border-border bg-sidebar shadow-xl outline-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:slide-out-to-left data-[state=open]:slide-in-from-left lg:hidden"
          aria-describedby={undefined}
        >
          <DialogPrimitive.Title className="sr-only">
            Menu de navegação
          </DialogPrimitive.Title>
          <DialogPrimitive.Close
            className="absolute right-3 top-3 z-10 flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            aria-label="Fechar menu"
          >
            <X size={16} strokeWidth={2} />
          </DialogPrimitive.Close>
          <SidebarContent
            sections={sections}
            logo={logo}
            footer={footer}
            onNavigate={() => onOpenChange(false)}
          />
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}

/**
 * Page wrapper that pairs with Sidebar — adds a 240px spacer column
 * on desktop so the fixed sidebar doesn't overlap content. On mobile
 * the spacer collapses (sidebar isn't there) and a 56px top
 * placeholder gets added to the main column so the floating burger
 * doesn't sit on top of the page heading.
 */
export function SidebarLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen">
      <div className="hidden w-[240px] shrink-0 lg:block" />
      <main className="min-w-0 flex-1">
        <div className="h-14 lg:hidden" aria-hidden="true" />
        {children}
      </main>
    </div>
  )
}
