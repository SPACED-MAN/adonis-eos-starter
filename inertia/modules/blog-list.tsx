import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { useInlineEditor, useInlineValue } from '../components/inline-edit/InlineEditorContext'
import { FontAwesomeIcon } from '../site/lib/icons'
import BlogTeaser from '../site/post-types/blog-teaser'
import type { MediaObject } from '../utils/useMediaUrl'

interface BlogListProps {
  title: string
  subtitle?: string | null
  // IDs of Blog posts selected via post-reference field; if empty, show all.
  posts?: string[] | null
  backgroundColor?: string
  __moduleId?: string
  _useReact?: boolean
}

type BlogSummary = {
  id: string
  title: string
  slug: string
  url: string
  excerpt?: string | null
  updatedAt?: string | null
  image?: MediaObject | null
}

export default function BlogList({
  title: initialTitle,
  subtitle: initialSubtitle,
  posts: initialPosts,
  backgroundColor = 'bg-backdrop-low',
  __moduleId,
  _useReact,
}: BlogListProps) {
  const [items, setItems] = useState<BlogSummary[]>([])
  const [loading, setLoading] = useState(true)
  const { enabled } = useInlineEditor()
  const title = useInlineValue(__moduleId, 'title', initialTitle)
  const subtitle = useInlineValue(__moduleId, 'subtitle', initialSubtitle)
  const posts = useInlineValue(__moduleId, 'posts', initialPosts)
  const bg = useInlineValue(__moduleId, 'backgroundColor', backgroundColor) || backgroundColor

  const isDarkBg = bg === 'bg-neutral-high'
  const textColor = isDarkBg ? 'text-backdrop-low' : 'text-neutral-high'
  const subtextColor = isDarkBg ? 'text-backdrop-low/80' : 'text-neutral-medium'

  useEffect(() => {
    let cancelled = false
    ;(async () => {
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
          url: String(p.url),
          excerpt: (p as any).excerpt ?? null,
          updatedAt: (p as any).updatedAt ?? null,
          image: p.image ?? null,
        }))

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

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.12,
      },
    },
  }

  const itemVariants = {
    hidden: { opacity: 0, y: 30 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 1.0, ease: 'easeOut' as const },
    },
  }

  const headerContent = (
    <div className="mx-auto max-w-screen-sm text-center mb-8 lg:mb-16">
      {_useReact ? (
        <motion.h2
          initial={{ opacity: 0, y: -20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 1.0 }}
          className={`mb-4 text-3xl lg:text-4xl tracking-tight font-extrabold ${textColor}`}
          data-inline-path="title"
        >
          {title}
        </motion.h2>
      ) : (
        <h2
          className={`mb-4 text-3xl lg:text-4xl tracking-tight font-extrabold ${textColor}`}
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
            className={`font-light ${subtextColor} sm:text-xl`}
            data-inline-path="subtitle"
          >
            {subtitle}
          </motion.p>
        ) : (
          <p className={`font-light ${subtextColor} sm:text-xl`} data-inline-path="subtitle">
            {subtitle}
          </p>
        ))}
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
  )

  const gridContent = (
    <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
      {items.map((p) => {
        const teaser = (
          <BlogTeaser
            key={p.id}
            id={p.id}
            title={p.title}
            excerpt={p.excerpt}
            updatedAt={p.updatedAt}
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
        data-module="blog-list"
        data-inline-path="backgroundColor"
      >
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-screen-sm mx-auto text-center mb-8">
            <h2 className={`mb-2 text-3xl lg:text-4xl font-extrabold tracking-tight ${textColor}`}>
              {title}
            </h2>
            {subtitle && <p className={`text-sm ${subtextColor}`}>{subtitle}</p>}
            <p className={`mt-4 text-xs ${subtextColor} opacity-60`}>Loading blog posts…</p>
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
      data-module="blog-list"
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
            viewport={{ once: true, margin: '-50px' }}
            variants={containerVariants}
          >
            {gridContent}
          </motion.div>
        ) : (
          gridContent
        )}
      </div>
    </section>
  )
}
