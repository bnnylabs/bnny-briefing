'use client'

import * as React from 'react'
import Link from 'next/link'
import { ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface BreadcrumbItem {
  /** Visible label */
  label: string
  /** href to navigate to. Omit on the last item (current page). */
  href?: string
}

interface BreadcrumbsProps {
  items: BreadcrumbItem[]
  className?: string
}

/**
 * Top-of-page breadcrumb navigation. Sits above the page hero header
 * (avatar + title) and provides a hierarchical orientation cue.
 *
 * Behaviour:
 *   - Items with an `href` render as <Link>; the last item should never
 *     have one (it's the current page).
 *   - Last item is rendered slightly emphasized (text-foreground font-medium)
 *     so the eye lands on 'where am I' more than 'where I came from'.
 *   - Separator: ChevronRight 12px in low-contrast muted-foreground/40.
 *   - aria-current='page' on the last item — standard pattern recognized
 *     by screen readers.
 *   - Wrapped in <nav aria-label='Breadcrumb'> + <ol>, the WAI-ARIA
 *     authoring practices recommended structure.
 *
 * Example:
 *   <Breadcrumbs items={[
 *     { label: 'Clientes', href: '/admin/clientes' },
 *     { label: client.company },
 *   ]} />
 */
export function Breadcrumbs({ items, className }: BreadcrumbsProps) {
  return (
    <nav aria-label="Breadcrumb" className={cn('mb-3', className)}>
      <ol className="flex items-center gap-1.5 text-xs">
        {items.map((item, i) => {
          const isLast = i === items.length - 1
          return (
            <li key={i} className="flex min-w-0 items-center gap-1.5">
              {item.href && !isLast ? (
                <Link
                  href={item.href}
                  className="shrink-0 rounded text-muted-foreground transition-colors hover:text-foreground"
                >
                  {item.label}
                </Link>
              ) : (
                <span
                  className={cn(
                    'truncate',
                    isLast
                      ? 'font-medium text-foreground'
                      : 'text-muted-foreground',
                  )}
                  aria-current={isLast ? 'page' : undefined}
                >
                  {item.label}
                </span>
              )}
              {!isLast && (
                <ChevronRight
                  className="h-3 w-3 shrink-0 text-muted-foreground/40"
                  aria-hidden="true"
                />
              )}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
