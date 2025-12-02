import { useEffect, useState } from 'react'
import { pickMediaVariantUrl } from '../lib/media'

interface CompanyListProps {
	title: string
	subtitle?: string | null
	// IDs of Company posts selected via post-reference field; if empty, show all.
	companies?: string[] | null
}

type CompanySummary = {
	id: string
	title: string
	slug: string
	imageId?: string | null
	imageUrl?: string | null
}

export default function CompanyList({ title, subtitle, companies }: CompanyListProps) {
	const [items, setItems] = useState<CompanySummary[]>([])
	const [loading, setLoading] = useState(true)

	useEffect(() => {
		let cancelled = false
			; (async () => {
				try {
					const params = new URLSearchParams()
					params.set('status', 'published')
					params.set('limit', '50')
					const ids = Array.isArray(companies) ? companies.filter(Boolean) : []
					if (ids.length > 0) {
						params.set('ids', ids.join(','))
					}
					const res = await fetch(`/api/companies?${params.toString()}`, {
						credentials: 'same-origin',
						headers: { Accept: 'application/json' },
					})
					if (!res.ok) {
						throw new Error('Failed to load companies')
					}
					const j = await res.json().catch(() => null)
					const list: any[] = Array.isArray(j?.data) ? j.data : []
					if (cancelled) return
					const mapped: CompanySummary[] = list.map((p: any) => ({
						id: String(p.id),
						title: String(p.title || 'Company'),
						slug: String(p.slug),
						imageId: (p as any).imageId ?? null,
						imageUrl: null,
					}))

					// Resolve logo media variants in parallel for all companies
					const uniqueIds = Array.from(
						new Set(mapped.map((m) => m.imageId).filter(Boolean) as string[]),
					)
					const urlById = new Map<string, string>()
					await Promise.all(
						uniqueIds.map(async (id) => {
							try {
								const resMedia = await fetch(`/public/media/${encodeURIComponent(id)}`)
								if (!resMedia.ok) return
								const jm = await resMedia.json().catch(() => null)
								const data = jm?.data
								if (!data) return
								const variants = Array.isArray(data.metadata?.variants)
									? (data.metadata.variants as any[])
									: []
								const url = pickMediaVariantUrl(data.url, variants, 'thumb')
								urlById.set(id, url)
							} catch {
								// ignore
							}
						}),
					)

					const withImages = mapped.map((m) => ({
						...m,
						imageUrl: m.imageId ? urlById.get(m.imageId) || null : null,
					}))

					setItems(withImages)
				} catch {
					if (!cancelled) setItems([])
				} finally {
					if (!cancelled) setLoading(false)
				}
			})()
		return () => {
			cancelled = true
		}
	}, [JSON.stringify(companies ?? [])])

	if (loading && items.length === 0) {
		return (
			<section className="bg-backdrop-low py-8 lg:py-16" data-module="company-list">
				<div className="container mx-auto px-4 lg:px-6">
					<h2 className="mb-4 lg:mb-8 text-3xl md:text-4xl font-extrabold tracking-tight text-center text-neutral-high">
						{title}
					</h2>
					{subtitle && (
						<p className="max-w-2xl mx-auto text-center font-light text-neutral-medium sm:text-xl">
							{subtitle}
						</p>
					)}
					<p className="mt-6 text-center text-xs text-neutral-low">Loading companies…</p>
				</div>
			</section>
		)
	}

	if (items.length === 0) {
		return null
	}

	return (
		<section className="bg-backdrop-low py-8 lg:py-16" data-module="company-list">
			<div className="container mx-auto px-4 lg:px-6">
				<h2 className="mb-8 lg:mb-16 text-3xl md:text-4xl font-extrabold tracking-tight leading-tight text-center text-neutral-high">
					{title}
				</h2>
				{subtitle && (
					<p className="max-w-2xl mx-auto mb-10 text-center font-light text-neutral-medium sm:text-xl">
						{subtitle}
					</p>
				)}
				<div className="grid grid-cols-2 gap-8 text-neutral-medium sm:gap-12 md:grid-cols-3 lg:grid-cols-6">
					{items.map((c) => (
						<div
							key={c.id}
							className="flex items-center justify-center"
						>
							<a
								href={`/posts/${encodeURIComponent(c.slug)}`}
								className="flex justify-center items-center"
							>
								{c.imageUrl ? (
									<img
										src={c.imageUrl}
										alt={c.title}
										className="h-9 w-auto object-contain hover:opacity-90 transition"
										loading="lazy"
										decoding="async"
									/>
								) : (
									<span className="text-sm font-medium text-neutral-high">
										{c.title}
									</span>
								)}
							</a>
						</div>
					))}
				</div>
			</div>
		</section>
	)
}


