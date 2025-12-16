import { useEffect, useState } from 'react'
import { useInlineEditor, useInlineValue } from '../components/inline-edit/InlineEditorContext'
import { FontAwesomeIcon } from '../site/lib/icons'
import { pickMediaVariantUrl } from '../lib/media'
import ProfileTeaser from '../site/post-types/profile-teaser'

interface ProfileListProps {
  title: string
  subtitle?: string | null
  // IDs of Profile posts selected via post-reference field; if empty, show all profiles.
  profiles?: string[] | null
  __moduleId?: string
}

type ProfileSummary = {
  id: string
  name: string
  role?: string | null
  bio?: string | null
  slug: string
  imageId?: string | null
  imageUrl?: string | null
}

export default function ProfileList({
  title: initialTitle,
  subtitle: initialSubtitle,
  profiles: initialProfiles,
  __moduleId,
}: ProfileListProps) {
  const [items, setItems] = useState<ProfileSummary[]>([])
  const [loading, setLoading] = useState(true)
  const { enabled } = useInlineEditor()
  const title = useInlineValue(__moduleId, 'title', initialTitle)
  const subtitle = useInlineValue(__moduleId, 'subtitle', initialSubtitle)
  const profiles = useInlineValue(__moduleId, 'profiles', initialProfiles)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const params = new URLSearchParams()
        params.set('status', 'published')
        params.set('limit', '50')
        const ids = Array.isArray(profiles) ? profiles.filter(Boolean) : []
        if (ids.length > 0) {
          params.set('ids', ids.join(','))
        }
        const res = await fetch(`/api/profiles?${params.toString()}`, {
          credentials: 'same-origin',
          headers: { Accept: 'application/json' },
        })
        if (!res.ok) {
          throw new Error('Failed to load profiles')
        }
        const j = await res.json().catch(() => null)
        const list: any[] = Array.isArray(j?.data) ? j.data : []
        if (cancelled) return
        const mapped: ProfileSummary[] = list.map((p: any) => ({
          id: String(p.id),
          name: String(p.name || 'Profile'),
          role: (p as any).role ?? null,
          bio: (p as any).bio ?? null,
          slug: String(p.slug),
          imageId: (p as any).imageId ?? null,
          imageUrl: null,
        }))
        // Resolve avatar media variants in parallel for all profiles
        const uniqueIds = Array.from(
          new Set(mapped.map((m) => m.imageId).filter(Boolean) as string[])
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
              const url = pickMediaVariantUrl(data.url, variants, 'thumb', { darkSourceUrl })
              urlById.set(id, url)
            } catch {
              // ignore
            }
          })
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
  }, [JSON.stringify(profiles ?? [])])

  if (loading && items.length === 0) {
    return (
      <section className="bg-backdrop-low py-12 lg:py-16" data-module="profile-list">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-screen-sm mx-auto text-center mb-8">
            <h2 className="mb-2 text-3xl font-extrabold tracking-tight text-neutral-high">
              {title}
            </h2>
            {subtitle && <p className="text-sm text-neutral-medium">{subtitle}</p>}
            <p className="mt-4 text-xs text-neutral-low">Loading profiles…</p>
          </div>
        </div>
      </section>
    )
  }

  if (items.length === 0) {
    return null
  }

  return (
    <section className="bg-backdrop-low py-12 lg:py-16" data-module="profile-list">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-screen-sm text-center mb-8 lg:mb-16">
          <h2
            className="mb-4 text-4xl tracking-tight font-extrabold text-neutral-high"
            data-inline-path="title"
          >
            {title}
          </h2>
          {subtitle && (
            <p
              className="font-light text-neutral-medium lg:mb-4 sm:text-xl"
              data-inline-path="subtitle"
            >
              {subtitle}
            </p>
          )}
          {enabled && (
            <div className="mt-2">
              <button
                type="button"
                className="inline-flex items-center gap-2 text-xs text-neutral-low underline underline-offset-2"
                data-inline-type="post-reference"
                data-inline-path="profiles"
                data-inline-multi="true"
                data-inline-post-type="profile"
                aria-label="Edit profiles"
              >
                <FontAwesomeIcon icon="pencil" className="w-3 h-3" />
                Edit profiles ({items.length})
              </button>
            </div>
          )}
        </div>
        <div className="grid gap-8 mb-6 lg:mb-16 md:grid-cols-2">
          {items.map((p) => (
            <ProfileTeaser
              key={p.id}
              id={p.id}
              name={p.name}
              role={p.role}
              bio={p.bio}
              imageUrl={p.imageUrl}
              url={`/posts/${encodeURIComponent(p.slug)}`}
            />
          ))}
        </div>
      </div>
    </section>
  )
}
