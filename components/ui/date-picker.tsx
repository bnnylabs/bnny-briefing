'use client'

import * as React from 'react'
import dynamic from 'next/dynamic'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { CalendarIcon, X } from 'lucide-react'

import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'

// Calendar pulls in react-day-picker (~25 KB gzipped). It only renders
// inside an open Popover, so we can defer the actual fetch until the
// user clicks the trigger. ssr:false because the Popover never opens
// during SSR anyway.
const Calendar = dynamic(
  () => import('@/components/ui/calendar').then((m) => m.Calendar),
  {
    ssr: false,
    loading: () => (
      <div
        className="flex h-[260px] w-[252px] items-center justify-center"
        aria-label="Carregando calendário"
      >
        <div className="spinner" />
      </div>
    ),
  },
)

interface DatePickerProps {
  value: Date | null
  onChange: (date: Date | null) => void
  placeholder?: string
  className?: string
  disablePast?: boolean
}

export function DatePicker({
  value,
  onChange,
  placeholder = 'Selecione uma data',
  className,
  disablePast = false,
}: DatePickerProps) {
  const [open, setOpen] = React.useState(false)
  // openKey forces calendar to remount on every open, so defaultMonth
  // is re-applied based on the latest selected value. Avoids any stale
  // controlled-state issues with react-day-picker v9 inside Portals.
  const [openKey, setOpenKey] = React.useState(0)

  const today = React.useMemo(() => {
    const d = new Date()
    d.setHours(0, 0, 0, 0)
    return d
  }, [])

  const handleOpenChange = (next: boolean) => {
    if (next) setOpenKey((k) => k + 1)
    setOpen(next)
  }

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          className={cn(
            'h-9 w-full justify-start gap-2 px-3 font-normal',
            !value && 'text-muted-foreground/60',
            className,
          )}
        >
          <CalendarIcon className="h-4 w-4 shrink-0" />
          {value ? (
            <span className="flex-1 text-left">
              {format(value, "dd 'de' MMM 'de' yyyy", { locale: ptBR })}
            </span>
          ) : (
            <span className="flex-1 text-left">{placeholder}</span>
          )}
          {value && (
            <span
              role="button"
              aria-label="Limpar data"
              onClick={(e) => {
                e.stopPropagation()
                onChange(null)
              }}
              className="rounded-sm p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <X className="h-3 w-3" />
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          key={openKey}
          mode="single"
          defaultMonth={value ?? new Date()}
          selected={value ?? undefined}
          onSelect={(d) => {
            onChange(d ?? null)
            setOpen(false)
          }}
          disabled={disablePast ? { before: today } : undefined}
          locale={ptBR}
        />
      </PopoverContent>
    </Popover>
  )
}

// ─── Helpers ──────────────────────────────────────────────────────────────

export function parseIsoDate(iso: string | null | undefined): Date | null {
  if (!iso) return null
  const d = new Date(`${iso}T00:00:00`)
  return isNaN(d.getTime()) ? null : d
}

export function toIsoDate(d: Date | null): string | null {
  if (!d) return null
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}
