import { usePage } from '@inertiajs/react'
import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { useInlineEditor, useInlineValue, useInlineField } from '../components/inline-edit/InlineEditorContext'
import { FontAwesomeIcon } from '../site/lib/icons'
import BlogTeaser from '../site/post-types/blog-teaser'
import type { MediaObject } from '../utils/useMediaUrl'
import { getSectionStyles } from '../utils/colors'
import { SectionBackground } from '../components/SectionBackground'
import { THEME_OPTIONS } from '#modules/shared_fields'

interface BlogListProps {
  title: string
  subtitle?: string | null
  // IDs of Blog posts selected via post-reference field; if empty, show all.
  posts?: string[] | null
  theme?: string
  backgroundImage?: any
  backgroundTint?: boolean
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
  theme: initialTheme = 'low',
  backgroundImage: initialBackgroundImage,
  backgroundTint: initialBackgroundTint,
  __moduleId,
  _useReact,
}: BlogListProps) {
  const page = usePage()
  const currentUser = (page.props as any)?.currentUser
  const isAuthenticated = !!currentUser && ['admin', 'editor_admin', 'editor', 'translator'].includes(String(currentUser.role || ''))

  const [items, setItems] = useState<BlogSummary[]>([])
  const [loading, setLoading] = useState(true)
  const { enabled } = useInlineEditor() || {}
  const { value: title, show: showTitle, props: titleProps } = useInlineField(__moduleId, 'title', initialTitle, { label: 'Title' })
  const { value: subtitle, show: showSubtitle, props: subtitleProps } = useInlineField(__moduleId, 'subtitle', initialSubtitle, { label: 'Subtitle' })
  const posts = useInlineValue(__moduleId, 'posts', initialPosts)
  const theme = useInlineValue(__moduleId, 'theme', initialTheme) || initialTheme
  const backgroundImage = useInlineValue(__moduleId, 'backgroundImage', initialBackgroundImage)
  const backgroundTint = useInlineValue(__moduleId, 'backgroundTint', initialBackgroundTint)

  const styles = getSectionStyles(theme)
  const textColor = styles.textColor
  const subtextColor = styles.subtextColor

  useEffect(() => {
    let cancelled = false
      ; (async () => {
        try {
          const params = new URLSearchParams()
          if (!enabled) {
            params.set('status', 'published')
          }
          params.set('limit', '50') // Increased limit for better editor selection
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
      {showTitle &&
        (_useReact ? (
          <motion.h2
            initial={{ opacity: 0, y: -20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 1.0 }}
            className={`mb-4 text-3xl lg:text-4xl tracking-tight font-extrabold ${textColor}`}
            {...titleProps}
          >
            {title}
          </motion.h2>
        ) : (
          <h2
            className={`mb-4 text-3xl lg:text-4xl tracking-tight font-extrabold ${textColor}`}
            {...titleProps}
          >
            {title}
          </h2>
        ))}
      {showSubtitle &&
        (_useReact ? (
          <motion.p
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 1.0, delay: 0.25 }}
            className={`font-light ${subtextColor} sm:text-xl`}
            {...subtitleProps}
          >
            {subtitle}
          </motion.p>
        ) : (
          <p className={`font-light ${subtextColor} sm:text-xl`} {...subtitleProps}>
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
            <FontAwesomeIcon icon="pencil" size="xs" />
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
        className={`${styles.containerClasses} py-12 lg:py-16 relative overflow-hidden`}
        data-module="blog-list"
        data-inline-type="background"
        data-inline-path="theme"
        data-inline-label="Background & Theme"
        data-inline-options={JSON.stringify(THEME_OPTIONS)}
      >
        <SectionBackground
          backgroundImage={backgroundImage}
          backgroundTint={backgroundTint}
          isInteractive={_useReact}
        />
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
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
    if (!enabled && !isAuthenticated) return null

    return (
      <section
        className={`${styles.containerClasses} py-12 lg:py-16 relative overflow-hidden`}
        data-module="blog-list"
        data-inline-type="select"
        data-inline-path="theme"
        data-inline-label="Theme"
        data-inline-options={JSON.stringify(THEME_OPTIONS)}
      >
        <SectionBackground
          backgroundImage={backgroundImage}
          backgroundTint={backgroundTint}
          isInteractive={_useReact}
        />
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          {headerContent}
          <div className="text-center py-12 border-2 border-dashed border-line-medium rounded-2xl bg-backdrop-medium/20">
            <p className={`${subtextColor} opacity-60`}>
              No blog posts found.{' '}
              {posts?.length
                ? 'Try selecting different posts.'
                : 'Publish some blog posts or select them in the editor.'}
            </p>
          </div>
        </div>
      </section>
    )
  }

  return (
    <section
      className={`${styles.containerClasses} py-12 lg:py-16 relative overflow-hidden`}
      data-module="blog-list"
      data-inline-type="select"
      data-inline-path="theme"
      data-inline-label="Theme"
      data-inline-options={JSON.stringify(THEME_OPTIONS)}
    >
      <SectionBackground
        backgroundImage={backgroundImage}
        backgroundTint={backgroundTint}
        isInteractive={_useReact}
      />
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
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
