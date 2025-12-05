import React, { useEffect, useState } from 'react'
import { pickMediaVariantUrl } from '../lib/media'

type KitchenSinkProps = {
	title: string
	description?: string
	postRefs?: string[]
	count?: number
	category?: string
	tags?: string[]
	featured?: boolean
	publishDate?: string
	linkUrl?: string
	image?: string // media ID
	imageVariant?: string // e.g., thumb, small, medium, large, hero, cropped
	metadata?: { author?: string; readingTime?: number; attributionRequired?: boolean }
	items?: Array<{ label?: string; value?: string; highlight?: boolean }>
	content?: any
}

export default function KitchenSink(props: KitchenSinkProps) {
	const [resolvedImageUrl, setResolvedImageUrl] = useState<string | null>(null)

	useEffect(() => {
		async function resolveImage() {
			const id = props.image
			if (!id) {
				setResolvedImageUrl(null)
				return
			}
			try {
				const res = await fetch(`/public/media/${encodeURIComponent(id)}`)
				if (!res.ok) {
					setResolvedImageUrl(null)
					return
				}
				const j = await res.json().catch(() => null)
				const data = j?.data
				if (!data) {
					setResolvedImageUrl(null)
					return
				}
				const variants = Array.isArray(data.metadata?.variants)
					? (data.metadata.variants as any[])
					: []
				const url = pickMediaVariantUrl(
					data.url,
					variants,
					props.imageVariant || null,
				)
				setResolvedImageUrl(url)
			} catch {
				setResolvedImageUrl(null)
			}
		}
		resolveImage()
	}, [props.image, props.imageVariant])

	return (
		<section className="py-12 sm:py-16" data-module="kitchen-sink">
			<div className="container mx-auto px-4 sm:px-6 lg:px-8">
				<div className="border border-line-low rounded-lg bg-backdrop-low p-6 sm:p-8 space-y-6">
					<header className="space-y-2">
						<h2 className="text-2xl font-semibold tracking-tight text-neutral-high">
							{props.title}
						</h2>
						{props.description && (
							<p className="text-base text-neutral-medium">
								{props.description}
							</p>
						)}
					</header>

					{resolvedImageUrl && (
						<div className="rounded-lg overflow-hidden border border-line-medium">
							<img src={resolvedImageUrl} alt={props.title} className="w-full h-auto" />
						</div>
					)}

					<div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
						<Info label="Count" value={String(props.count ?? '')} />
						<Info label="Category" value={props.category ?? ''} />
						<Info label="Tags" value={(props.tags || []).join(', ')} />
						<Info label="Featured" value={props.featured ? 'Yes' : 'No'} />
						<Info label="Publish Date" value={props.publishDate ?? ''} />
						<Info label="Link URL" value={props.linkUrl ?? ''} />
					</div>

					{props.metadata && (
						<div className="text-sm space-y-1">
							<h3 className="font-medium text-neutral-high">Metadata</h3>
							<ul className="list-disc pl-5 text-neutral-medium">
								<li>Author: {props.metadata.author ?? ''}</li>
								<li>Reading Time: {props.metadata.readingTime ?? ''} min</li>
								<li>
									Attribution Required:{' '}
									{props.metadata.attributionRequired ? 'Yes' : 'No'}
								</li>
							</ul>
						</div>
					)}

					{Array.isArray(props.postRefs) && (
						<div className="text-sm space-y-1">
							<h3 className="font-medium text-neutral-high">Post References</h3>
							<div className="text-neutral-medium">
								Selected IDs:{' '}
								{(props.postRefs || []).join(', ') || '(none)'}
							</div>
						</div>
					)}

					{Array.isArray(props.items) && props.items.length > 0 && (
						<div className="text-sm space-y-1">
							<h3 className="font-medium text-neutral-high">Items</h3>
							<ul className="list-disc pl-5">
								{props.items.map((it, idx) => (
									<li
										key={idx}
										className={it.highlight ? 'text-standout' : 'text-neutral-high'}
									>
										<strong>{it.label}:</strong> {it.value}
									</li>
								))}
							</ul>
						</div>
					)}

					{props.content?.root && (
						<div className="prose max-w-none">
							{/* Minimal preview of Lexical JSON */}
							{renderLexicalPreview(props.content)}
						</div>
					)}
				</div>
			</div>
		</section>
	)
}

function Info({ label, value }: { label: string; value: string }) {
	return (
		<div>
			<div className="text-neutral-low">{label}</div>
			<div className="text-neutral-high">{value}</div>
		</div>
	)
}

function renderLexicalPreview(json: any): React.ReactNode {
	if (!json?.root?.children) return null
	return (json.root.children as any[]).map((node, i) => {
		if (node.type === 'paragraph') {
			const text = (node.children || []).map((c: any) => c.text || '').join('')
			return (
				<p key={i} className="my-2">
					{text}
				</p>
			)
		}
		return null
	})
}



