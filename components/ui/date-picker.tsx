'use client'

import * as React from 'react'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { CalendarIcon, X } from 'lucide-react'

import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'

interface DatePickerProps {
  value: Date | null
  onChange: (date: Date | null) => void
  placeholder?: string
  className?: string
  /** Disable past dates relative to today. Useful for validity dates. */
  disablePast?: boolean
}

/**
 * Single-date picker following the same pattern as DateRangePicker:
 * Button trigger with formatted date + Popover with the shadcn Calendar.
 *
 * Used wherever the rest of the app needs a date — never use the native
 * <input type="date"> which has a non-themable browser-default skin.
 */
export function DatePicker({
  value,
  onChange,
  placeholder = 'Selecione uma data',
  className,
  disablePast = false,
}: DatePickerProps) {
  const [open, setOpen] = React.useState(false)

  const today = React.useMemo(() => {
    const d = new Date()
    d.setHours(0, 0, 0, 0)
    return d
  }, [])

  return (
    <Popover open={open} onOpenChange={setOpen}>
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
          mode="single"
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

/** Convert "YYYY-MM-DD" or null to a Date object. */
export function parseIsoDate(iso: string | null | undefined): Date | null {
  if (!iso) return null
  // Append T00:00:00 to avoid TZ-shifting the date.
  const d = new Date(`${iso}T00:00:00`)
  return isNaN(d.getTime()) ? null : d
}

/** Convert a Date back to "YYYY-MM-DD" for storage. */
export function toIsoDate(d: Date | null): string | null {
  if (!d) return null
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}
