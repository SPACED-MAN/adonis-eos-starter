import { useEffect, useState } from 'react'
import { router } from '@inertiajs/react'
import { toast } from 'sonner'

type ModuleConfig = {
	type: string
	name: string
	description?: string
	icon?: string
	category?: string
}

export function ModulePicker({ postId, postType }: { postId: string; postType: string }) {
	const [open, setOpen] = useState(false)
	const [loading, setLoading] = useState(false)
	const [modules, setModules] = useState<ModuleConfig[]>([])

	useEffect(() => {
		if (!open) return
		let cancelled = false
		async function load() {
			try {
				setLoading(true)
				const res = await fetch(`/api/modules/registry?post_type=${encodeURIComponent(postType)}`, {
					headers: { Accept: 'application/json' },
					credentials: 'same-origin',
				})
				const json = await res.json()
				if (!cancelled) {
					setModules(Array.isArray(json?.data) ? json.data : [])
				}
			} catch {
				if (!cancelled) toast.error('Failed to load modules')
			} finally {
				if (!cancelled) setLoading(false)
			}
		}
		load()
		return () => {
			cancelled = true
		}
	}, [open, postType])

	function addModule(type: string) {
		router.post(
			`/api/posts/${postId}/modules`,
			{
				moduleType: type,
				scope: 'local',
				// Omit props so backend seeds defaultProps
				orderIndex: null,
				locked: false,
			},
			{
				onStart: () => setLoading(true),
				onFinish: () => setLoading(false),
				onSuccess: () => {
					toast.success(`Added ${type} module`)
					setOpen(false)
				},
				onError: () => {
					toast.error('Failed to add module')
				},
				preserveScroll: true,
			}
		)
	}

	return (
		<div className="relative">
			<button
				type="button"
				onClick={() => setOpen((v) => !v)}
				className="inline-flex items-center gap-2 rounded-md bg-primary-600 hover:bg-primary-700 text-white text-sm px-3 py-2"
			>
				Add Module
			</button>
			{open && (
				<div className="absolute right-0 mt-2 w-[28rem] max-h-[24rem] overflow-auto rounded-lg border border-neutral-200 bg-bg-100 shadow-lg z-20">
					<div className="sticky top-0 bg-bg-100 border-b border-neutral-200 px-3 py-2 text-sm font-medium">
						{loading ? 'Loading modules...' : 'Available Modules'}
					</div>
					<div className="divide-y divide-neutral-200">
						{modules.length === 0 && !loading && (
							<div className="px-4 py-6 text-neutral-600 text-sm">No modules available</div>
						)}
						{modules.map((m) => (
							<div key={m.type} className="px-3 py-3 hover:bg-bg-50 flex items-start justify-between gap-3">
								<div>
									<div className="text-sm font-medium text-neutral-900">{m.name || m.type}</div>
									{m.description && (
										<div className="text-xs text-neutral-600 mt-1 line-clamp-2">{m.description}</div>
									)}
								</div>
								<button
									type="button"
									onClick={() => addModule(m.type)}
									className="shrink-0 inline-flex items-center rounded border border-neutral-300 bg-bg-100 px-2.5 py-1.5 text-xs text-neutral-800 hover:bg-bg-200"
									disabled={loading}
								>
									Add
								</button>
							</div>
						))}
					</div>
				</div>
			)}
		</div>
	)
}


