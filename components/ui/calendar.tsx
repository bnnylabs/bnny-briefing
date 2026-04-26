'use client'

import * as React from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { DayPicker } from 'react-day-picker'

import { cn } from '@/lib/utils'
import { buttonVariants } from '@/components/ui/button'

export type CalendarProps = React.ComponentProps<typeof DayPicker>

/**
 * shadcn-style calendar adapted for react-day-picker v9.
 * v9 replaces IconLeft/IconRight with a single Chevron component
 * (orientation prop), and renames many classNames keys.
 */
function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  ...props
}: CalendarProps) {
  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      className={cn('p-3', className)}
      classNames={{
        months: 'flex flex-col sm:flex-row gap-2',
        month: 'flex flex-col gap-4',
        month_caption: 'flex justify-center pt-1 relative items-center w-full',
        caption_label: 'text-sm font-medium',
        nav: 'flex items-center gap-1',
        button_previous: cn(
          buttonVariants({ variant: 'outline' }),
          'absolute left-1 top-1 h-7 w-7 bg-transparent p-0 opacity-60 hover:opacity-100',
        ),
        button_next: cn(
          buttonVariants({ variant: 'outline' }),
          'absolute right-1 top-1 h-7 w-7 bg-transparent p-0 opacity-60 hover:opacity-100',
        ),
        month_grid: 'w-full border-collapse space-x-1',
        weekdays: 'flex',
        weekday:
          'text-muted-foreground rounded-md w-8 font-normal text-[0.8rem]',
        week: 'flex w-full mt-2',
        day: cn(
          'relative p-0 text-center text-sm focus-within:relative focus-within:z-20',
          props.mode === 'range' &&
            '[&:has(>.day-range-end)]:rounded-r-md [&:has(>.day-range-start)]:rounded-l-md first:[&:has([aria-selected])]:rounded-l-md last:[&:has([aria-selected])]:rounded-r-md',
        ),
        day_button: cn(
          buttonVariants({ variant: 'ghost' }),
          'h-8 w-8 p-0 font-normal aria-selected:opacity-100',
        ),
        range_start:
          'day-range-start [&>button]:bg-primary [&>button]:text-primary-foreground rounded-l-md',
        range_end:
          'day-range-end [&>button]:bg-primary [&>button]:text-primary-foreground rounded-r-md',
        range_middle:
          '[&>button]:bg-accent [&>button]:text-accent-foreground rounded-none',
        selected:
          '[&>button]:bg-primary [&>button]:text-primary-foreground [&>button]:hover:bg-primary [&>button]:hover:text-primary-foreground [&>button]:focus:bg-primary [&>button]:focus:text-primary-foreground',
        today: '[&>button]:bg-accent [&>button]:text-accent-foreground',
        outside:
          'day-outside text-muted-foreground aria-selected:text-muted-foreground',
        disabled: 'text-muted-foreground opacity-50',
        hidden: 'invisible',
        ...classNames,
      }}
      components={{
        Chevron: ({ orientation, className: chevClassName }) =>
          orientation === 'left' ? (
            <ChevronLeft className={cn('h-4 w-4', chevClassName)} />
          ) : (
            <ChevronRight className={cn('h-4 w-4', chevClassName)} />
          ),
      }}
      {...props}
    />
  )
}

export { Calendar }
