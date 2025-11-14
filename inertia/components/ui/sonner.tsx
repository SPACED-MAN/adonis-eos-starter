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
			position="bottom-right"
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
					toast: 'group-[.toaster]:bg-white group-[.toaster]:dark:bg-bg-800 group-[.toaster]:border-neutral-300 group-[.toaster]:dark:border-neutral-500',
					description: 'group-[.toast]:text-neutral-600 group-[.toast]:dark:text-neutral-500',
					actionButton: 'group-[.toast]:bg-primary-600 group-[.toast]:hover:bg-primary-700 group-[.toast]:text-white',
					cancelButton: 'group-[.toast]:bg-neutral-100 group-[.toast]:dark:bg-neutral-700 group-[.toast]:text-neutral-900 group-[.toast]:dark:text-neutral-50',
				},
			}}
			{...props}
		/>
	)
}

export { Toaster }

