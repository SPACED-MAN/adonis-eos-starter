type TeaserProps = {
	post: {
		id: string
		type: string
		locale: string
		slug: string
		title: string
		updatedAt?: string
	}
}

export default function PostTeaserSmall({ post }: TeaserProps) {
	const dateText = post.updatedAt
		? new Date(post.updatedAt).toLocaleDateString(undefined, { year: 'numeric', month: '2-digit', day: '2-digit' })
		: ''
	return (
		<article className="flex items-baseline gap-3">
			<a href={`/posts/${post.slug}`} className="text-neutral-high hover:underline">
				{post.title}
			</a>
			{dateText && <span className="text-xs text-neutral-low">{dateText}</span>}
		</article>
	)
}


