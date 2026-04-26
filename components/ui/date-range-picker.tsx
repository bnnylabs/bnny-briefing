'use client'

import * as React from 'react'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { CalendarIcon, X } from 'lucide-react'
import type { DateRange } from 'react-day-picker'

import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'

interface DateRangePickerProps {
  value: DateRange | undefined
  onChange: (range: DateRange | undefined) => void
  placeholder?: string
  className?: string
}

export function DateRangePicker({
  value,
  onChange,
  placeholder = 'Selecionar período',
  className,
}: DateRangePickerProps) {
  const hasValue = !!value?.from
  return (
    <div className={cn('relative inline-block', className)}>
      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            className={cn(
              'h-9 justify-start gap-2 px-3 text-left font-normal',
              !hasValue && 'text-muted-foreground',
              hasValue && 'pr-9',
            )}
          >
            <CalendarIcon className="h-4 w-4 shrink-0" />
            {hasValue ? (
              value.to ? (
                <>
                  {format(value.from!, "dd 'de' MMM", { locale: ptBR })} —{' '}
                  {format(value.to, "dd 'de' MMM", { locale: ptBR })}
                </>
              ) : (
                format(value.from!, "dd 'de' MMM, yyyy", { locale: ptBR })
              )
            ) : (
              <span>{placeholder}</span>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="range"
            defaultMonth={value?.from}
            selected={value}
            onSelect={onChange}
            numberOfMonths={2}
            locale={ptBR}
          />
        </PopoverContent>
      </Popover>
      {hasValue && (
        <button
          type="button"
          onClick={() => onChange(undefined)}
          aria-label="Limpar período"
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  )
}
