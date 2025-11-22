import * as React from 'react'
import { cn } from '~/components/ui/utils'

type BadgeVariant = 'default' | 'secondary' | 'destructive' | 'outline'

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
	variant?: BadgeVariant
}

export const Badge = React.forwardRef<HTMLSpanElement, BadgeProps>(
	({ className, variant = 'default', ...props }, ref) => {
		const variants: Record<BadgeVariant, string> = {
			default: 'bg-primary text-primary-foreground',
			secondary: 'bg-muted text-foreground',
			destructive: 'bg-destructive text-primary-foreground',
			outline: 'border border-border text-foreground',
		}
		const base =
			'inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium'
		return (
			<span
				ref={ref}
				className={cn(base, variants[variant], className)}
				{...props}
			/>
		)
	}
)
Badge.displayName = 'Badge'


