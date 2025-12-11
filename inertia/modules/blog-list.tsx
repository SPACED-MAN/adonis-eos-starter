import { useEffect, useState } from 'react'
import { useInlineEditor, useInlineValue } from '../components/inline-edit/InlineEditorContext'
import { FontAwesomeIcon } from '../site/lib/icons'
import { pickMediaVariantUrl } from '../lib/media'
import BlogTeaser from '../site/post-types/blog-teaser'

interface BlogListProps {
  title: string
  subtitle?: string | null
  // IDs of Blog posts selected via post-reference field; if empty, show all.
  posts?: string[] | null
  __moduleId?: string
}

type BlogSummary = {
  id: string
  title: string
  slug: string
  excerpt?: string | null
  updatedAt?: string | null
  imageId?: string | null
  imageUrl?: string | null
}

export default function BlogList({ title: initialTitle, subtitle: initialSubtitle, posts: initialPosts, __moduleId }: BlogListProps) {
  const [items, setItems] = useState<BlogSummary[]>([])
  const [loading, setLoading] = useState(true)
  const { enabled } = useInlineEditor()
  const title = useInlineValue(__moduleId, 'title', initialTitle)
  const subtitle = useInlineValue(__moduleId, 'subtitle', initialSubtitle)
  const posts = useInlineValue(__moduleId, 'posts', initialPosts)

  useEffect(() => {
    let cancelled = false
      ; (async () => {
        try {
          const params = new URLSearchParams()
          params.set('status', 'published')
          params.set('limit', '20')
          const ids = Array.isArray(posts) ? posts.filter(Boolean) : []
          if (ids.length > 0) {
            params.set('ids', ids.join(','))
          }
          const res = await fetch(`/api/blogs?${params.toString()}`, {
            credentials: 'same-origin',
            headers: { Accept: 'application/json' },
          })
          if (!res.ok) {
            throw new Error('Failed to load blog posts')
          }
          const j = await res.json().catch(() => null)
          const list: any[] = Array.isArray(j?.data) ? j.data : []
          if (cancelled) return

          const mapped: BlogSummary[] = list.map((p: any) => ({
            id: String(p.id),
            title: String(p.title || 'Untitled'),
            slug: String(p.slug),
            excerpt: (p as any).excerpt ?? null,
            updatedAt: (p as any).updatedAt ?? null,
            imageId: (p as any).imageId ?? null,
            imageUrl: null,
          }))

          // Resolve hero media variants in parallel for all blogs
          const uniqueIds = Array.from(
            new Set(mapped.map((m) => m.imageId).filter(Boolean) as string[]),
          )
          const urlById = new Map<string, string>()
          await Promise.all(
            uniqueIds.map(async (id) => {
              try {
                const resMedia = await fetch(`/public/media/${encodeURIComponent(id)}`)
                if (!resMedia.ok) return
                const jm = await resMedia.json().catch(() => null)
                const data = jm?.data
                if (!data) return
                const meta = (data as any).metadata || {}
                const variants = Array.isArray(meta?.variants) ? (meta.variants as any[]) : []
                const darkSourceUrl =
                  typeof meta.darkSourceUrl === 'string' ? (meta.darkSourceUrl as string) : undefined
                const url = pickMediaVariantUrl(data.url, variants, 'wide', { darkSourceUrl })
                urlById.set(id, url)
              } catch {
                // ignore
              }
            }),
          )

          const withImages = mapped.map((m) => ({
            ...m,
            imageUrl: m.imageId ? urlById.get(m.imageId) || null : null,
          }))

          setItems(withImages)
        } catch {
          if (!cancelled) setItems([])
        } finally {
          if (!cancelled) setLoading(false)
        }
      })()
    return () => {
      cancelled = true
    }
  }, [JSON.stringify(posts ?? [])])

  if (loading && items.length === 0) {
    return (
      <section className="bg-backdrop-low py-12 lg:py-16" data-module="blog-list">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-screen-sm mx-auto text-center mb-8">
            <h2 className="mb-2 text-3xl lg:text-4xl font-extrabold tracking-tight text-neutral-high">
              {title}
            </h2>
            {subtitle && (
              <p className="text-sm text-neutral-medium">
                {subtitle}
              </p>
            )}
            <p className="mt-4 text-xs text-neutral-low">Loading blog posts…</p>
          </div>
        </div>
      </section>
    )
  }

  if (items.length === 0) {
    return null
  }

  return (
    <section className="bg-backdrop-low py-12 lg:py-16" data-module="blog-list">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-screen-sm text-center mb-8 lg:mb-16">
          <h2
            className="mb-4 text-3xl lg:text-4xl tracking-tight font-extrabold text-neutral-high"
            data-inline-path="title"
          >
            {title}
          </h2>
          {subtitle && (
            <p className="font-light text-neutral-medium sm:text-xl" data-inline-path="subtitle">
              {subtitle}
            </p>
          )}
          {enabled && (
            <div className="mt-3 flex justify-center">
              <button
                type="button"
                className="inline-flex items-center gap-2 text-xs text-neutral-low underline underline-offset-2"
                data-inline-type="post-reference"
                data-inline-path="posts"
                data-inline-multi="true"
                data-inline-post-type="blog"
                aria-label="Edit posts"
              >
                <FontAwesomeIcon icon="pencil" className="w-3 h-3" />
                Edit posts ({items.length})
              </button>
            </div>
          )}
        </div>
        <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
          {items.map((p) => (
            <BlogTeaser
              key={p.id}
              id={p.id}
              title={p.title}
              excerpt={p.excerpt}
              updatedAt={p.updatedAt}
              imageUrl={p.imageUrl}
              url={`/posts/${encodeURIComponent(p.slug)}`}
            />
          ))}
        </div>
      </div>
    </section>
  )
}


