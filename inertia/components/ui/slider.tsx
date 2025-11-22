import * as React from 'react'
import * as SliderPrimitive from '@radix-ui/react-slider'
import { cn } from '~/components/ui/utils'

export interface SliderProps extends React.ComponentPropsWithoutRef<typeof SliderPrimitive.Root> {}

export const Slider = React.forwardRef<
	React.ElementRef<typeof SliderPrimitive.Root>,
	SliderProps
>(({ className, ...props }, ref) => (
	<SliderPrimitive.Root
		ref={ref}
		className={cn('relative flex w-full touch-none select-none items-center py-2', className)}
		{...props}
	>
		<SliderPrimitive.Track className="relative h-1 w-full grow overflow-hidden rounded-full bg-backdrop-medium">
			<SliderPrimitive.Range className="absolute h-full bg-standout" />
		</SliderPrimitive.Track>
		<SliderPrimitive.Thumb className="block h-4 w-4 rounded-full border border-line bg-panel shadow" />
	</SliderPrimitive.Root>
))
Slider.displayName = 'Slider'



