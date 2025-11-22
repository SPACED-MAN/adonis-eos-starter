import { DayPicker } from 'react-day-picker'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faChevronLeft, faChevronRight } from '@fortawesome/free-solid-svg-icons'
import { cn } from '~/components/ui/utils'

export function Calendar(props: any) {
	const { className, ...rest } = props
	// Custom Nav to guarantee FA icons regardless of DayPicker internals
	// DayPicker passes onPreviousClick/onNextClick into Nav via components API
	const Nav = ({ onPreviousClick, onNextClick, className }: any) => {
		return (
			<div className={cn('flex items-center justify-between px-2 py-1', className)}>
				<button
					type="button"
					className="p-1 text-foreground hover:bg-muted rounded"
					onClick={onPreviousClick}
					aria-label="Previous month"
				>
					<FontAwesomeIcon icon={faChevronLeft} className="h-4 w-4" />
				</button>
				<button
					type="button"
					className="p-1 text-foreground hover:bg-muted rounded"
					onClick={onNextClick}
					aria-label="Next month"
				>
					<FontAwesomeIcon icon={faChevronRight} className="h-4 w-4" />
				</button>
			</div>
		)
	}
	return (
		<DayPicker
			mode={rest.mode ?? 'single'}
			className={cn('p-2 text-foreground bg-popover', className)}
			components={{
				...(rest.components || {}),
				Nav,
			}}
			classNames={{
				months: 'flex flex-col sm:flex-row space-y-4 sm:space-x-4 sm:space-y-0',
				month: 'space-y-4',
				table: 'w-full border-collapse space-y-1',
				head_row: 'grid grid-cols-7',
				head_cell: 'text-muted-foreground text-xs font-medium',
				row: 'grid grid-cols-7 mt-1',
				cell: 'relative p-0 text-center',
				day: 'h-8 w-8 p-0 font-normal aria-selected:opacity-100 rounded hover:bg-muted text-center',
				day_selected: 'bg-primary text-primary-foreground hover:bg-primary',
				day_today: 'border border-primary',
				day_outside: 'text-muted-foreground opacity-50',
				...(rest.classNames || {}),
			}}
			{...rest}
		/>
	)
}



