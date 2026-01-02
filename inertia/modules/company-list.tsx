import { useEffect, useState } from 'react'
import { motion, type Variants } from 'framer-motion'
import { useInlineEditor, useInlineValue, useInlineField } from '../components/inline-edit/InlineEditorContext'
import { FontAwesomeIcon } from '../site/lib/icons'
import CompanyTeaser from '../site/post-types/company-teaser'
import type { MediaObject } from '../utils/useMediaUrl'
import { getSectionStyles } from '../utils/colors'
import { SectionBackground } from '../components/SectionBackground'
import { THEME_OPTIONS } from '#modules/shared_fields'

interface CompanyListProps {
  title: string
  subtitle?: string | null
  // IDs of Company posts selected via post-reference field; if empty, show all.
  companies?: string[] | null
  theme?: string
  backgroundImage?: any
  backgroundTint?: boolean
  __moduleId?: string
  _useReact?: boolean
}

type CompanySummary = {
  id: string
  title: string
  slug: string
  url: string
  image?: MediaObject | null
  customFields?: Record<string, any>
}

export default function CompanyList({
  title: initialTitle,
  subtitle: initialSubtitle,
  companies: initialCompanies,
  theme: initialTheme = 'low',
  backgroundImage: initialBackgroundImage,
  backgroundTint: initialBackgroundTint,
  __moduleId,
  _useReact,
}: CompanyListProps) {
  const [items, setItems] = useState<CompanySummary[]>([])
  const [loading, setLoading] = useState(true)
  const { enabled } = useInlineEditor()
  const { value: title, show: showTitle, props: titleProps } = useInlineField(__moduleId, 'title', initialTitle, { label: 'Title' })
  const { value: subtitle, show: showSubtitle, props: subtitleProps } = useInlineField(__moduleId, 'subtitle', initialSubtitle, { label: 'Subtitle' })
  const companies = useInlineValue(__moduleId, 'companies', initialCompanies)
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
          params.set('limit', '50')
          const ids = Array.isArray(companies) ? companies.filter(Boolean) : []
          if (ids.length > 0) {
            params.set('ids', ids.join(','))
          }
          const res = await fetch(`/api/companies?${params.toString()}`, {
            credentials: 'same-origin',
            headers: { Accept: 'application/json' },
          })
          if (!res.ok) {
            throw new Error('Failed to load companies')
          }
          const j = await res.json().catch(() => null)
          const list: any[] = Array.isArray(j?.data) ? j.data : []
          if (cancelled) return

          const mapped: CompanySummary[] = list.map((p: any) => {
            return {
              id: String(p.id),
              title: String(p.title || 'Company'),
              slug: String(p.slug),
              url: String(p.url),
              image: p.image ?? null,
              customFields: p.customFields || {},
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
  }, [JSON.stringify(companies ?? [])])

  const containerVariants: Variants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.05,
      },
    },
  }

  const itemVariants: Variants = {
    hidden: { opacity: 0, scale: 0.7, y: 10 },
    visible: {
      opacity: 1,
      scale: 1,
      y: 0,
      transition: { duration: 0.6, ease: 'easeOut' },
    },
  }

  const headerContent = (
    <>
      {showTitle &&
        (_useReact ? (
          <motion.h2
            initial={{ opacity: 0, y: -20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8 }}
            className={`mb-8 lg:mb-16 text-3xl md:text-4xl font-extrabold tracking-tight leading-tight text-center ${textColor}`}
            {...titleProps}
          >
            {title}
          </motion.h2>
        ) : (
          <h2
            className={`mb-8 lg:mb-16 text-3xl md:text-4xl font-extrabold tracking-tight leading-tight text-center ${textColor}`}
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
            transition={{ duration: 0.8, delay: 0.2 }}
            className={`max-w-2xl mx-auto mb-10 text-center font-light ${subtextColor} sm:text-xl`}
            {...subtitleProps}
          >
            {subtitle}
          </motion.p>
        ) : (
          <p
            className={`max-w-2xl mx-auto mb-10 text-center font-light ${subtextColor} sm:text-xl`}
            {...subtitleProps}
          >
            {subtitle}
          </p>
        ))}
      {enabled && (
        <div className="mb-6 text-center">
          <button
            type="button"
            className="inline-flex items-center gap-2 text-xs text-neutral-low underline underline-offset-2"
            data-inline-type="post-reference"
            data-inline-path="companies"
            data-inline-multi="true"
            data-inline-post-type="company"
            aria-label="Edit companies"
          >
            <FontAwesomeIcon icon="pencil" size="xs" />
            Edit companies ({items.length})
          </button>
        </div>
      )}
    </>
  )

  const gridContent = (
    <div
      className={`flex flex-wrap justify-center gap-8 ${subtextColor} sm:gap-12`}
    >
      {items.map((c) => {
        const teaser = (
          <CompanyTeaser
            key={c.id}
            id={c.id}
            title={c.title}
            image={c.image}
            url={c.url}
            customFields={c.customFields}
          />
        )
        return _useReact ? (
          <motion.div
            key={c.id}
            variants={itemVariants}
            className="flex justify-center items-center w-40 sm:w-48"
          >
            {teaser}
          </motion.div>
        ) : (
          <div key={c.id} className="flex justify-center items-center w-40 sm:w-48">
            {teaser}
          </div>
        )
      })}
    </div>
  )

  if (loading && items.length === 0) {
    return (
      <section
        className={`${styles.containerClasses} py-8 lg:py-16 relative overflow-hidden`}
        data-module="company-list"
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
        <div className="container mx-auto px-4 lg:px-6 relative z-10">
          <h2
            className={`mb-4 lg:mb-8 text-3xl md:text-4xl font-extrabold tracking-tight text-center ${textColor}`}
          >
            {title}
          </h2>
          {subtitle && (
            <p className={`max-w-2xl mx-auto text-center font-light ${subtextColor} sm:text-xl`}>
              {subtitle}
            </p>
          )}
          <p className="mt-6 text-center text-xs text-neutral-low">Loading companies…</p>
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
      data-module="company-list"
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
      <div className="container mx-auto px-4 lg:px-6 relative z-10">
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
