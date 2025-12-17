import * as React from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faGripVertical } from '@fortawesome/free-solid-svg-icons'
import { cn } from '~/components/ui/utils'

type DragHandleProps = Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'type'> & {
	disabled?: boolean
}

/**
 * Standard drag-handle affordance for admin sortable lists.
 * Keep this consistent across the backend UI.
 */
export function DragHandle({ className, disabled, ...props }: DragHandleProps) {
	return (
		<button
			type="button"
			disabled={disabled}
			className={cn(
				'inline-flex items-center justify-center rounded-md w-8 h-8',
				'text-neutral-low hover:text-neutral-high hover:bg-backdrop-medium',
				disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-grab',
				className
			)}
			{...props}
		>
			<FontAwesomeIcon icon={faGripVertical} className="h-4 w-4" />
		</button>
	)
}


