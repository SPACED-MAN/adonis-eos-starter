import { useEffect, useState } from 'react'
import { pickMediaVariantUrl } from '../lib/media'

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
				const variants = Array.isArray(data.metadata?.variants)
					? (data.metadata.variants as any[])
					: []
				const url = pickMediaVariantUrl(data.url, variants, 'thumb')
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
					<svg
						className="h-12 mx-auto mb-3 text-neutral-low"
						viewBox="0 0 24 27"
						fill="none"
						xmlns="http://www.w3.org/2000/svg"
						aria-hidden="true"
					>
						<path
							d="M14.017 18L14.017 10.609C14.017 4.905 17.748 1.039 23 0L23.995 2.151C21.563 3.068 20 5.789 20 8H24V18H14.017ZM0 18V10.609C0 4.905 3.748 1.038 9 0L9.996 2.151C7.563 3.068 6 5.789 6 8H9.983L9.983 18L0 18Z"
							fill="currentColor"
						/>
					</svg>
					<blockquote>
						<p className="text-2xl font-medium text-neutral-high">
							“{quote}”
						</p>
					</blockquote>
					<figcaption className="flex items-center justify-center mt-6 space-x-3">
						{avatarUrl && (
							<img
								className="w-6 h-6 rounded-full object-cover"
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


