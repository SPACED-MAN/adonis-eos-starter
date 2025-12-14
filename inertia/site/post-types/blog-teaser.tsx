import { FontAwesomeIcon } from '../lib/icons'

interface BlogTeaserProps {
	id: string
	title: string
	excerpt?: string | null
	updatedAt?: string | null
	imageUrl?: string | null
	url: string
}

export default function BlogTeaser({ title, excerpt, updatedAt, imageUrl, url }: BlogTeaserProps) {
	const formatDate = (iso?: string | null): string | null => {
		if (!iso) return null
		const d = new Date(iso)
		if (Number.isNaN(d.getTime())) return null
		return d.toLocaleDateString(undefined, {
			year: 'numeric',
			month: 'short',
			day: 'numeric',
		})
	}

	const dateLabel = formatDate(updatedAt)

	return (
		<article className="bg-backdrop-medium rounded-lg border border-line-low shadow-sm overflow-hidden flex flex-col">
			{imageUrl && (
				<a href={url} className="block">
					<img
						src={imageUrl}
						alt={title}
						className="w-full h-40 object-cover"
						loading="lazy"
						decoding="async"
					/>
				</a>
			)}
			<div className="p-6 flex flex-col flex-1">
				<div className="flex justify-between items-center mb-4 text-neutral-medium text-xs">
					<span className="inline-flex items-center px-2.5 py-0.5 rounded bg-backdrop-low text-neutral-high">
						Blog
					</span>
					{dateLabel && (
						<span className="text-xs text-neutral-low">
							{dateLabel}
						</span>
					)}
				</div>
				<h3 className="mb-2 text-2xl font-bold tracking-tight text-neutral-high">
					<a href={url}>{title}</a>
				</h3>
				{excerpt && (
					<p className="mb-5 font-light text-neutral-high">
						{excerpt}
					</p>
				)}
				<div className="mt-auto flex justify-between items-center">
					<div className="flex items-center space-x-3 text-sm text-neutral-medium">
						<span className="font-medium text-neutral-high">
							Blog team
						</span>
					</div>
				<a
					href={url}
					className="inline-flex items-center font-medium text-standout-high hover:underline"
					aria-label={`Read more about ${title}`}
				>
					Read more
					<FontAwesomeIcon icon="arrow-right" className="ml-2 text-xs" />
				</a>
				</div>
			</div>
		</article>
	)
}


