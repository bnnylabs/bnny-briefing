'use client'

import { Menu } from 'lucide-react'
import { BrandLogo } from '@/components/brand/BrandLogo'

/**
 * Sticky top bar shown only below the `lg` breakpoint. Pairs with
 * MobileSidebar — the burger here opens the drawer there.
 *
 * Tighter than a typical app bar (48px tall, h-4 logo) so it stays
 * out of the way on small phones while still anchoring the brand at
 * the top. Stays out of the way on desktop with `lg:hidden`.
 */
export function MobileHeader({ onMenuClick }: { onMenuClick: () => void }) {
  return (
    <header className="sticky top-0 z-30 flex h-12 shrink-0 items-center gap-2.5 border-b border-border bg-background/80 px-3 backdrop-blur-md lg:hidden">
      <button
        type="button"
        onClick={onMenuClick}
        className="-ml-1 flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        aria-label="Abrir menu"
      >
        <Menu size={17} strokeWidth={1.75} />
      </button>
      <BrandLogo className="h-4 w-auto" />
    </header>
  )
}
