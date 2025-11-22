import * as React from 'react'
import * as CheckboxPrimitive from '@radix-ui/react-checkbox'
import { cn } from '~/components/ui/utils'

export interface CheckboxProps extends React.ComponentPropsWithoutRef<typeof CheckboxPrimitive.Root> { }

export const Checkbox = React.forwardRef<
	React.ElementRef<typeof CheckboxPrimitive.Root>,
	CheckboxProps
>(({ className, ...props }, ref) => (
	<CheckboxPrimitive.Root
		ref={ref}
		className={cn(
			'h-4 w-4 shrink-0 rounded',
			'border border-input bg-background',
			'data-[state=checked]:bg-primary data-[state=checked]:border-primary',
			'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
			className
		)}
		{...props}
	>
		<CheckboxPrimitive.Indicator />
	</CheckboxPrimitive.Root>
))
Checkbox.displayName = 'Checkbox'



