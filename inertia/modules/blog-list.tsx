import { useEffect, useState } from 'react'
import { pickMediaVariantUrl } from '../lib/media'

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
    ;(async () => {
      try {
        const params = new URLSearchParams()
        params.set('type', 'blog')
        params.set('status', 'published')
        params.set('limit', '20')
        const ids = Array.isArray(posts) ? posts.filter(Boolean) : []
        if (ids.length > 0) {
          params.set('ids', ids.join(','))
        }
        const res = await fetch(`/api/posts?${params.toString()}`, {
          credentials: 'same-origin',
          headers: { Accept: 'application/json' },
        })
        if (!res.ok) {
          throw new Error('Failed to load blog posts')
        }
        const j = await res.json().catch(() => null)
        const list: any[] = Array.isArray(j?.data) ? j.data : []
        if (cancelled) return

        // For now, we only use generic fields from /api/posts. Hero images can be added later via type-specific endpoint if needed.
        const mapped: BlogSummary[] = list.map((p: any) => ({
          id: String(p.id),
          title: String(p.title || 'Untitled'),
          slug: String(p.slug),
          excerpt: (p as any).excerpt ?? null,
          updatedAt: (p as any).updatedAt ?? null,
          imageId: null,
          imageUrl: null,
        }))

        // If/when blog hero images are exposed, this is where we would resolve them via /public/media and pickMediaVariantUrl.
        setItems(mapped)
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
        <div className="grid gap-8 lg:grid-cols-2">
          {items.map((p) => {
            const dateLabel = formatDate(p.updatedAt)
            return (
              <article
                key={p.id}
                className="p-6 bg-backdrop-high rounded-lg border border-line shadow-sm"
              >
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
                <div className="flex justify-between items-center">
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
                    <svg
                      className="ml-2 w-4 h-4"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <path
                        fillRule="evenodd"
                        d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z"
                        clipRule="evenodd"
                      ></path>
                    </svg>
                  </a>
                </div>
              </article>
            )
          })}
        </div>
      </div>
    </section>
  )
}


