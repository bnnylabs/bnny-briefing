'use client'

import { useEffect } from 'react'
import { AlertTriangle, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'

/**
 * Error boundary for any /admin/* route.
 *
 * Server-component throws and unhandled effect errors land here instead
 * of producing a white screen. The user gets a recoverable error card
 * with a single 'Tentar novamente' action that calls Next.js' reset()
 * to remount the segment.
 *
 * Logs the digest to the console so the owner can grep their Vercel
 * runtime logs by digest if a real bug shows up.
 */
export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    // Surface the digest in case the owner needs to correlate with
    // Vercel runtime logs. Body of the error stays in dev tools.
    console.error('[admin error]', error.digest ?? '(no digest)', error)
  }, [error])

  return (
    <div className="mx-auto max-w-md p-6 pt-20 text-center">
      <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
        <AlertTriangle className="h-6 w-6" />
      </div>
      <h1 className="mb-2 text-lg font-bold tracking-tight">
        Algo deu errado nesta tela
      </h1>
      <p className="mb-5 text-sm text-muted-foreground">
        A gente registrou o erro. Você pode tentar de novo — geralmente uma
        recarga já resolve.
      </p>
      {error.digest && (
        <p className="mb-5 font-mono text-[10px] text-muted-foreground/60">
          ref: {error.digest}
        </p>
      )}
      <Button onClick={reset}>
        <RefreshCw className="mr-1.5 h-4 w-4" />
        Tentar novamente
      </Button>
    </div>
  )
}
