import { useEffect, useMemo, useState } from 'react'

interface FeedProps {
  title?: string | Record<string, string> | null
  postTypes: string[]
  locale?: string | null
  limit?: number
  parentId?: string | null
  rootsOnly?: boolean
  sortBy?: 'published_at' | 'created_at' | 'updated_at'
  sortOrder?: 'asc' | 'desc'
  showExcerpt?: boolean
}

type PostItem = {
  id: string
  title: string
  slug: string
  status: string
  locale: string
  updatedAt: string
}

export default function Feed({
  title,
  postTypes,
  locale,
  limit = 10,
  parentId,
  rootsOnly = false,
  sortBy = 'published_at',
  sortOrder = 'desc',
  showExcerpt = true,
}: FeedProps) {
  const [items, setItems] = useState<PostItem[]>([])
  const [loading, setLoading] = useState<boolean>(true)

  const resolvedTitle = useMemo(() => {
    if (!title) return null
    if (typeof title === 'string') return title
    const loc = (typeof navigator !== 'undefined' && navigator.language?.slice(0, 2)) || 'en'
    return (title as any)[locale || loc] || (title as any)['en'] || Object.values(title)[0] || null
  }, [title, locale])

  useEffect(() => {
    let mounted = true
    ;(async () => {
      try {
        setLoading(true)
        const params = new URLSearchParams()
        params.set('status', 'published')
        params.set('sortBy', sortBy)
        params.set('sortOrder', sortOrder)
        params.set('limit', String(limit))
        if (locale) params.set('locale', locale)
        if (parentId) params.set('parentId', parentId)
        if (rootsOnly) params.set('roots', '1')
        if (postTypes && postTypes.length > 0) {
          // Use multi-type support in API
          params.set('types', postTypes.join(','))
        }
        const res = await fetch(`/api/posts?${params.toString()}`, { credentials: 'same-origin' })
        const json = await res.json().catch(() => ({}))
        const list: PostItem[] = Array.isArray(json?.data) ? json.data : []
        if (!mounted) return
        setItems(list.slice(0, limit))
      } finally {
        if (mounted) setLoading(false)
      }
    })()
    return () => {
      mounted = false
    }
  }, [postTypes?.join(','), locale, limit, parentId, rootsOnly, sortBy, sortOrder])

  return (
    <section data-module="feed" className="container mx-auto px-4 sm:px-6 lg:px-8 my-8">
      {resolvedTitle && <h2 className="text-2xl font-semibold mb-4">{resolvedTitle}</h2>}
      {loading ? (
        <div className="text-neutral-medium">Loading…</div>
      ) : items.length === 0 ? (
        <div className="text-neutral-low">No posts found.</div>
      ) : (
        <ul className="space-y-4">
          {items.map((it) => (
            <li key={it.id} className="border-b border-line pb-4">
              <a href={`/posts/${it.slug}`} className="text-lg font-medium text-standout hover:underline">
                {it.title}
              </a>
              {showExcerpt ? <div className="text-neutral-medium text-sm">{/* excerpt from API in future */}</div> : null}
              <div className="text-xs text-neutral-low">Locale: {it.locale}</div>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}



