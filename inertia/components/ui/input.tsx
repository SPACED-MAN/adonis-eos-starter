import * as React from 'react'
import { cn } from '~/components/ui/utils'

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
	({ className, type = 'text', ...props }, ref) => {
		return (
			<input
				ref={ref}
				type={type}
				className={cn(
					'w-full px-3 py-2 border border-border rounded-lg bg-backdrop-low text-neutral-high',
					'focus-visible:outline-none focus-visible:ring-2 ring-standout',
					className
				)}
				{...props}
			/>
		)
	}
)
Input.displayName = 'Input'


