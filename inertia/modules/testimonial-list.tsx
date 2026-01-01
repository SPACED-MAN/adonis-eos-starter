import { useEffect, useState } from 'react'
import { motion, type Variants } from 'framer-motion'
import { useInlineEditor, useInlineValue, useInlineField } from '../components/inline-edit/InlineEditorContext'
import { FontAwesomeIcon } from '../site/lib/icons'
import TestimonialTeaser from '../site/post-types/testimonial-teaser'
import type { MediaObject } from '../utils/useMediaUrl'
import { getSectionStyles } from '../utils/colors'
import { SectionBackground } from '../components/SectionBackground'
import { THEME_OPTIONS } from '#modules/shared_fields'

interface TestimonialListProps {
  title: string
  subtitle?: string | null
  // IDs of Testimonial posts selected via post-reference field; if empty, show all.
  testimonials?: string[] | null
  theme?: string
  backgroundImage?: any
  backgroundTint?: boolean
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
  theme: initialTheme = 'low',
  backgroundImage: initialBackgroundImage,
  backgroundTint: initialBackgroundTint,
  __moduleId,
  _useReact,
}: TestimonialListProps) {
  const [items, setItems] = useState<TestimonialSummary[]>([])
  const [loading, setLoading] = useState(true)
  const { enabled } = useInlineEditor()
  const { value: title, show: showTitle, props: titleProps } = useInlineField(__moduleId, 'title', initialTitle, { label: 'Title' })
  const { value: subtitle, show: showSubtitle, props: subtitleProps } = useInlineField(__moduleId, 'subtitle', initialSubtitle, { label: 'Subtitle' })
  const testimonials = useInlineValue(__moduleId, 'testimonials', initialTestimonials)
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
      {showTitle &&
        (_useReact ? (
        <motion.h2
          initial={{ opacity: 0, y: -20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 1.0 }}
          className={`mb-4 text-3xl md:text-4xl tracking-tight font-extrabold ${textColor}`}
            {...titleProps}
        >
          {title}
        </motion.h2>
      ) : (
        <h2
          className={`mb-4 text-3xl md:text-4xl tracking-tight font-extrabold ${textColor}`}
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
            className={`mb-8 font-light ${subtextColor} sm:text-lg`}
            {...subtitleProps}
          >
            {subtitle}
          </motion.p>
        ) : (
          <p
            className={`mb-8 font-light ${subtextColor} sm:text-lg`}
            {...subtitleProps}
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
            <FontAwesomeIcon icon="pencil" size="xs" />
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
      <section
        className={`${styles.containerClasses} py-8 lg:py-16 relative overflow-hidden`}
        data-module="testimonial-list"
        data-inline-type="background"
        data-inline-path="theme"
        data-inline-label="Background & Theme"
        data-inline-options={JSON.stringify(THEME_OPTIONS)}
      >
        <SectionBackground
          component={styles.backgroundComponent}
          backgroundImage={backgroundImage}
          backgroundTint={backgroundTint}
          isInteractive={_useReact}
        />
        <div className="container mx-auto px-4 lg:px-6 relative z-10">
          <div className="mx-auto max-w-screen-sm text-center mb-8">
            <h2 className={`mb-4 text-3xl md:text-4xl font-extrabold tracking-tight ${textColor}`}>
              {title}
            </h2>
            {subtitle && <p className={`font-light ${subtextColor} sm:text-lg`}>{subtitle}</p>}
            <p className={`mt-4 text-xs ${subtextColor} opacity-60`}>Loading testimonials…</p>
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
      className={`${styles.containerClasses} py-8 lg:py-16 relative overflow-hidden`}
      data-module="testimonial-list"
      data-inline-type="select"
      data-inline-path="theme"
      data-inline-label="Theme"
      data-inline-options={JSON.stringify(THEME_OPTIONS)}
    >
      <SectionBackground
        component={styles.backgroundComponent}
        backgroundImage={backgroundImage}
        backgroundTint={backgroundTint}
        isInteractive={_useReact}
      />
      <div className="container mx-auto px-4 lg:px-6 text-center relative z-10">
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
            className={`inline-flex items-center justify-center py-2.5 px-5 text-sm font-medium ${styles.inverted ? 'bg-backdrop-low text-neutral-high' : 'text-neutral-high bg-backdrop-high'} border border-line-low rounded-lg hover:bg-backdrop-medium focus:outline-none focus:ring-2 focus:ring-standout-high/40`}
          >
            Show more…
          </a>
        </div>
      </div>
    </section>
  )
}
