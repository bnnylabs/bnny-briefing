'use client'

import * as React from 'react'
import { useState, useCallback, useEffect, useRef } from 'react'
import { Check, X, Info, AlertCircle } from 'lucide-react'
import { cn } from '@/lib/utils'

export type ToastType = 'success' | 'error' | 'info'

interface Toast {
  id: string
  message: string
  type: ToastType
  out?: boolean
}

/**
 * Top-right stacking toast container. Each toast animates in from the
 * right, lives fixed against the viewport so it doesn't clip on layout,
 * and dismisses on click of the × or after `duration` ms.
 */
export function ToastContainer({
  toasts,
  remove,
}: {
  toasts: Toast[]
  remove: (id: string) => void
}) {
  return (
    <div
      aria-live="polite"
      aria-atomic="true"
      className="pointer-events-none fixed right-4 top-4 z-[100] flex w-full max-w-sm flex-col gap-2"
    >
      {toasts.map((t) => (
        <ToastItem key={t.id} toast={t} onRemove={() => remove(t.id)} />
      ))}
    </div>
  )
}

function ToastItem({
  toast,
  onRemove,
}: {
  toast: Toast
  onRemove: () => void
}) {
  const Icon =
    toast.type === 'success'
      ? Check
      : toast.type === 'error'
        ? AlertCircle
        : Info

  return (
    <div
      role="status"
      className={cn(
        'pointer-events-auto flex w-full items-start gap-2.5 rounded-lg border bg-card px-3.5 py-2.5 shadow-lg',
        'animate-in slide-in-from-right-4 fade-in-0 duration-200',
        toast.out && 'animate-out fade-out-0 slide-out-to-right-2 duration-200',
        toast.type === 'success' && 'border-success/30',
        toast.type === 'error' && 'border-destructive/30',
        toast.type === 'info' && 'border-border',
      )}
    >
      <span
        className={cn(
          'mt-px flex h-4 w-4 shrink-0 items-center justify-center',
          toast.type === 'success' && 'text-success',
          toast.type === 'error' && 'text-destructive',
          toast.type === 'info' && 'text-muted-foreground',
        )}
      >
        <Icon size={14} strokeWidth={2.25} />
      </span>
      <span className="flex-1 text-sm leading-snug text-foreground">
        {toast.message}
      </span>
      <button
        type="button"
        onClick={onRemove}
        aria-label="Dispensar"
        className="-mr-1 -mt-0.5 rounded p-1 text-muted-foreground/70 transition-colors hover:bg-muted hover:text-foreground"
      >
        <X size={12} strokeWidth={2.25} />
      </button>
    </div>
  )
}

export function useToast() {
  const [toasts, setToasts] = useState<Toast[]>([])
  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({})

  const remove = useCallback((id: string) => {
    setToasts((prev) =>
      prev.map((t) => (t.id === id ? { ...t, out: true } : t)),
    )
    setTimeout(
      () => setToasts((prev) => prev.filter((t) => t.id !== id)),
      220,
    )
  }, [])

  const toast = useCallback(
    (message: string, type: ToastType = 'success', duration?: number) => {
      // Per-type default duration. Caller can still override explicitly.
      // - success: 1800ms — quick acknowledgment, user already saw the
      //   action succeed visually (button feedback, list update, etc).
      // - info: 3000ms — neutral notice, average reading time.
      // - error: 5000ms — errors deserve longer to read; the user might
      //   be looking at a different part of the page when it fires, and
      //   missing it means re-running the failing action without
      //   knowing what went wrong.
      const defaultDuration =
        type === 'error' ? 5000 : type === 'info' ? 3000 : 1800
      const finalDuration = duration ?? defaultDuration
      const id = Math.random().toString(36).slice(2)
      setToasts((prev) => [...prev, { id, message, type }])
      timers.current[id] = setTimeout(() => remove(id), finalDuration)
      return id
    },
    [remove],
  )

  useEffect(() => {
    const t = timers.current
    return () => Object.values(t).forEach(clearTimeout)
  }, [])

  return { toasts, toast, remove }
}
