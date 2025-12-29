import { useEffect, useState } from 'react'
import { motion, type Variants } from 'framer-motion'
import { useInlineEditor, useInlineValue } from '../components/inline-edit/InlineEditorContext'
import { FontAwesomeIcon } from '../site/lib/icons'
import ProfileTeaser from '../site/post-types/profile-teaser'
import type { MediaObject } from '../utils/useMediaUrl'

interface ProfileListProps {
  title: string
  subtitle?: string | null
  // IDs of Profile posts selected via post-reference field; if empty, show all profiles.
  profiles?: string[] | null
  backgroundColor?: string
  __moduleId?: string
  _useReact?: boolean
}

type ProfileSummary = {
  id: string
  name: string
  role?: string | null
  bio?: string | null
  slug: string
  url: string
  image?: MediaObject | null
}

export default function ProfileList({
  title: initialTitle,
  subtitle: initialSubtitle,
  profiles: initialProfiles,
  backgroundColor: initialBackground = 'bg-backdrop-low',
  __moduleId,
  _useReact,
}: ProfileListProps) {
  const [items, setItems] = useState<ProfileSummary[]>([])
  const [loading, setLoading] = useState(true)
  const { enabled } = useInlineEditor()
  const title = useInlineValue(__moduleId, 'title', initialTitle)
  const subtitle = useInlineValue(__moduleId, 'subtitle', initialSubtitle)
  const profiles = useInlineValue(__moduleId, 'profiles', initialProfiles)
  const bg = useInlineValue(__moduleId, 'backgroundColor', initialBackground) || initialBackground

  const isDarkBg = bg === 'bg-neutral-high' || bg === 'bg-backdrop-high' || bg === 'bg-standout-medium'
  const textColor = isDarkBg ? 'text-on-high' : 'text-neutral-high'
  const subtextColor = isDarkBg ? 'text-on-high/80' : 'text-neutral-medium'

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

        const mapped: ProfileSummary[] = list.map((p: any) => {
          return {
            id: String(p.id),
            name: String(p.name || 'Profile'),
            role: (p as any).role ?? null,
            bio: (p as any).bio ?? null,
            slug: String(p.slug),
            url: String(p.url),
            image: p.image ?? null,
          }
        })

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
  }, [JSON.stringify(profiles ?? [])])

  const containerVariants: Variants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.12,
      },
    },
  }

  const itemVariants: Variants = {
    hidden: { opacity: 0, scale: 0.95, y: 30 },
    visible: {
      opacity: 1,
      scale: 1,
      y: 0,
      transition: { duration: 1.0, ease: 'easeOut' },
    },
  }

  const headerContent = (
    <div className="mx-auto max-w-screen-sm text-center mb-8 lg:mb-16">
      {_useReact ? (
        <motion.h2
          initial={{ opacity: 0, y: -10 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 1.0 }}
          className={`mb-4 text-4xl tracking-tight font-extrabold ${textColor}`}
          data-inline-path="title"
        >
          {title}
        </motion.h2>
      ) : (
        <h2
          className={`mb-4 text-4xl tracking-tight font-extrabold ${textColor}`}
          data-inline-path="title"
        >
          {title}
        </h2>
      )}
      {subtitle &&
        (_useReact ? (
          <motion.p
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 1.0, delay: 0.25 }}
            className={`font-light ${subtextColor} lg:mb-4 sm:text-xl`}
            data-inline-path="subtitle"
          >
            {subtitle}
          </motion.p>
        ) : (
          <p
            className={`font-light ${subtextColor} lg:mb-4 sm:text-xl`}
            data-inline-path="subtitle"
          >
            {subtitle}
          </p>
        ))}
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
  )

  const profilesGrid = (
    <div className="grid gap-8 mb-6 lg:mb-16 md:grid-cols-2">
      {items.map((p) => {
        const teaser = (
          <ProfileTeaser
            key={p.id}
            id={p.id}
            name={p.name}
            role={p.role}
            bio={p.bio}
            image={p.image}
            url={p.url}
          />
        )
        return _useReact ? (
          <motion.div key={p.id} variants={itemVariants}>
            {teaser}
          </motion.div>
        ) : (
          teaser
        )
      })}
    </div>
  )

  if (loading && items.length === 0) {
    return (
      <section
        className={`${bg} py-12 lg:py-16`}
        data-module="profile-list"
        data-inline-path="backgroundColor"
      >
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-screen-sm mx-auto text-center mb-8">
            <h2 className={`mb-2 text-3xl font-extrabold tracking-tight ${textColor}`}>{title}</h2>
            {subtitle && <p className={`text-sm ${subtextColor}`}>{subtitle}</p>}
            <p className={`mt-4 text-xs ${subtextColor} opacity-60`}>Loading profiles…</p>
          </div>
        </div>
      </section>
    )
  }

  if (items.length === 0) {
    return null
  }

  return (
    <section
      className={`${bg} py-12 lg:py-16`}
      data-module="profile-list"
      data-inline-type="select"
      data-inline-path="backgroundColor"
      data-inline-options={JSON.stringify([
        { label: 'Transparent', value: 'bg-transparent' },
        { label: 'Low', value: 'bg-backdrop-low' },
        { label: 'Medium', value: 'bg-backdrop-medium' },
        { label: 'High', value: 'bg-backdrop-high' },
        { label: 'Dark', value: 'bg-neutral-high' },
      ])}
    >
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        {headerContent}
        {_useReact ? (
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-100px' }}
            variants={containerVariants}
          >
            {profilesGrid}
          </motion.div>
        ) : (
          profilesGrid
        )}
      </div>
    </section>
  )
}
