import { useEffect, useState } from 'react'
import { pickMediaVariantUrl } from '../lib/media'
import { FontAwesomeIcon } from '../site/lib/icons'
import type { Button, LinkValue } from './types'

interface ProseWithMediaProps {
	title: string
	body?: string | null
	image?: string | null // media ID
	imageAlt?: string | null
	imagePosition?: 'left' | 'right'
	primaryCta?: Button | null
	backgroundColor?: string
}

export default function ProseWithMedia({
	title,
	body,
	image,
	imageAlt,
	imagePosition = 'left',
	primaryCta,
	backgroundColor = 'bg-backdrop-low',
}: ProseWithMediaProps) {
	const [resolvedImageUrl, setResolvedImageUrl] = useState<string | null>(null)

	useEffect(() => {
		let cancelled = false

		async function resolveImage() {
			if (!image) {
				if (!cancelled) setResolvedImageUrl(null)
				return
			}

			try {
				const res = await fetch(`/public/media/${encodeURIComponent(String(image))}`)
				if (!res.ok) {
					if (!cancelled) setResolvedImageUrl(null)
					return
				}
				const j = await res.json().catch(() => null)
				const data = j?.data
				if (!data) {
					if (!cancelled) setResolvedImageUrl(null)
					return
				}
				const variants = Array.isArray(data.metadata?.variants)
					? (data.metadata.variants as any[])
					: []
				const url = pickMediaVariantUrl(data.url, variants, undefined)
				if (!cancelled) setResolvedImageUrl(url)
			} catch {
				if (!cancelled) setResolvedImageUrl(null)
			}
		}

		resolveImage()
		return () => {
			cancelled = true
		}
	}, [image])

	function resolveButtonHref(url: string | LinkValue): string | undefined {
		if (!url) return undefined
		if (typeof url === 'string') return url
		if (url.kind === 'url') return url.url
		if (url.slug && url.locale) {
			return `/${encodeURIComponent(url.locale)}/${encodeURIComponent(url.slug)}`
		}
		if (url.slug) {
			return `/${encodeURIComponent(url.slug)}`
		}
		return undefined
	}

	const hasCta = Boolean(primaryCta && primaryCta.label && primaryCta.url)

	const imageBlock = resolvedImageUrl ? (
		<div className="w-full">
			<div className="w-full rounded-xl overflow-hidden border border-line bg-backdrop-high">
				<img
					src={resolvedImageUrl}
					alt={imageAlt || ''}
					className="w-full h-auto object-cover"
					loading="lazy"
					decoding="async"
				/>
			</div>
		</div>
	) : null

	return (
		<section className={`${backgroundColor} py-12 sm:py-16`} data-module="prose-with-media">
			<div className="container mx-auto px-4 sm:px-6 lg:px-8">
				<div className="md:grid md:grid-cols-2 md:gap-8 xl:gap-16 items-center">
					{imagePosition === 'left' && imageBlock}

					<div className="mt-8 md:mt-0">
						<h2 className="mb-4 text-3xl sm:text-4xl font-extrabold tracking-tight text-neutral-high">
							{title}
						</h2>
						{body && (
							<p className="mb-6 text-base md:text-lg font-normal text-neutral-medium">
								{body}
							</p>
						)}
						{hasCta && primaryCta && primaryCta.label && primaryCta.url && (() => {
							const href = resolveButtonHref(primaryCta.url)
							if (!href) return null
							const linkTarget =
								typeof primaryCta.url === 'object' && primaryCta.url && primaryCta.url.kind
									? (primaryCta.url.target === '_blank' ? '_blank' : '_self')
									: (primaryCta.target || '_self')
							return (
								<a
									href={href}
									target={linkTarget}
									rel={linkTarget === '_blank' ? 'noopener noreferrer' : undefined}
									className="inline-flex items-center text-on-standout bg-standout hover:bg-standout/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-standout font-medium rounded-lg text-sm px-5 py-2.5 transition-colors"
								>
									{primaryCta.label}
									<FontAwesomeIcon icon="arrow-right" className="ml-2 -mr-1 text-sm" />
								</a>
							)
						})()}
					</div>

					{imagePosition !== 'left' && imageBlock}
				</div>
			</div>
		</section>
	)
}


