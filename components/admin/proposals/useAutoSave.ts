'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

export type AutoSaveStatus = 'idle' | 'saving' | 'saved' | 'error'

interface UseAutoSaveOptions {
  /** Milliseconds to wait after the last call before firing the save. Default 800. */
  delay?: number
}

/**
 * Debounces a save function. Call `schedule()` after every local mutation;
 * the hook fires `save` once changes stop flowing for `delay` ms.
 *
 * Status values:
 *   - idle  → nothing pending
 *   - saving → request in flight
 *   - saved  → last save succeeded; flips back to idle automatically after 2s
 *   - error  → last save failed; stays until next schedule
 *
 * The hook does NOT manage your local state — it only triggers the save.
 * Combine with optimistic local updates in your component.
 */
export function useAutoSave(
  save: () => Promise<void>,
  { delay = 800 }: UseAutoSaveOptions = {},
) {
  const [status, setStatus] = useState<AutoSaveStatus>('idle')
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(null)

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const savingRef = useRef(false)
  const queuedRef = useRef(false)
  // Stable ref to the save callback so we don't re-arm on every render.
  const saveRef = useRef(save)
  useEffect(() => {
    saveRef.current = save
  }, [save])

  const fire = useCallback(async () => {
    // If a save is already running, queue another after it finishes.
    if (savingRef.current) {
      queuedRef.current = true
      return
    }
    savingRef.current = true
    setStatus('saving')
    try {
      await saveRef.current()
      setLastSavedAt(Date.now())
      setStatus('saved')
    } catch {
      setStatus('error')
    } finally {
      savingRef.current = false
      if (queuedRef.current) {
        queuedRef.current = false
        // Re-fire to capture changes that arrived during the request.
        void fire()
      }
    }
  }, [])

  const schedule = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => {
      void fire()
    }, delay)
  }, [delay, fire])

  // Auto-revert "saved" status to "idle" after 2s for cleaner UI.
  useEffect(() => {
    if (status !== 'saved') return
    const t = setTimeout(() => setStatus('idle'), 2000)
    return () => clearTimeout(t)
  }, [status])

  // Cleanup on unmount.
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [])

  /** Force-flush any pending debounce immediately (e.g. before navigation). */
  const flush = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
      void fire()
    }
  }, [fire])

  return { status, lastSavedAt, schedule, flush }
}

/** Format "salvo há Xs" / "agora" given the saved timestamp. */
export function formatSavedAgo(at: number | null): string {
  if (at === null) return ''
  const diff = Math.floor((Date.now() - at) / 1000)
  if (diff < 5) return 'salvo agora'
  if (diff < 60) return `salvo há ${diff}s`
  const mins = Math.floor(diff / 60)
  if (mins < 60) return `salvo há ${mins}min`
  return 'salvo há mais de 1h'
}
