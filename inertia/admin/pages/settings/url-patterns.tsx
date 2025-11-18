import { useEffect, useMemo, useState } from 'react'
import { Head, Link } from '@inertiajs/react'
import { AdminHeader } from '../../components/AdminHeader'
import { AdminFooter } from '../../components/AdminFooter'

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
	const [newPattern, setNewPattern] = useState<{ postType: string; locale: string; pattern: string }>({
		postType: '',
		locale: '',
		pattern: '',
	})
	const [availableLocales, setAvailableLocales] = useState<string[]>([])

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

	// Load available locales for dropdown
	useEffect(() => {
		let mounted = true
		fetch('/api/locales', { credentials: 'same-origin' })
			.then((r) => r.json())
			.then((json) => {
				if (!mounted) return
				const list: Array<{ code: string }> = Array.isArray(json?.data) ? json.data : []
				setAvailableLocales(list.map((l) => l.code))
			})
			.catch(() => {
				if (!mounted) return
				setAvailableLocales(['en'])
			})
		return () => {
			mounted = false
		}
	}, [])

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
				alert(err?.error || 'Failed to save pattern')
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
			alert('Pattern saved')
		} finally {
			setSavingKey(null)
		}
	}

	return (
		<div className="min-h-screen bg-backdrop-low">
			<Head title="URL Patterns" />
			<AdminHeader title="URL Patterns" />
			<main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
				<div className="mb-6">
					<Link href="/admin" className="text-sm text-neutral-low hover:text-standout">
						← Back to Dashboard
					</Link>
				</div>
				<div className="bg-backdrop-low border border-line rounded-lg">
					<div className="px-6 py-4 border-b border-line flex items-center justify-between">
						<h2 className="text-lg font-semibold text-neutral-high">Default Patterns by Post Type and Locale</h2>
						{loading && <span className="text-sm text-neutral-low">Loading…</span>}
					</div>
					<div className="p-6">
						<section className="mb-10 opacity-60 pointer-events-none">
							<h3 className="text-base font-semibold text-neutral-high mb-1">Add Pattern</h3>
							<p className="text-sm text-neutral-low mb-3">Disabled: defaults are auto-created for all post types and locales.</p>
							<div className="flex flex-col md:flex-row gap-3">
								<input
									type="text"
									className="md:w-48 px-3 py-2 border border-line rounded bg-backdrop-low text-neutral-high"
									placeholder="postType (e.g., blog)"
									value={newPattern.postType}
									onChange={(e) => setNewPattern((s) => ({ ...s, postType: e.target.value }))}
									disabled
								/>
								<select
									className="md:w-28 px-3 py-2 border border-line rounded bg-backdrop-low text-neutral-high"
									value={newPattern.locale}
									onChange={(e) => setNewPattern((s) => ({ ...s, locale: e.target.value }))}
									disabled
								>
									<option value="">{availableLocales.length ? 'Select locale' : 'Loading...'}</option>
									{availableLocales.map((loc) => (
										<option key={loc} value={loc}>
											{loc.toUpperCase()}
										</option>
									))}
								</select>
								<input
									type="text"
									className="flex-1 px-3 py-2 border border-line rounded bg-backdrop-low text-neutral-high"
									placeholder="/{locale}/posts/{slug}"
									value={newPattern.pattern}
									onChange={(e) => setNewPattern((s) => ({ ...s, pattern: e.target.value }))}
									disabled
								/>
								<button
									type="button"
									className="px-3 py-2 text-sm rounded bg-standout text-on-standout disabled:opacity-50"
									onClick={async () => {
										if (!newPattern.postType || !newPattern.locale || !newPattern.pattern) {
											alert('postType, locale and pattern are required')
											return
										}
										const res = await fetch(`/api/url-patterns/${encodeURIComponent(newPattern.locale)}`, {
											method: 'PUT',
											headers: {
												'Accept': 'application/json',
												'Content-Type': 'application/json',
												...(getXsrfToken() ? { 'X-XSRF-TOKEN': getXsrfToken()! } : {}),
											},
											credentials: 'same-origin',
											body: JSON.stringify({
												postType: newPattern.postType,
												pattern: newPattern.pattern,
												isDefault: true,
											}),
										})
										if (!res.ok) {
											const err = await res.json().catch(() => ({}))
											alert(err?.error || 'Failed to add pattern')
											return
										}
										const json = await res.json()
										setPatterns((prev) => [...prev, json.data])
										setDrafts((d) => ({
											...d,
											[`${json.data.postType}:${json.data.locale}`]: json.data.pattern,
										}))
										setNewPattern({ postType: '', locale: '', pattern: '' })
									}}
									disabled
								>
									Add
								</button>
							</div>
						</section>
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
																placeholder="/{locale}/posts/{slug}"
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
		</div>
	)
}


