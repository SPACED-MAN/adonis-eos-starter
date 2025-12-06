import { useEffect, useState } from 'react'
import { Head } from '@inertiajs/react'
import { AdminHeader } from '../../components/AdminHeader'
import { AdminFooter } from '../../components/AdminFooter'

type LocaleRow = { code: string; isDefault: boolean; isEnabled: boolean }

function getXsrfToken(): string | undefined {
	if (typeof document === 'undefined') return undefined
	const m = document.cookie.match(/(?:^|; )XSRF-TOKEN=([^;]+)/)
	return m ? decodeURIComponent(m[1]) : undefined
}

export default function LocalesPage() {
	const [rows, setRows] = useState<LocaleRow[]>([])
	const [loading, setLoading] = useState(false)
	const [updating, setUpdating] = useState<string | null>(null)

	useEffect(() => {
		let mounted = true
		setLoading(true)
		fetch('/api/locales', { credentials: 'same-origin' })
			.then((r) => r.json())
			.then((json) => {
				if (!mounted) return
				setRows(Array.isArray(json?.data) ? json.data : [])
			})
			.finally(() => setLoading(false))
		return () => {
			mounted = false
		}
	}, [])

	async function toggleEnabled(code: string, isEnabled: boolean) {
		setUpdating(code)
		try {
			const res = await fetch(`/api/locales/${encodeURIComponent(code)}`, {
				method: 'PATCH',
				headers: {
					Accept: 'application/json',
					'Content-Type': 'application/json',
					...(getXsrfToken() ? { 'X-XSRF-TOKEN': getXsrfToken()! } : {}),
				},
				credentials: 'same-origin',
				body: JSON.stringify({ isEnabled }),
			})
			if (res.ok) {
				setRows((prev) => prev.map((r) => (r.code === code ? { ...r, isEnabled } : r)))
			}
		} finally {
			setUpdating(null)
		}
	}

	async function makeDefault(code: string) {
		setUpdating(code)
		try {
			const res = await fetch(`/api/locales/${encodeURIComponent(code)}`, {
				method: 'PATCH',
				headers: {
					Accept: 'application/json',
					'Content-Type': 'application/json',
					...(getXsrfToken() ? { 'X-XSRF-TOKEN': getXsrfToken()! } : {}),
				},
				credentials: 'same-origin',
				body: JSON.stringify({ isDefault: true }),
			})
			if (res.ok) {
				setRows((prev) => prev.map((r) => ({ ...r, isDefault: r.code === code })))
			}
		} finally {
			setUpdating(null)
		}
	}

	async function removeLocale(code: string) {
		if (!confirm(`Delete locale "${code}" and all associated posts? This cannot be undone.`)) return
		setUpdating(code)
		try {
			const res = await fetch(`/api/locales/${encodeURIComponent(code)}`, {
				method: 'DELETE',
				headers: {
					...(getXsrfToken() ? { 'X-XSRF-TOKEN': getXsrfToken()! } : {}),
				},
				credentials: 'same-origin',
			})
			if (res.status === 204) {
				setRows((prev) => prev.filter((r) => r.code !== code))
			}
		} finally {
			setUpdating(null)
		}
	}

	return (
		<div className="min-h-screen bg-backdrop-medium">
				<Head title="Locales" />
				<AdminHeader title="Locales" />
				<main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
				<div className="bg-backdrop-low border border-line-low rounded-lg">
					<div className="px-6 py-4 border-b border-line-low flex items-center justify-between">
						<h2 className="text-lg font-semibold text-neutral-high">Manage Locales</h2>
						{loading && <span className="text-sm text-neutral-low">Loading…</span>}
					</div>
					<div className="p-6 space-y-4">
						{rows.length === 0 ? (
							<p className="text-neutral-low">No locales configured.</p>
						) : (
							<table className="w-full text-sm">
								<thead>
									<tr className="text-left text-neutral-low border-b border-line-low">
										<th className="py-2">Code</th>
										<th className="py-2">Default</th>
										<th className="py-2">Enabled</th>
										<th className="py-2 text-right">Actions</th>
									</tr>
								</thead>
								<tbody>
									{rows.map((r) => (
										<tr key={r.code} className="border-b border-line-low">
											<td className="py-2 font-mono text-neutral-high">{r.code.toUpperCase()}</td>
											<td className="py-2">
												{r.isDefault ? (
													<span className="px-2 py-0.5 rounded bg-backdrop-medium text-neutral-high text-xs">DEFAULT</span>
												) : (
													<button
														className="px-2 py-1 text-xs border border-line-medium rounded hover:bg-backdrop-medium text-neutral-medium"
														onClick={() => makeDefault(r.code)}
														disabled={updating === r.code}
													>
														Make default
													</button>
												)}
											</td>
											<td className="py-2">
												<label className="inline-flex items-center gap-2 text-neutral-medium">
													<input
														type="checkbox"
														checked={r.isEnabled}
														onChange={(e) => toggleEnabled(r.code, e.target.checked)}
														disabled={updating === r.code}
													/>
													<span>{r.isEnabled ? 'Enabled' : 'Disabled'}</span>
												</label>
											</td>
											<td className="py-2 text-right">
												<button
													className="px-2 py-1 text-xs border border-line-medium rounded hover:bg-backdrop-medium text-neutral-medium"
													onClick={() => removeLocale(r.code)}
													disabled={r.isDefault || updating === r.code}
													title={r.isDefault ? 'Cannot delete default locale' : 'Delete locale'}
												>
													Delete
												</button>
											</td>
										</tr>
									))}
								</tbody>
							</table>
						)}
						<p className="text-xs text-neutral-low">
							Locales are sourced from environment variables DEFAULT_LOCALE and SUPPORTED_LOCALES, and persisted in the database.
						</p>
					</div>
				</div>
			</main>
			<div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
				<AdminFooter />
			</div>
		</div>
	)
}



