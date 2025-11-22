import * as React from 'react'
import { cn } from '~/components/ui/utils'

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> { }

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
	({ className, type = 'text', ...props }, ref) => {
		return (
			<input
				ref={ref}
				type={type}
				className={cn(
					'w-full px-3 py-2 rounded-lg',
					'border border-input bg-background text-foreground',
					'focus-visible:outline-none focus-visible:ring-1 ring-ring',
					className
				)}
				{...props}
			/>
		)
	}
)
Input.displayName = 'Input'


