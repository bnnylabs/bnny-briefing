import * as React from 'react'
import { cn } from '@/lib/utils'

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, ...props }, ref) => (
    <input
      type={type}
      className={cn(
        'flex h-9 w-full rounded-md border border-border bg-secondary px-3 py-1',
        'text-sm text-foreground placeholder:text-muted-foreground/50',
        'focus:outline-none focus:ring-2 focus:ring-ring/30 focus:border-primary/30',
        'disabled:cursor-not-allowed disabled:opacity-40',
        'transition-all duration-150',
        className
      )}
      ref={ref}
      {...props}
    />
  )
)
Input.displayName = 'Input'
export { Input }
