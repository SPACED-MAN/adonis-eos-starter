import { useEffect, useMemo, useState } from 'react'
import { Head } from '@inertiajs/react'
import { AdminHeader } from '../../components/AdminHeader'
import { AdminFooter } from '../../components/AdminFooter'
import { AdminBreadcrumbs } from '../../components/AdminBreadcrumbs'
import { toast } from 'sonner'
import {
	AlertDialog,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
	AlertDialogAction,
} from '~/components/ui/alert-dialog'
// Select import removed (no add-pattern form)

type Pattern = {
	id: string
	postType: string
	locale: string
	pattern: string
	isDefault: boolean
	createdAt: string
	updatedAt: string
}

function getXsrfToken(): string | undefined {
	if (typeof document === 'undefined') return undefined
	const m = document.cookie.match(/(?:^|; )XSRF-TOKEN=([^;]+)/)
	return m ? decodeURIComponent(m[1]) : undefined
}

export default function UrlPatternsPage() {
	const [patterns, setPatterns] = useState<Pattern[]>([])
	const [loading, setLoading] = useState(false)
	const [savingKey, setSavingKey] = useState<string | null>(null)
	const [drafts, setDrafts] = useState<Record<string, string>>({})
	const [alertOpen, setAlertOpen] = useState(false)
	const [alertMessage, setAlertMessage] = useState('')

	useEffect(() => {
		let mounted = true
		setLoading(true)
		fetch('/api/url-patterns', { credentials: 'same-origin' })
			.then((r) => r.json())
			.then((json) => {
				if (!mounted) return
				const list: Pattern[] = json?.data ?? []
				setPatterns(list)
				const nextDrafts: Record<string, string> = {}
				for (const p of list) {
					if (p.isDefault) {
						nextDrafts[`${p.postType}:${p.locale}`] = p.pattern
					}
				}
				setDrafts(nextDrafts)
			})
			.finally(() => setLoading(false))
		return () => {
			mounted = false
		}
	}, [])

	// Removed Add Pattern form; defaults are auto-managed by boot logic

	const showError = (message: string) => {
		setAlertMessage(message)
		setAlertOpen(true)
	}

	const groups = useMemo(() => {
		const map = new Map<string, Pattern[]>()
		for (const p of patterns) {
			const key = `${p.postType}`
			if (!map.has(key)) map.set(key, [])
			map.get(key)!.push(p)
		}
		return map
	}, [patterns])

	async function save(postType: string, locale: string) {
		const key = `${postType}:${locale}`
		const pattern = drafts[key]
		if (!pattern) return
		setSavingKey(key)
		try {
			const res = await fetch(`/api/url-patterns/${encodeURIComponent(locale)}`, {
				method: 'PUT',
				headers: {
					'Accept': 'application/json',
					'Content-Type': 'application/json',
					...(getXsrfToken() ? { 'X-XSRF-TOKEN': getXsrfToken()! } : {}),
				},
				credentials: 'same-origin',
				body: JSON.stringify({ postType, pattern, isDefault: true }),
			})
			if (!res.ok) {
				const err = await res.json().catch(() => ({}))
				showError(err?.error || 'Failed to save pattern')
				return
			}
			const json = await res.json()
			// Update local list
			setPatterns((prev) => {
				const next = prev.slice()
				const idx = next.findIndex((p) => p.postType === postType && p.locale === locale && p.isDefault)
				if (idx >= 0) {
					next[idx] = json.data
				} else {
					next.push(json.data)
				}
				return next
			})
			toast.success('Pattern saved successfully')
		} finally {
			setSavingKey(null)
		}
	}

	return (
		<div className="min-h-screen bg-backdrop-low">
			<Head title="URL Patterns" />
			<AdminHeader title="URL Patterns" />
			<main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
				<AdminBreadcrumbs items={[{ label: 'Dashboard', href: '/admin' }, { label: 'URL Patterns' }]} />
				<div className="bg-backdrop-low border border-line rounded-lg">
					<div className="px-6 py-4 border-b border-line flex items-center justify-between">
						<h2 className="text-lg font-semibold text-neutral-high">Default Patterns by Post Type and Locale</h2>
						{loading && <span className="text-sm text-neutral-low">Loading…</span>}
					</div>
					<div className="p-6">
						<section className="mb-6">
							<h3 className="text-base font-semibold text-neutral-high mb-1">Available tokens</h3>
							<ul className="text-sm text-neutral-medium list-disc pl-5 space-y-1">
								<li><code className="text-neutral-high">{'{slug}'}</code> — the post’s slug</li>
								<li><code className="text-neutral-high">{'{path}'}</code> — hierarchical path of parents and slug (enabled when post type hierarchy is on)</li>
								<li><code className="text-neutral-high">{'{locale}'}</code> — the locale code (e.g., en)</li>
								<li><code className="text-neutral-high">{'{yyyy}'}</code> — 4-digit year from createdAt</li>
								<li><code className="text-neutral-high">{'{mm}'}</code> — 2-digit month from createdAt</li>
								<li><code className="text-neutral-high">{'{dd}'}</code> — 2-digit day from createdAt</li>
							</ul>
							<p className="mt-2 text-xs text-neutral-low">
								Note: For the default locale, patterns are created without the {'{locale}'} segment by default.
								Non-default locales include {'{locale}'} at the start.
							</p>
						</section>
						{/* Add Pattern form removed; defaults are created automatically */}
						{Array.from(groups.entries()).length === 0 && !loading ? (
							<p className="text-neutral-low">No patterns yet.</p>
						) : (
							<div className="space-y-8">
								{Array.from(groups.entries()).map(([postType, list]) => {
									const locales = Array.from(new Set(list.map((p) => p.locale))).sort()
									return (
										<section key={postType}>
											<h3 className="text-base font-semibold text-neutral-high mb-3">{postType}</h3>
											<div className="space-y-3">
												{locales.map((loc) => {
													const key = `${postType}:${loc}`
													const current = list.find((p) => p.locale === loc && p.isDefault)
													return (
														<div key={key} className="flex items-center gap-3">
															<div className="w-24 text-sm text-neutral-low">{loc.toUpperCase()}</div>
															<input
																type="text"
																className="flex-1 px-3 py-2 border border-border rounded bg-backdrop-low text-neutral-high"
																placeholder="/posts/{slug}"
																value={drafts[key] ?? current?.pattern ?? ''}
																onChange={(e) =>
																	setDrafts((d) => ({ ...d, [key]: e.target.value }))
																}
															/>
															<button
																type="button"
																className="px-3 py-2 text-sm rounded bg-standout text-on-standout disabled:opacity-50"
																disabled={savingKey === key}
																onClick={() => save(postType, loc)}
															>
																{savingKey === key ? 'Saving…' : 'Save'}
															</button>
														</div>
													)
												})}
											</div>
										</section>
									)
								})}
							</div>
						)}
					</div>
				</div>
			</main>
			<div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
				<AdminFooter />
			</div>

			<AlertDialog open={alertOpen} onOpenChange={setAlertOpen}>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>Error</AlertDialogTitle>
						<AlertDialogDescription>{alertMessage}</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogAction onClick={() => setAlertOpen(false)}>OK</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</div>
	)
}


