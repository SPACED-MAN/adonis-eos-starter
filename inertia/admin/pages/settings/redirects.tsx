import { useEffect, useState } from 'react'
import { Head, Link } from '@inertiajs/react'
import { AdminHeader } from '../../components/AdminHeader'

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
	const [loading, setLoading] = useState(false)
	const [creating, setCreating] = useState(false)
	const [form, setForm] = useState<{ fromPath: string; toPath: string; httpStatus: number; locale: string }>({
		fromPath: '',
		toPath: '',
		httpStatus: 301,
		locale: '',
	})

	useEffect(() => {
		let mounted = true
		setLoading(true)
		fetch('/api/redirects', { credentials: 'same-origin' })
			.then((r) => r.json())
			.then((json) => {
				if (!mounted) return
				setItems(json?.data ?? [])
			})
			.finally(() => setLoading(false))
		return () => {
			mounted = false
		}
	}, [])

	async function createRedirect() {
		if (!form.fromPath || !form.toPath) {
			alert('fromPath and toPath are required')
			return
		}
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
					locale: form.locale || null,
				}),
			})
			if (!res.ok) {
				const err = await res.json().catch(() => ({}))
				alert(err?.error || 'Failed to create redirect')
				return
			}
			const json = await res.json()
			setItems((prev) => [json.data, ...prev])
			setForm({ fromPath: '', toPath: '', httpStatus: 301, locale: '' })
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
				<div className="mb-6">
					<Link href="/admin" className="text-sm text-neutral-low hover:text-standout">
						← Back to Dashboard
					</Link>
				</div>
				<div className="bg-backdrop-low border border-line rounded-lg">
					<div className="px-6 py-4 border-b border-line flex items-center justify-between">
						<h2 className="text-lg font-semibold text-neutral-high">Redirect Rules</h2>
						{loading && <span className="text-sm text-neutral-low">Loading…</span>}
					</div>
					<div className="p-6 space-y-8">
						<section>
							<h3 className="text-base font-semibold text-neutral-high mb-3">Create Redirect</h3>
							<div className="grid grid-cols-1 md:grid-cols-5 gap-3 items-center">
								<input
									type="text"
									className="md:col-span-2 px-3 py-2 border border-border rounded bg-backdrop-low text-neutral-high"
									placeholder="/from/path"
									value={form.fromPath}
									onChange={(e) => setForm((f) => ({ ...f, fromPath: e.target.value }))}
								/>
								<input
									type="text"
									className="md:col-span-2 px-3 py-2 border border-border rounded bg-backdrop-low text-neutral-high"
									placeholder="/to/path"
									value={form.toPath}
									onChange={(e) => setForm((f) => ({ ...f, toPath: e.target.value }))}
								/>
								<div className="flex gap-2">
									<input
										type="number"
										className="w-24 px-3 py-2 border border-border rounded bg-backdrop-low text-neutral-high"
										placeholder="301"
										value={form.httpStatus}
										onChange={(e) => setForm((f) => ({ ...f, httpStatus: Number(e.target.value || 301) }))}
									/>
									<input
										type="text"
										className="w-24 px-3 py-2 border border-border rounded bg-backdrop-low text-neutral-high"
										placeholder="locale"
										value={form.locale}
										onChange={(e) => setForm((f) => ({ ...f, locale: e.target.value }))}
									/>
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
											<button
												type="button"
												className="px-3 py-1.5 text-xs rounded border border-line hover:bg-backdrop-medium text-neutral-medium"
												onClick={() => remove(r.id)}
											>
												Delete
											</button>
										</div>
									))
								)}
							</div>
						</section>
					</div>
				</div>
			</main>
		</div>
	)
}


