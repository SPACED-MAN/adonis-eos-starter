import { useEffect, useState } from 'react'
import { pickMediaVariantUrl } from '../lib/media'
import { FontAwesomeIcon } from '../site/lib/icons'

interface BlogListProps {
  title: string
  subtitle?: string | null
  // IDs of Blog posts selected via post-reference field; if empty, show all.
  posts?: string[] | null
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

export default function BlogList({ title, subtitle, posts }: BlogListProps) {
  const [items, setItems] = useState<BlogSummary[]>([])
  const [loading, setLoading] = useState(true)

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
                const variants = Array.isArray(data.metadata?.variants)
                  ? (data.metadata.variants as any[])
                  : []
                const url = pickMediaVariantUrl(data.url, variants, 'wide')
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

  return (
    <section className="bg-backdrop-low py-12 lg:py-16" data-module="blog-list">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-screen-sm text-center mb-8 lg:mb-16">
          <h2 className="mb-4 text-3xl lg:text-4xl tracking-tight font-extrabold text-neutral-high">
            {title}
          </h2>
          {subtitle && (
            <p className="font-light text-neutral-medium sm:text-xl">
              {subtitle}
            </p>
          )}
        </div>
        <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
          {items.map((p) => {
            const dateLabel = formatDate(p.updatedAt)
            return (
              <article
                key={p.id}
                className="bg-backdrop-high rounded-lg border border-line-low shadow-sm overflow-hidden flex flex-col"
              >
                {p.imageUrl && (
                  <a href={`/posts/${encodeURIComponent(p.slug)}`} className="block">
                    <img
                      src={p.imageUrl}
                      alt={p.title}
                      className="w-full h-40 object-cover"
                      loading="lazy"
                      decoding="async"
                    />
                  </a>
                )}
                <div className="p-6 flex flex-col flex-1">
                  <div className="flex justify-between items-center mb-4 text-neutral-medium text-xs">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded bg-backdrop-medium text-neutral-high">
                      {/* Semantic category placeholder; can be wired to taxonomies later */}
                      Blog
                    </span>
                    {dateLabel && (
                      <span className="text-xs text-neutral-low">
                        {dateLabel}
                      </span>
                    )}
                  </div>
                  <h3 className="mb-2 text-2xl font-bold tracking-tight text-neutral-high">
                    <a href={`/posts/${encodeURIComponent(p.slug)}`}>{p.title}</a>
                  </h3>
                  {p.excerpt && (
                    <p className="mb-5 font-light text-neutral-medium">
                      {p.excerpt}
                    </p>
                  )}
                  <div className="mt-auto flex justify-between items-center">
                    {/* Author block reserved for future blog-specific enrichment */}
                    <div className="flex items-center space-x-3 text-sm text-neutral-medium">
                      <span className="font-medium text-neutral-high">
                        {/* Placeholder author label; real author wiring can come later */}
                        Blog team
                      </span>
                    </div>
                    <a
                      href={`/posts/${encodeURIComponent(p.slug)}`}
                      className="inline-flex items-center font-medium text-standout hover:underline"
                    >
                      Read more
                      <FontAwesomeIcon icon="arrow-right" className="ml-2 text-xs" />
                    </a>
                  </div>
                </div>
              </article>
            )
          })}
        </div>
      </div>
    </section>
  )
}


