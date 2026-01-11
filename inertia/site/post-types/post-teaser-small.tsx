type TeaserProps = {
  post: {
    id: string
    type: string
    locale: string
    slug: string
    title: string
    url?: string
    updatedAt?: string
  }
}

export default function PostTeaserSmall({ post }: TeaserProps) {
  const url = post.url || `/posts/${post.slug}`
  const dateText = post.updatedAt
    ? new Date(post.updatedAt).toLocaleDateString('en-US', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      })
    : ''
  return (
    <article className="flex items-baseline gap-3">
      <a href={url} className="text-neutral-high hover:underline">
        {post.title}
      </a>
      {dateText && <span className="text-xs text-neutral-low" suppressHydrationWarning>{dateText}</span>}
    </article>
  )
}
