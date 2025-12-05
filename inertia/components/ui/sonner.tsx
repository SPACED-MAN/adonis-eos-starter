import {
	CircleCheckIcon,
	InfoIcon,
	Loader2Icon,
	OctagonXIcon,
	TriangleAlertIcon,
} from 'lucide-react'
import { Toaster as Sonner, type ToasterProps } from 'sonner'

/**
 * Sonner Toast Component
 * 
 * Opinionated toast notifications with custom styling and icons.
 * Based on https://sonner.emilkowal.ski/
 * 
 * Usage:
 *   import { toast } from 'sonner'
 *   
 *   toast.success('Operation successful')
 *   toast.error('Something went wrong')
 *   toast('Event created', { description: 'Details here' })
 */
const Toaster = ({ ...props }: ToasterProps) => {
	return (
		<Sonner
			theme="system"
			position="top-center"
			richColors
			closeButton
			className="toaster group"
			icons={{
				success: <CircleCheckIcon className="size-4" />,
				info: <InfoIcon className="size-4" />,
				warning: <TriangleAlertIcon className="size-4" />,
				error: <OctagonXIcon className="size-4" />,
				loading: <Loader2Icon className="size-4 animate-spin" />,
			}}
			toastOptions={{
				classNames: {
					toast: 'group-[.toaster]:bg-backdrop-low group-[.toaster]:border-line-low',
					description: 'group-[.toast]:text-neutral-low',
					actionButton: 'group-[.toast]:bg-standout group-[.toast]:text-on-standout',
					cancelButton: 'group-[.toast]:bg-backdrop-medium group-[.toast]:text-neutral-high',
				},
			}}
			{...props}
		/>
	)
}

export { Toaster }

