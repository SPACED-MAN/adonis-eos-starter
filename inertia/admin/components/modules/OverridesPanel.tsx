import { useEffect, useState } from 'react'
import { toast } from 'sonner'

export interface ModuleListItem {
	id: string
	type: string
	scope: string
	props: Record<string, any>
	overrides: Record<string, any> | null
	locked: boolean
	orderIndex: number
}

export function OverridesPanel({
	open,
	moduleItem,
	onClose,
	onSave,
	processing = false,
}: {
	open: boolean
	moduleItem: ModuleListItem | null
	onClose: () => void
	onSave: (overrides: Record<string, any> | null) => Promise<void> | void
	processing?: boolean
}) {
	const [draft, setDraft] = useState<string>('{}')

	useEffect(() => {
		if (!open || !moduleItem) return
		const initial = moduleItem.overrides ?? {}
		setDraft(JSON.stringify(initial, null, 2))
	}, [open, moduleItem])

	if (!open || !moduleItem) return null

	const trySave = async () => {
		try {
			const value = draft.trim()
			const parsed = value.length ? JSON.parse(value) : {}
			await onSave(Object.keys(parsed).length ? parsed : null)
			toast.success('Overrides saved')
			onClose()
		} catch (e) {
			toast.error('Invalid JSON in overrides')
		}
	}

	return (
		<div className="fixed inset-0 z-40">
			<div className="absolute inset-0 bg-black/40" onClick={onClose} />
			<div className="absolute right-0 top-0 h-full w-full max-w-2xl bg-bg-100 border-l border-neutral-200 shadow-xl flex flex-col">
				<div className="px-5 py-4 border-b border-neutral-200 flex items-center justify-between">
					<h3 className="text-sm font-semibold text-neutral-900">
						Edit Module Overrides — {moduleItem.type}
					</h3>
					<button
						type="button"
						className="text-neutral-600 hover:text-neutral-900"
						onClick={onClose}
					>
						Close
					</button>
				</div>
				<div className="p-5 grid grid-cols-1 gap-5 overflow-auto">
					<div>
						<label className="block text-sm font-medium text-neutral-700 mb-1">
							Overrides (JSON)
						</label>
						<textarea
							rows={16}
							className="w-full px-3 py-2 border border-neutral-300 rounded-lg bg-bg-100 text-neutral-900 font-mono text-xs focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
							value={draft}
							onChange={(e) => setDraft(e.target.value)}
							placeholder={JSON.stringify({ title: 'Custom title' }, null, 2)}
						/>
						<p className="text-xs text-neutral-500 mt-2">
							These values override the module’s base props. Leave empty object to clear.
						</p>
					</div>
					<div>
						<label className="block text-sm font-medium text-neutral-700 mb-1">
							Base Props (read-only)
						</label>
						<pre className="w-full px-3 py-2 border border-neutral-300 rounded-lg bg-bg-50 text-neutral-900 font-mono text-xs overflow-auto">
{JSON.stringify(moduleItem.props, null, 2)}
						</pre>
					</div>
				</div>
				<div className="px-5 py-4 border-t border-neutral-200 flex items-center justify-end gap-3">
					<button
						type="button"
						className="px-4 py-2 text-sm border border-neutral-300 rounded-lg hover:bg-bg-100 text-neutral-700"
						onClick={onClose}
						disabled={processing}
					>
						Cancel
					</button>
					<button
						type="button"
						className="px-4 py-2 text-sm rounded-md bg-primary-600 hover:bg-primary-700 text-white disabled:opacity-50"
						onClick={trySave}
						disabled={processing}
					>
						Save Overrides
					</button>
				</div>
			</div>
		</div>
	)
}


