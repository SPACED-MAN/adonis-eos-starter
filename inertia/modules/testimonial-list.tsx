import { useEffect, useState } from 'react'
import { motion, type Variants } from 'framer-motion'
import { useInlineEditor, useInlineValue } from '../components/inline-edit/InlineEditorContext'
import { FontAwesomeIcon } from '../site/lib/icons'
import TestimonialTeaser from '../site/post-types/testimonial-teaser'
import type { MediaObject } from '../utils/useMediaUrl'

interface TestimonialListProps {
  title: string
  subtitle?: string | null
  // IDs of Testimonial posts selected via post-reference field; if empty, show all.
  testimonials?: string[] | null
  __moduleId?: string
  _useReact?: boolean
}

type TestimonialSummary = {
  id: string
  authorName: string
  authorTitle?: string | null
  quote?: string | null
  image?: MediaObject | null
}

export default function TestimonialList({
  title: initialTitle,
  subtitle: initialSubtitle,
  testimonials: initialTestimonials,
  __moduleId,
  _useReact,
}: TestimonialListProps) {
  const [items, setItems] = useState<TestimonialSummary[]>([])
  const [loading, setLoading] = useState(true)
  const { enabled } = useInlineEditor()
  const title = useInlineValue(__moduleId, 'title', initialTitle)
  const subtitle = useInlineValue(__moduleId, 'subtitle', initialSubtitle)
  const testimonials = useInlineValue(__moduleId, 'testimonials', initialTestimonials)

  useEffect(() => {
    let cancelled = false
      ; (async () => {
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

          const mapped: TestimonialSummary[] = list.map((t: any) => {
            return {
              id: String(t.id),
              authorName: String(t.authorName || 'Anonymous'),
              authorTitle: t.authorTitle ?? null,
              quote: t.quote ?? null,
              image: t.image ?? null,
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
  }, [JSON.stringify(testimonials ?? [])])

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
    hidden: { opacity: 0, y: 30 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 1.0, ease: 'easeOut' },
    },
  }

  const headerContent = (
    <div className="mx-auto max-w-screen-sm mb-8 lg:mb-12">
      {_useReact ? (
        <motion.h2
          initial={{ opacity: 0, y: -20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 1.0 }}
          className="mb-4 text-3xl md:text-4xl tracking-tight font-extrabold text-neutral-high"
          data-inline-path="title"
        >
          {title}
        </motion.h2>
      ) : (
        <h2
          className="mb-4 text-3xl md:text-4xl tracking-tight font-extrabold text-neutral-high"
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
            className="mb-8 font-light text-neutral-medium sm:text-lg"
            data-inline-path="subtitle"
          >
            {subtitle}
          </motion.p>
        ) : (
          <p
            className="mb-8 font-light text-neutral-medium sm:text-lg"
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
            data-inline-path="testimonials"
            data-inline-multi="true"
            data-inline-post-type="testimonial"
            aria-label="Edit testimonials"
          >
            <FontAwesomeIcon icon="pencil" className="w-3 h-3" />
            Edit testimonials ({items.length})
          </button>
        </div>
      )}
    </div>
  )

  const gridContent = (
    <div className="grid gap-6 mb-8 lg:mb-12 lg:grid-cols-2">
      {items.map((t) => {
        const teaser = (
          <TestimonialTeaser
            key={t.id}
            id={t.id}
            quote={t.quote}
            authorName={t.authorName}
            authorTitle={t.authorTitle}
            image={t.image}
          />
        )
        return _useReact ? (
          <motion.div key={t.id} variants={itemVariants}>
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
      <section className="bg-backdrop-low py-8 lg:py-16" data-module="testimonial-list">
        <div className="container mx-auto px-4 lg:px-6">
          <div className="mx-auto max-w-screen-sm text-center mb-8">
            <h2 className="mb-4 text-3xl md:text-4xl font-extrabold tracking-tight text-neutral-high">
              {title}
            </h2>
            {subtitle && <p className="font-light text-neutral-medium sm:text-lg">{subtitle}</p>}
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
        {headerContent}

        {_useReact ? (
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-100px' }}
            variants={containerVariants}
          >
            {gridContent}
          </motion.div>
        ) : (
          gridContent
        )}

        <div className="text-center">
          <a
            href="#"
            className="inline-flex items-center justify-center py-2.5 px-5 text-sm font-medium text-neutral-high bg-backdrop-high border border-line-low rounded-lg hover:bg-backdrop-medium focus:outline-none focus:ring-2 focus:ring-standout-medium/40"
          >
            Show more…
          </a>
        </div>
      </div>
    </section>
  )
}
