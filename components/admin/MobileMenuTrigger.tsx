'use client'

import { Menu } from 'lucide-react'

/**
 * Mobile-only floating button that opens the navigation drawer. We
 * deliberately *don't* render a top bar with logo + title here — the
 * drawer already shows the logo when opened, and pages have their own
 * titles. A single floating control stays out of the way and frees
 * vertical space for content (which matters on small phones).
 *
 * The semi-transparent card background + backdrop blur keeps the
 * button readable whether it sits over white space, a stat card, or
 * the page header.
 */
export function MobileMenuTrigger({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Abrir menu"
      className="fixed left-3 top-3 z-30 flex h-9 w-9 items-center justify-center rounded-md border border-border bg-card/85 text-muted-foreground shadow-sm backdrop-blur transition-colors hover:bg-card hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring lg:hidden"
    >
      <Menu size={17} strokeWidth={1.75} />
    </button>
  )
}
