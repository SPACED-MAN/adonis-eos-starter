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
	linkUrl?: string | { url?: string; target?: string; kind?: string }
	image?: string // media ID
	imageVariant?: string // e.g., thumb, small, medium, large, hero, cropped
	metadata?: { author?: string; readingTime?: number; attributionRequired?: boolean }
	items?: Array<{ label?: string; value?: string; highlight?: boolean }>
	content?: any
	icon?: string | null
	selectOption?: string | null
	multiSelect?: string[]
	booleanFlag?: boolean
	numberField?: number | null
	dateField?: string | null
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
				const meta = (data as any).metadata || {}
				const variants = Array.isArray(meta?.variants) ? (meta.variants as any[]) : []
				const darkSourceUrl =
					typeof meta.darkSourceUrl === 'string' ? (meta.darkSourceUrl as string) : undefined
				const url = pickMediaVariantUrl(
					data.url,
					variants,
					props.imageVariant || null,
					{ darkSourceUrl },
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
						<h2
							className="text-2xl font-semibold tracking-tight text-neutral-high"
							data-inline-path="title"
						>
							{props.title}
						</h2>
						{props.description && (
							<p className="text-base text-neutral-medium" data-inline-path="description">
								{props.description}
							</p>
						)}
					</header>

					{resolvedImageUrl && (
						<div className="rounded-lg overflow-hidden border border-line-medium" data-inline-type="media" data-inline-path="image">
							<img src={resolvedImageUrl} alt={props.title} className="w-full h-auto" />
						</div>
					)}

					<div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
						<Info label="Count" value={String(props.count ?? '')} dataPath="count" type="number" />
						<Info label="Category" value={props.category ?? ''} dataPath="category" type="select" dataOptions='["general","news","updates"]' />
						<Info label="Tags" value={(props.tags || []).join(', ')} dataPath="tags" type="multiselect" dataOptions='["alpha","beta","gamma"]' dataMulti="true" />
						<Info label="Featured" value={props.featured ? 'Yes' : 'No'} dataPath="featured" type="boolean" />
						<Info label="Publish Date" value={props.publishDate ?? ''} dataPath="publishDate" type="date" />
						<Info label="Link URL" value={typeof props.linkUrl === 'string' ? props.linkUrl : (props.linkUrl?.url ?? '')} dataPath="linkUrl" type="link" />
						<Info label="Icon" value={props.icon ?? ''} dataPath="icon" type="icon" />
						<Info label="Select Option" value={props.selectOption ?? ''} dataPath="selectOption" type="select" dataOptions='["general","news","updates"]' />
						<Info label="Multi Select" value={(props.multiSelect || []).join(', ')} dataPath="multiSelect" type="multiselect" dataOptions='["alpha","beta","gamma"]' dataMulti="true" />
						<Info label="Boolean Flag" value={props.booleanFlag ? 'Yes' : 'No'} dataPath="booleanFlag" type="boolean" />
						<Info label="Number Field" value={String(props.numberField ?? '')} dataPath="numberField" type="number" />
						<Info label="Date Field" value={props.dateField ?? ''} dataPath="dateField" type="date" />
					</div>

					{props.metadata && (
						<div className="text-sm space-y-1">
							<h3 className="font-medium text-neutral-high">Metadata</h3>
							<ul className="list-disc pl-5 text-neutral-medium">
								<li data-inline-path="metadata.author">Author: {props.metadata.author ?? ''}</li>
								<li data-inline-path="metadata.readingTime" data-inline-type="number">
									Reading Time: {props.metadata.readingTime ?? ''} min
								</li>
								<li>
									Attribution Required:{' '}
									<span data-inline-path="metadata.attributionRequired" data-inline-type="boolean">
										{props.metadata.attributionRequired ? 'Yes' : 'No'}
									</span>
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
										className={it.highlight ? 'text-standout-high' : 'text-neutral-high'}
									>
										<strong className={it.highlight ? 'text-standout-high' : 'text-neutral-high'} data-inline-path={`items.${idx}.label`}>{it.label}:</strong>{' '}
										<span className={it.highlight ? 'text-standout-high' : 'text-neutral-high'} data-inline-path={`items.${idx}.value`}>{it.value}</span>{' '}
										<span
											className="text-xs text-neutral-medium"
											data-inline-path={`items.${idx}.highlight`}
											data-inline-type="boolean"
										>
											{it.highlight ? '(highlighted)' : ''}
										</span>
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

function Info({
	label,
	value,
	dataPath,
	type,
	dataOptions,
	dataMulti
}: {
	label: string
	value: string
	dataPath?: string
	type?: string
	dataOptions?: string
	dataMulti?: string
}) {
	return (
		<div>
			<div className="text-neutral-low">{label}</div>
			<div
				className="text-neutral-high"
				{...(dataPath ? { 'data-inline-path': dataPath } : {})}
				{...(type ? { 'data-inline-type': type } : {})}
				{...(dataOptions ? { 'data-inline-options': dataOptions } : {})}
				{...(dataMulti ? { 'data-inline-multi': dataMulti } : {})}
			>
				{value}
			</div>
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



