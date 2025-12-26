import { usePage } from '@inertiajs/react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faGlobe } from '@fortawesome/free-solid-svg-icons'
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '~/components/ui/select'

export interface LocaleSwitcherProps {
	className?: string
}

export function LocaleSwitcher({ className = '' }: LocaleSwitcherProps) {
	const { props } = usePage<any>()
	const translations = props.translations || []
	const currentPost = props.post

	if (translations.length <= 1) {
		return null
	}

	const currentLocale = currentPost?.locale || 'en'

	return (
		<div className={`relative inline-flex items-center ${className}`}>
			<Select
				value={currentPost?.id}
				onValueChange={(targetId) => {
					if (targetId === currentPost?.id) return
					const target = translations.find((t: any) => t.id === targetId)
					if (target?.path) {
						window.location.href = target.path
					}
				}}
			>
				<SelectTrigger className="h-9 gap-2 px-3 py-2 border-line-medium bg-backdrop hover:bg-backdrop-medium transition-colors text-sm font-medium text-neutral-high min-w-[80px]">
					<div className="flex items-center gap-2">
						<FontAwesomeIcon icon={faGlobe} className="text-neutral-medium size-3.5" />
						<SelectValue placeholder={currentLocale.toUpperCase()}>
							{currentLocale.toUpperCase()}
						</SelectValue>
					</div>
				</SelectTrigger>
				<SelectContent align="end">
					{translations.map((t: any) => (
						<SelectItem key={t.id} value={t.id}>
							{t.locale.toUpperCase()}
						</SelectItem>
					))}
				</SelectContent>
			</Select>
		</div>
	)
}

