import { useEffect, useMemo, useState } from 'react'
import { Head, Link } from '@inertiajs/react'
import { AdminHeader } from '../../components/AdminHeader'
import { AdminFooter } from '../../components/AdminFooter'
import { AdminBreadcrumbs } from '../../components/AdminBreadcrumbs'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '~/components/ui/select'

type Template = { id: string; name: string; post_type: string; description?: string | null; locked?: boolean; updated_at?: string }

function labelize(type: string): string {
	if (!type) return ''
	const withSpaces = type.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/[-_]+/g, ' ')
	return withSpaces.split(' ').filter(Boolean).map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
}

function getXsrfToken(): string | undefined {
	if (typeof document === 'undefined') return undefined
	const m = document.cookie.match(/(?:^|; )XSRF-TOKEN=([^;]+)/)
	return m ? decodeURIComponent(m[1]) : undefined
}

export default function TemplatesIndex() {
	const [templates, setTemplates] = useState<Template[]>([])
	const [q, setQ] = useState('')
	const [postTypes, setPostTypes] = useState<string[]>([])
	const [type, setType] = useState<string>('')
	const [creating, setCreating] = useState(false)
	const [createForm, setCreateForm] = useState<{ name: string; postType: string }>({ name: '', postType: '' })

	useEffect(() => {
		; (async () => {
			const r = await fetch('/api/templates', { credentials: 'same-origin' })
			const json = await r.json().catch(() => ({}))
			setTemplates(Array.isArray(json?.data) ? json.data : [])
		})()
	}, [])

	useEffect(() => {
		; (async () => {
			try {
				const r = await fetch('/api/post-types', { credentials: 'same-origin' })
				const json = await r.json().catch(() => ({}))
				const list: string[] = Array.isArray(json?.data) ? json.data : []
				setPostTypes(list)
				if (!createForm.postType && list.length) {
					setCreateForm((f) => ({ ...f, postType: list[0] }))
				}
			} catch {
				setPostTypes([])
			}
		})()
	}, [])

	const filtered = useMemo(() => {
		const query = q.trim().toLowerCase()
		return templates.filter((t) => {
			const matchesQ = !query || t.name.toLowerCase().includes(query) || t.post_type.toLowerCase().includes(query)
			const matchesType = !type || t.post_type === type
			return matchesQ && matchesType
		})
	}, [templates, q, type])

	async function createTemplate() {
		const name = createForm.name.trim()
		const postType = createForm.postType.trim()
		if (!name || !postType) return
		setCreating(true)
		try {
			const res = await fetch('/api/templates', {
				method: 'POST',
				headers: {
					Accept: 'application/json',
					'Content-Type': 'application/json',
					...(getXsrfToken() ? { 'X-XSRF-TOKEN': getXsrfToken()! } : {}),
				},
				credentials: 'same-origin',
				body: JSON.stringify({ name, postType }),
			})
			if (res.ok) {
				const json = await res.json().catch(() => ({}))
				const id = json?.data?.id
				if (id) {
					window.location.href = `/admin/templates/${id}/edit`
					return
				}
			}
			alert('Failed to create template')
		} finally {
			setCreating(false)
		}
	}

	return (
		<div className="min-h-screen bg-backdrop-medium">
			<Head title="Templates" />
			<AdminHeader title="Templates" />
			<main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
				<AdminBreadcrumbs items={[{ label: 'Dashboard', href: '/admin' }, { label: 'Templates' }]} />
				<div className="bg-backdrop-low rounded-lg border border-line-low">
					<div className="px-6 py-4 border-b border-line-low flex items-center justify-between gap-3">
						<div className="flex items-center gap-2">
							<input
								value={q}
								onChange={(e) => setQ(e.target.value)}
								placeholder="Search by name or post type…"
								className="px-3 py-2 text-sm border border-line-medium rounded bg-backdrop-low text-neutral-high"
							/>
							<Select defaultValue={type || undefined} onValueChange={(val) => setType(val === 'all' ? '' : val)}>
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
						</div>
						<div className="flex items-center gap-2">
							<input
								value={createForm.name}
								onChange={(e) => setCreateForm((f) => ({ ...f, name: e.target.value }))}
								placeholder="New template name"
								className="px-3 py-2 text-sm border border-line-medium rounded bg-backdrop-low text-neutral-high"
							/>
							<Select
								defaultValue={createForm.postType}
								onValueChange={(val) => setCreateForm((f) => ({ ...f, postType: val }))}
							>
								<SelectTrigger className="w-[200px]">
									<SelectValue placeholder="Post type" />
								</SelectTrigger>
								<SelectContent>
									{postTypes.map((t) => (
										<SelectItem key={t} value={t}>{labelize(t)}</SelectItem>
									))}
								</SelectContent>
							</Select>
							<button
								onClick={createTemplate}
								disabled={creating || !createForm.name.trim() || !createForm.postType.trim()}
								className="px-3 py-2 text-sm rounded bg-standout text-on-standout disabled:opacity-50"
							>
								{creating ? 'Creating…' : 'Create New'}
							</button>
						</div>
					</div>
					<div className="divide-y divide-line">
						{filtered.length === 0 ? (
							<div className="p-6 text-neutral-low text-sm">No templates found.</div>
						) : (
							filtered.map((t) => (
								<div key={t.id} className="px-6 py-3 grid grid-cols-12 items-center">
									<div className="col-span-5">
										<div className="text-sm text-neutral-high font-medium">{t.name}</div>
										<div className="text-xs text-neutral-low">{labelize(t.post_type)}</div>
									</div>
									<div className="col-span-5 text-xs text-neutral-low">
										{t.updated_at ? new Date(t.updated_at).toLocaleString() : ''}
									</div>
									<div className="col-span-2 text-right">
										<Link href={`/admin/templates/${t.id}/edit`} className="px-3 py-1.5 text-xs border border-line-low rounded hover:bg-backdrop-medium text-neutral-medium">
											Edit
										</Link>
									</div>
								</div>
							))
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


