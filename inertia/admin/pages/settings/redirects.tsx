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
		<div className="min-h-screen bg-bg-50">
			<Head title="Redirects" />
			<AdminHeader title="Redirects" />
			<main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
				<div className="mb-6">
					<Link href="/admin" className="text-sm text-neutral-600 hover:text-neutral-900">
						← Back to Dashboard
					</Link>
				</div>
				<div className="bg-bg-100 border border-neutral-200 rounded-lg">
					<div className="px-6 py-4 border-b border-neutral-200 flex items-center justify-between">
						<h2 className="text-lg font-semibold text-neutral-900">Redirect Rules</h2>
						{loading && <span className="text-sm text-neutral-500">Loading…</span>}
					</div>
					<div className="p-6 space-y-8">
						<section>
							<h3 className="text-base font-semibold text-neutral-900 mb-3">Create Redirect</h3>
							<div className="grid grid-cols-1 md:grid-cols-5 gap-3 items-center">
								<input
									type="text"
									className="md:col-span-2 px-3 py-2 border border-neutral-300 rounded bg-bg-100 text-neutral-900"
									placeholder="/from/path"
									value={form.fromPath}
									onChange={(e) => setForm((f) => ({ ...f, fromPath: e.target.value }))}
								/>
								<input
									type="text"
									className="md:col-span-2 px-3 py-2 border border-neutral-300 rounded bg-bg-100 text-neutral-900"
									placeholder="/to/path"
									value={form.toPath}
									onChange={(e) => setForm((f) => ({ ...f, toPath: e.target.value }))}
								/>
								<div className="flex gap-2">
									<input
										type="number"
										className="w-24 px-3 py-2 border border-neutral-300 rounded bg-bg-100 text-neutral-900"
										placeholder="301"
										value={form.httpStatus}
										onChange={(e) => setForm((f) => ({ ...f, httpStatus: Number(e.target.value || 301) }))}
									/>
									<input
										type="text"
										className="w-24 px-3 py-2 border border-neutral-300 rounded bg-bg-100 text-neutral-900"
										placeholder="locale"
										value={form.locale}
										onChange={(e) => setForm((f) => ({ ...f, locale: e.target.value }))}
									/>
									<button
										type="button"
										className="px-3 py-2 text-sm rounded bg-primary-600 hover:bg-primary-700 text-white disabled:opacity-50"
										disabled={creating}
										onClick={createRedirect}
									>
										{creating ? 'Creating…' : 'Create'}
									</button>
								</div>
							</div>
						</section>

						<section>
							<h3 className="text-base font-semibold text-neutral-900 mb-3">Existing Redirects</h3>
							<div className="divide-y divide-neutral-200 border border-neutral-200 rounded">
								{items.length === 0 ? (
									<p className="p-4 text-neutral-600">No redirects.</p>
								) : (
									items.map((r) => (
										<div key={r.id} className="p-4 flex items-center justify-between">
											<div className="text-sm text-neutral-800">
												<span className="font-mono">{r.from_path}</span>
												<span className="mx-2">→</span>
												<span className="font-mono">{r.to_path}</span>
												<span className="ml-3 text-neutral-500">[{r.http_status}]</span>
												{r.locale && <span className="ml-2 text-neutral-500">({r.locale})</span>}
											</div>
											<button
												type="button"
												className="px-3 py-1.5 text-xs rounded border border-neutral-300 hover:bg-bg-100 text-neutral-700"
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


