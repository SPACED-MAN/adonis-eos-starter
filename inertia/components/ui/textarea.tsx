import * as React from 'react'
import { cn } from '~/components/ui/utils'

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> { }

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
	({ className, ...props }, ref) => {
		return (
			<textarea
				ref={ref}
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
Textarea.displayName = 'Textarea'


