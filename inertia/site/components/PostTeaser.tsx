import { getTeaserComponent } from '../post-types/_resolver'

type PostTeaserProps = {
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
  theme?: string
}

export function PostTeaser({ post, theme }: PostTeaserProps) {
  const Teaser = getTeaserComponent(post.type, theme)
  return <Teaser post={post} />
}
