import { useEffect, useState } from 'react'
import { Head } from '@inertiajs/react'
import { AdminHeader } from '../../components/AdminHeader'
import { AdminFooter } from '../../components/AdminFooter'
import { AdminBreadcrumbs } from '../../components/AdminBreadcrumbs'
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
	AlertDialogTrigger,
} from '~/components/ui/alert-dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '~/components/ui/select'

type Redirect = {
	id: string
	from_path: string
	to_path: string
	http_status: number
	locale: string | null
	created_at: string
	updated_at: string
}

function getXsrfToken(): string | undefined {
	if (typeof document === 'undefined') return undefined
	const m = document.cookie.match(/(?:^|; )XSRF-TOKEN=([^;]+)/)
	return m ? decodeURIComponent(m[1]) : undefined
}

export default function RedirectsPage() {
	const [items, setItems] = useState<Redirect[]>([])
	const [postTypes, setPostTypes] = useState<string[]>([])
	const [typeFilter, setTypeFilter] = useState<string>('')
	const [autoRedirectEnabled, setAutoRedirectEnabled] = useState<boolean>(true)
	const [loading, setLoading] = useState(false)
	const [creating, setCreating] = useState(false)
	const [form, setForm] = useState<{ fromPath: string; toPath: string; httpStatus: number }>({
		fromPath: '',
		toPath: '',
		httpStatus: 301,
	})

	useEffect(() => {
		let mounted = true
		setLoading(true)
		const params = new URLSearchParams()
		if (typeFilter) params.set('type', typeFilter)
		fetch(`/api/redirects?${params.toString()}`, { credentials: 'same-origin' })
			.then((r) => r.json())
			.then((json) => {
				if (!mounted) return
				setItems(json?.data ?? [])
			})
			.finally(() => setLoading(false))
		// Load setting for selected type
		if (typeFilter) {
			fetch(`/api/redirect-settings/${encodeURIComponent(typeFilter)}`, { credentials: 'same-origin' })
				.then((r) => r.json())
				.then((json) => {
					if (!mounted) return
					setAutoRedirectEnabled(!!json?.data?.autoRedirectOnSlugChange)
				})
				.catch(() => {
					if (!mounted) return
					setAutoRedirectEnabled(true)
				})
		}
		return () => {
			mounted = false
		}
	}, [typeFilter])

	useEffect(() => {
		; (async () => {
			try {
				const r = await fetch('/api/post-types', { credentials: 'same-origin' })
				const json = await r.json().catch(() => ({}))
				const list: string[] = Array.isArray(json?.data) ? json.data : []
				setPostTypes(list)
				// Load initial setting for the first type if present
				if (list.length > 0 && !typeFilter) {
					setTypeFilter(list[0])
				}
			} catch {
				setPostTypes([])
			}
		})()
	}, [])

	function labelize(type: string): string {
		if (!type) return ''
		const withSpaces = type.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/[-_]+/g, ' ')
		return withSpaces
			.split(' ')
			.filter(Boolean)
			.map((w) => w.charAt(0).toUpperCase() + w.slice(1))
			.join(' ')
	}

	function inferLocale(path: string): string | null {
		if (!path || path[0] !== '/') return null
		const seg = path.split('/')[1]?.trim().toLowerCase()
		if (!seg) return null
		if (/^[a-z]{2}(-[a-z]{2})?$/.test(seg)) return seg
		return null
	}

	async function createRedirect() {
		if (!form.fromPath || !form.toPath) {
			alert('fromPath and toPath are required')
			return
		}
		const inferredLocale = inferLocale(form.fromPath) ?? inferLocale(form.toPath)
		setCreating(true)
		try {
			const res = await fetch('/api/redirects', {
				method: 'POST',
				headers: {
					'Accept': 'application/json',
					'Content-Type': 'application/json',
					...(getXsrfToken() ? { 'X-XSRF-TOKEN': getXsrfToken()! } : {}),
				},
				credentials: 'same-origin',
				body: JSON.stringify({
					fromPath: form.fromPath,
					toPath: form.toPath,
					httpStatus: form.httpStatus,
					locale: inferredLocale,
				}),
			})
			if (!res.ok) {
				const err = await res.json().catch(() => ({}))
				alert(err?.error || 'Failed to create redirect')
				return
			}
			const json = await res.json()
			setItems((prev) => [json.data, ...prev])
			setForm({ fromPath: '', toPath: '', httpStatus: 301 })
			alert('Redirect created')
		} finally {
			setCreating(false)
		}
	}

	async function remove(id: string) {
		if (!confirm('Delete this redirect?')) return
		const res = await fetch(`/api/redirects/${encodeURIComponent(id)}`, {
			method: 'DELETE',
			headers: {
				...(getXsrfToken() ? { 'X-XSRF-TOKEN': getXsrfToken()! } : {}),
			},
			credentials: 'same-origin',
		})
		if (res.status === 204) {
			setItems((prev) => prev.filter((r) => r.id !== id))
		} else {
			alert('Failed to delete redirect')
		}
	}

	return (
		<div className="min-h-screen bg-backdrop-low">
			<Head title="Redirects" />
			<AdminHeader title="Redirects" />
			<main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
				<AdminBreadcrumbs items={[{ label: 'Dashboard', href: '/admin' }, { label: 'Redirects' }]} />
				<div className="bg-backdrop-low border border-line rounded-lg">
					<div className="px-6 py-4 border-b border-line flex items-center justify-between">
						<h2 className="text-lg font-semibold text-neutral-high">Redirect Rules</h2>
						<div className="flex items-center gap-3">
							<Select
								defaultValue={typeFilter || undefined}
								onValueChange={(val) => setTypeFilter(val === 'all' ? '' : val)}
							>
								<SelectTrigger className="w-[200px]">
									<SelectValue placeholder="All post types" />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="all">All post types</SelectItem>
									{postTypes.map((t) => (
										<SelectItem key={t} value={t}>{labelize(t)}</SelectItem>
									))}
								</SelectContent>
							</Select>
							{typeFilter && (
								<label className="inline-flex items-center gap-2 text-sm text-neutral-high">
									<input
										type="checkbox"
										checked={autoRedirectEnabled}
										onChange={async (e) => {
											const enabled = e.target.checked
											setAutoRedirectEnabled(enabled)
											await fetch(`/api/redirect-settings/${encodeURIComponent(typeFilter)}`, {
												method: 'PATCH',
												headers: {
													'Accept': 'application/json',
													'Content-Type': 'application/json',
													...(getXsrfToken() ? { 'X-XSRF-TOKEN': getXsrfToken()! } : {}),
												},
												credentials: 'same-origin',
												body: JSON.stringify({ autoRedirectOnSlugChange: enabled }),
											})
										}}
										className="rounded border-line"
									/>
									<span className="text-neutral-medium">Auto-redirect on slug change</span>
								</label>
							)}
							{loading && <span className="text-sm text-neutral-low">Loading…</span>}
						</div>
					</div>
					<div className="p-6 space-y-8">
						<section>
							<h3 className="text-base font-semibold text-neutral-high mb-3">Create Redirect</h3>
							<div className="grid grid-cols-1 md:grid-cols-4 gap-3 items-center">
								<input
									type="text"
									className="md:col-span-2 px-3 py-2 border border-line rounded bg-backdrop-low text-neutral-high"
									placeholder="/from/path"
									value={form.fromPath}
									onChange={(e) => setForm((f) => ({ ...f, fromPath: e.target.value }))}
								/>
								<input
									type="text"
									className="md:col-span-2 px-3 py-2 border border-line rounded bg-backdrop-low text-neutral-high"
									placeholder="/to/path"
									value={form.toPath}
									onChange={(e) => setForm((f) => ({ ...f, toPath: e.target.value }))}
								/>
								<div className="flex gap-2">
									<Select
										defaultValue={String(form.httpStatus)}
										onValueChange={(val) => setForm((f) => ({ ...f, httpStatus: Number(val) }))}
									>
										<SelectTrigger className="w-40">
											<SelectValue />
										</SelectTrigger>
										<SelectContent>
											<SelectItem value="301">301 (Permanent)</SelectItem>
											<SelectItem value="302">302 (Temporary)</SelectItem>
										</SelectContent>
									</Select>
									<button
										type="button"
										className="px-3 py-2 text-sm rounded bg-standout text-on-standout disabled:opacity-50"
										disabled={creating}
										onClick={createRedirect}
									>
										{creating ? 'Creating…' : 'Create'}
									</button>
								</div>
							</div>
						</section>

						<section>
							<h3 className="text-base font-semibold text-neutral-high mb-3">Existing Redirects</h3>
							<div className="divide-y divide-line border border-line rounded">
								{items.length === 0 ? (
									<p className="p-4 text-neutral-low">No redirects.</p>
								) : (
									items.map((r) => (
										<div key={r.id} className="p-4 flex items-center justify-between">
											<div className="text-sm text-neutral-high">
												<span className="font-mono">{r.from_path}</span>
												<span className="mx-2">→</span>
												<span className="font-mono">{r.to_path}</span>
												<span className="ml-3 text-neutral-low">[{r.http_status}]</span>
												{r.locale && <span className="ml-2 text-neutral-low">({r.locale})</span>}
											</div>
											<AlertDialog>
												<AlertDialogTrigger asChild>
													<button
														type="button"
														className="px-3 py-1.5 text-xs rounded border border-line hover:bg-backdrop-medium text-neutral-medium"
													>
														Delete
													</button>
												</AlertDialogTrigger>
												<AlertDialogContent>
													<AlertDialogHeader>
														<AlertDialogTitle>Delete redirect?</AlertDialogTitle>
														<AlertDialogDescription>
															This action cannot be undone.
														</AlertDialogDescription>
													</AlertDialogHeader>
													<AlertDialogFooter>
														<AlertDialogCancel>Cancel</AlertDialogCancel>
														<AlertDialogAction onClick={() => remove(r.id)}>Delete</AlertDialogAction>
													</AlertDialogFooter>
												</AlertDialogContent>
											</AlertDialog>
										</div>
									))
								)}
							</div>
						</section>
					</div>
				</div>
			</main>
			<div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
				<AdminFooter />
			</div>
		</div>
	)
}


