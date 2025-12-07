import { useEffect, useState } from 'react'
import { Input } from '~/components/ui/input'

type Props = {
	value: string | null
	onChange: (val: string | null) => void
	allowedSlugs?: string[]
}

export default function FormReferenceField({ value, onChange, allowedSlugs }: Props) {
	const [options, setOptions] = useState<string[]>(allowedSlugs || [])

	useEffect(() => {
		let alive = true
		if (allowedSlugs && allowedSlugs.length > 0) {
			setOptions(allowedSlugs)
			return
		}
		; (async () => {
			try {
				const res = await fetch('/api/forms-definitions', { credentials: 'same-origin' })
				const j = await res.json().catch(() => ({}))
				if (!alive) return
				const list: Array<any> = Array.isArray(j?.data) ? j.data : []
				setOptions(list.map((f) => String(f.slug)).filter(Boolean))
			} catch {
				if (alive) setOptions([])
			}
		})()
		return () => {
			alive = false
		}
	}, [allowedSlugs])

	// Simple fallback input when no options
	if (!options || options.length === 0) {
		return (
			<Input
				value={value ?? ''}
				onChange={(e) => onChange(e.target.value || null)}
				placeholder="form slug"
			/>
		)
	}

	return (
		<select
			className="block w-full border border-line-low rounded bg-backdrop-low px-3 py-2 text-sm text-neutral-high"
			value={value ?? ''}
			onChange={(e) => onChange(e.target.value || null)}
		>
			<option value="">— Select a form —</option>
			{options.map((slug) => (
				<option key={slug} value={slug}>
					{slug}
				</option>
			))}
		</select>
	)
}

