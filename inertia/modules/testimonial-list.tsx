import { useEffect, useState } from 'react'
import { pickMediaVariantUrl } from '../lib/media'

interface TestimonialListProps {
  title: string
  subtitle?: string | null
  // IDs of Testimonial posts selected via post-reference field; if empty, show all.
  testimonials?: string[] | null
}

type TestimonialSummary = {
  id: string
  authorName: string
  authorTitle?: string | null
  quote?: string | null
  imageId?: string | null
  imageUrl?: string | null
}

export default function TestimonialList({ title, subtitle, testimonials }: TestimonialListProps) {
  const [items, setItems] = useState<TestimonialSummary[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const params = new URLSearchParams()
        params.set('status', 'published')
        params.set('limit', '8')
        const ids = Array.isArray(testimonials) ? testimonials.filter(Boolean) : []
        if (ids.length > 0) {
          params.set('ids', ids.join(','))
        }
        const res = await fetch(`/api/testimonials?${params.toString()}`, {
          credentials: 'same-origin',
          headers: { Accept: 'application/json' },
        })
        if (!res.ok) {
          throw new Error('Failed to load testimonials')
        }
        const j = await res.json().catch(() => null)
        const list: any[] = Array.isArray(j?.data) ? j.data : []
        if (cancelled) return

        const mapped: TestimonialSummary[] = list.map((t: any) => ({
          id: String(t.id),
          authorName: String(t.authorName || 'Anonymous'),
          authorTitle: (t as any).authorTitle ?? null,
          quote: (t as any).quote ?? null,
          imageId: (t as any).imageId ?? null,
          imageUrl: null,
        }))

        // Resolve avatar media variants in parallel for all testimonials
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
              const url = pickMediaVariantUrl(data.url, variants, 'thumb')
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
  }, [JSON.stringify(testimonials ?? [])])

  if (loading && items.length === 0) {
    return (
      <section className="bg-backdrop-low py-8 lg:py-16" data-module="testimonial-list">
        <div className="container mx-auto px-4 lg:px-6">
          <div className="mx-auto max-w-screen-sm text-center mb-8">
            <h2 className="mb-4 text-3xl md:text-4xl font-extrabold tracking-tight text-neutral-high">
              {title}
            </h2>
            {subtitle && (
              <p className="font-light text-neutral-medium sm:text-lg">
                {subtitle}
              </p>
            )}
            <p className="mt-4 text-xs text-neutral-low">Loading testimonials…</p>
          </div>
        </div>
      </section>
    )
  }

  if (items.length === 0) {
    return null
  }

  return (
    <section className="bg-backdrop-low py-8 lg:py-16" data-module="testimonial-list">
      <div className="container mx-auto px-4 lg:px-6 text-center">
        <div className="mx-auto max-w-screen-sm mb-8 lg:mb-12">
          <h2 className="mb-4 text-3xl md:text-4xl tracking-tight font-extrabold text-neutral-high">
            {title}
          </h2>
          {subtitle && (
            <p className="mb-8 font-light text-neutral-medium sm:text-lg">
              {subtitle}
            </p>
          )}
        </div>

        <div className="grid gap-6 mb-8 lg:mb-12 lg:grid-cols-2">
          {items.map((t) => (
            <figure
              key={t.id}
              className="flex flex-col justify-center items-center p-8 text-center bg-backdrop-high border border-line md:p-10 lg:border-r-0 last:lg:border-r dark:border-none"
            >
              <blockquote className="mx-auto mb-6 max-w-2xl text-neutral-medium">
                {t.quote && (
                  <p className="my-4 text-sm md:text-base">
                    “{t.quote}”
                  </p>
                )}
              </blockquote>
              <figcaption className="flex justify-center items-center space-x-3">
                {t.imageUrl && (
                  <img
                    className="w-9 h-9 rounded-full object-cover"
                    src={t.imageUrl}
                    alt={t.authorName}
                    loading="lazy"
                    decoding="async"
                  />
                )}
                <div className="space-y-0.5 font-medium text-left">
                  <div className="text-neutral-high">{t.authorName}</div>
                  {t.authorTitle && (
                    <div className="text-xs font-light text-neutral-medium">
                      {t.authorTitle}
                    </div>
                  )}
                </div>
              </figcaption>
            </figure>
          ))}
        </div>

        <div className="text-center">
          <a
            href="#"
            className="inline-flex items-center justify-center py-2.5 px-5 text-sm font-medium text-neutral-high bg-backdrop-high border border-line rounded-lg hover:bg-backdrop-medium focus:outline-none focus:ring-2 focus:ring-standout/40"
          >
            Show more…
          </a>
        </div>
      </div>
    </section>
  )
}


