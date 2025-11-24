type TeaserProps = {
	post: {
		id: string
		type: string
		locale: string
		slug: string
		title: string
		excerpt?: string | null
		metaTitle?: string | null
		metaDescription?: string | null
	}
}

export default function PostTeaserDefault({ post }: TeaserProps) {
	return (
		<article className="border border-line rounded-md p-4 bg-backdrop-low">
			<a href={`/posts/${post.slug}`} className="block hover:underline">
				<h3 className="text-lg font-semibold text-neutral-high">{post.title}</h3>
			</a>
			{post.excerpt && <p className="text-sm text-neutral-medium mt-1">{post.excerpt}</p>}
		</article>
	)
}


