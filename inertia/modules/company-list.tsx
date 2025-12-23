import { useEffect, useState } from 'react'
import { motion, type Variants } from 'framer-motion'
import { useInlineEditor, useInlineValue } from '../components/inline-edit/InlineEditorContext'
import { FontAwesomeIcon } from '../site/lib/icons'
import CompanyTeaser from '../site/post-types/company-teaser'
import type { MediaObject } from '../utils/useMediaUrl'

interface CompanyListProps {
  title: string
  subtitle?: string | null
  // IDs of Company posts selected via post-reference field; if empty, show all.
  companies?: string[] | null
  __moduleId?: string
  _useReact?: boolean
}

type CompanySummary = {
  id: string
  title: string
  slug: string
  image?: MediaObject | null
  customFields?: Record<string, any>
}

export default function CompanyList({
  title: initialTitle,
  subtitle: initialSubtitle,
  companies: initialCompanies,
  __moduleId,
  _useReact,
}: CompanyListProps) {
  const [items, setItems] = useState<CompanySummary[]>([])
  const [loading, setLoading] = useState(true)
  const { enabled } = useInlineEditor()
  const title = useInlineValue(__moduleId, 'title', initialTitle)
  const subtitle = useInlineValue(__moduleId, 'subtitle', initialSubtitle)
  const companies = useInlineValue(__moduleId, 'companies', initialCompanies)

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
      {_useReact ? (
        <motion.h2
          initial={{ opacity: 0, y: -20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8 }}
          className="mb-8 lg:mb-16 text-3xl md:text-4xl font-extrabold tracking-tight leading-tight text-center text-neutral-high"
          data-inline-path="title"
        >
          {title}
        </motion.h2>
      ) : (
        <h2
          className="mb-8 lg:mb-16 text-3xl md:text-4xl font-extrabold tracking-tight leading-tight text-center text-neutral-high"
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
            transition={{ duration: 0.8, delay: 0.2 }}
            className="max-w-2xl mx-auto mb-10 text-center font-light text-neutral-medium sm:text-xl"
            data-inline-path="subtitle"
          >
            {subtitle}
          </motion.p>
        ) : (
          <p
            className="max-w-2xl mx-auto mb-10 text-center font-light text-neutral-medium sm:text-xl"
            data-inline-path="subtitle"
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
            <FontAwesomeIcon icon="pencil" className="w-3 h-3" />
            Edit companies ({items.length})
          </button>
        </div>
      )}
    </>
  )

  const gridContent = (
    <div className="grid grid-cols-2 gap-8 text-neutral-medium sm:gap-12 md:grid-cols-3 lg:grid-cols-6">
      {items.map((c) => {
        const teaser = (
          <CompanyTeaser
            key={c.id}
            id={c.id}
            title={c.title}
            image={c.image}
            url={`/posts/${encodeURIComponent(c.slug)}`}
            customFields={c.customFields}
          />
        )
        return _useReact ? (
          <motion.div key={c.id} variants={itemVariants} className="flex justify-center items-center">
            {teaser}
          </motion.div>
        ) : (
          <div key={c.id} className="flex justify-center items-center">
            {teaser}
          </div>
        )
      })}
    </div>
  )

  if (loading && items.length === 0) {
    return (
      <section className="bg-backdrop-low py-8 lg:py-16" data-module="company-list">
        <div className="container mx-auto px-4 lg:px-6">
          <h2 className="mb-4 lg:mb-8 text-3xl md:text-4xl font-extrabold tracking-tight text-center text-neutral-high">
            {title}
          </h2>
          {subtitle && (
            <p className="max-w-2xl mx-auto text-center font-light text-neutral-medium sm:text-xl">
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
    <section className="bg-backdrop-low py-8 lg:py-16" data-module="company-list">
      <div className="container mx-auto px-4 lg:px-6">
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
