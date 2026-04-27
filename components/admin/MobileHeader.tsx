'use client'

import { Menu } from 'lucide-react'
import { BrandLogo } from '@/components/brand/BrandLogo'

/**
 * Sticky top bar shown only below the `lg` breakpoint. Pairs with
 * MobileSidebar — the burger here opens the drawer there.
 *
 * Stays out of the way on desktop with `lg:hidden`.
 */
export function MobileHeader({ onMenuClick }: { onMenuClick: () => void }) {
  return (
    <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center gap-3 border-b border-border bg-background px-4 lg:hidden">
      <button
        type="button"
        onClick={onMenuClick}
        className="-ml-1.5 flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        aria-label="Abrir menu"
      >
        <Menu size={18} strokeWidth={2} />
      </button>
      <BrandLogo className="h-5 w-auto" />
    </header>
  )
}
