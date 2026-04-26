'use client'

import * as React from 'react'
import { Logo } from '@/components/brand/Logo'
import { cn } from '@/lib/utils'

interface BrandLogoProps {
  className?: string
}

/**
 * Renders the current brand logo. Reads `brand_logo_url` from settings
 * via the public settings endpoint. Falls back to the bundled <Logo /> SVG
 * when no custom logo is set.
 *
 * Used in the sidebar header and the "Briefing submitted" success screen.
 */
export function BrandLogo({ className }: BrandLogoProps) {
  const [logoUrl, setLogoUrl] = React.useState<string | null>(null)
  const [loading, setLoading] = React.useState(true)

  React.useEffect(() => {
    let cancelled = false
    fetch('/api/brand', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (cancelled) return
        setLogoUrl(d?.logoUrl || null)
        setLoading(false)
      })
      .catch(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  // While loading, render the bundled logo so the sidebar doesn't flash empty
  if (loading || !logoUrl) {
    return <Logo className={cn('h-5 w-auto text-foreground', className)} />
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={logoUrl}
      alt="Logo"
      className={cn('h-5 w-auto object-contain', className)}
    />
  )
}
