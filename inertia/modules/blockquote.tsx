import { useEffect, useState } from 'react'
import { pickMediaVariantUrl } from '../lib/media'
import { FontAwesomeIcon } from '../site/lib/icons'

interface BlockquoteProps {
	quote: string
	authorName: string
	authorTitle?: string | null
	avatar?: string | null // media ID
	backgroundColor?: string
}

export default function Blockquote({
	quote,
	authorName,
	authorTitle,
	avatar,
	backgroundColor = 'bg-backdrop-low',
}: BlockquoteProps) {
	const [avatarUrl, setAvatarUrl] = useState<string | null>(null)

	useEffect(() => {
		let cancelled = false

		async function resolveAvatar() {
			if (!avatar) {
				if (!cancelled) setAvatarUrl(null)
				return
			}

			try {
				const res = await fetch(`/public/media/${encodeURIComponent(String(avatar))}`)
				if (!res.ok) {
					if (!cancelled) setAvatarUrl(null)
					return
				}
				const j = await res.json().catch(() => null)
				const data = j?.data
				if (!data) {
					if (!cancelled) setAvatarUrl(null)
					return
				}
				const meta = (data as any).metadata || {}
				const variants = Array.isArray(meta?.variants) ? (meta.variants as any[]) : []
				const darkSourceUrl =
					typeof meta.darkSourceUrl === 'string' ? (meta.darkSourceUrl as string) : undefined
				const url = pickMediaVariantUrl(data.url, variants, 'thumb', { darkSourceUrl })
				if (!cancelled) setAvatarUrl(url)
			} catch {
				if (!cancelled) setAvatarUrl(null)
			}
		}

		resolveAvatar()
		return () => {
			cancelled = true
		}
	}, [avatar])

	return (
		<section className={`${backgroundColor} py-8 lg:py-16`} data-module="blockquote">
			<div className="max-w-screen-xl px-4 mx-auto text-center">
				<figure className="max-w-screen-md mx-auto">
					<div className="mx-auto mb-6 flex items-center justify-center text-neutral-low">
						<FontAwesomeIcon
							icon="quote-left"
							size="3x"
							className="inline-block"
						/>
					</div>
					<blockquote>
						<p className="text-2xl md:text-3xl font-medium text-neutral-high">
							“{quote}”
						</p>
					</blockquote>
					<figcaption className="flex items-center justify-center mt-8 space-x-4">
						{avatarUrl && (
							<img
								className="w-14 h-14 rounded-full object-cover"
								src={avatarUrl}
								alt={authorName}
								loading="lazy"
								decoding="async"
							/>
						)}
						<div className="flex items-center divide-x-2 divide-neutral-low/60">
							<div className="pr-3 font-medium text-neutral-high">
								{authorName}
							</div>
							{authorTitle && (
								<div className="pl-3 text-sm font-light text-neutral-medium">
									{authorTitle}
								</div>
							)}
						</div>
					</figcaption>
				</figure>
			</div>
		</section>
	)
}


