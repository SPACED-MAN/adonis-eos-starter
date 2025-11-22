import { DayPicker } from 'react-day-picker'
import { cn } from '~/components/ui/utils'

export function Calendar(props: any) {
	const { className, ...rest } = props
	return (
		<DayPicker
			mode={rest.mode ?? 'single'}
			className={cn('p-2 text-neutral-high', className)}
			classNames={{
				months: 'flex flex-col sm:flex-row space-y-4 sm:space-x-4 sm:space-y-0',
				month: 'space-y-4',
				table: 'w-full border-collapse space-y-1',
				head_row: 'grid grid-cols-7',
				head_cell: 'text-neutral-medium text-xs font-medium',
				row: 'grid grid-cols-7 mt-1',
				cell: 'relative p-0 text-center',
				day: 'h-8 w-8 p-0 font-normal aria-selected:opacity-100 rounded hover:bg-backdrop-low',
				day_selected: 'bg-standout text-on-standout hover:bg-standout',
				day_today: 'border border-standout',
				day_outside: 'text-neutral-low opacity-50',
				...(rest.classNames || {}),
			}}
			{...rest}
		/>
	)
}



