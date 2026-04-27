'use client'

import * as React from 'react'
import { Button, type ButtonProps } from '@/components/ui/button'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'

export interface IconButtonProps extends Omit<ButtonProps, 'children' | 'aria-label'> {
  /** The icon (Lucide component) shown in the button */
  icon: React.ReactNode
  /** Required: human label shown in tooltip and used for screen readers */
  label: string
  /** Optional tooltip side (default 'top') */
  tooltipSide?: 'top' | 'bottom' | 'left' | 'right'
}

/**
 * A button that shows only an icon, with the label exposed through a
 * tooltip and aria-label.
 *
 * Use this for any compact action — never render an icon-only button
 * without a label, because the user has no way to know what it does.
 *
 * Example:
 *   <IconButton
 *     icon={<Pencil size={14} />}
 *     label="Editar"
 *     onClick={openEdit}
 *   />
 */
export const IconButton = React.forwardRef<HTMLButtonElement, IconButtonProps>(
  ({ icon, label, tooltipSide = 'top', size = 'icon-sm', variant = 'ghost', ...props }, ref) => {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            ref={ref}
            size={size}
            variant={variant}
            aria-label={label}
            {...props}
          >
            {icon}
          </Button>
        </TooltipTrigger>
        <TooltipContent side={tooltipSide}>{label}</TooltipContent>
      </Tooltip>
    )
  },
)
IconButton.displayName = 'IconButton'
