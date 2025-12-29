import { motion } from 'framer-motion'
import type { LinkValue } from './types'
import { useInlineValue } from '../components/inline-edit/InlineEditorContext'
import { resolveLink, resolvePostLink } from '../utils/resolve_link'
import { useState, useEffect } from 'react'

interface CalloutButton {
  label?: string
  url?: string | LinkValue
  target?: '_self' | '_blank'
}

interface HeroWithCalloutProps {
  title: string
  subtitle?: string | null
  callouts?: CalloutButton[] | null
  backgroundColor?: string
  __moduleId?: string
  _useReact?: boolean
}

function getLinkTarget(
  url: string | LinkValue | undefined,
  fallbackTarget?: '_self' | '_blank'
): '_self' | '_blank' {
  if (url && typeof url === 'object' && url.kind) {
    return url.target === '_blank' ? '_blank' : '_self'
  }
  return fallbackTarget || '_self'
}

/**
 * CalloutButtons component that handles async resolution of post links
 */
function CalloutButtons({
  callouts,
  _useReact,
  isDarkBg,
}: {
  callouts: CalloutButton[]
  _useReact?: boolean
  isDarkBg?: boolean
}) {
  const [resolvedLinks, setResolvedLinks] = useState<Map<number, string>>(new Map())

  useEffect(() => {
    // Resolve any post links that need async fetching
    const resolveLinks = async () => {
      const newResolved = new Map<number, string>()

      await Promise.all(
        callouts.map(async (callout, index) => {
          if (!callout?.url) return

          // Normalize the URL - handle stringified JSON objects
          let urlValue = callout.url
          if (
            typeof urlValue === 'string' &&
            urlValue.startsWith('{') &&
            urlValue.includes('"kind"')
          ) {
            try {
              urlValue = JSON.parse(urlValue)
            } catch {
              // If parsing fails, treat as regular URL string
            }
          }

          const resolved = resolveLink(urlValue)

          // If we already have a resolved href (from server-resolved URL), use it
          if (resolved.href && typeof resolved.href === 'string') {
            newResolved.set(index, resolved.href)
            return
          }

          // If href is undefined and it's a post reference, fetch it from the API
          if (
            typeof urlValue === 'object' &&
            urlValue !== null &&
            urlValue.kind === 'post' &&
            urlValue.postId
          ) {
            try {
              const asyncResolved = await resolvePostLink(urlValue.postId, urlValue.target)
              if (asyncResolved.href && typeof asyncResolved.href === 'string') {
                newResolved.set(index, asyncResolved.href)
              }
            } catch (error) {
              console.error(`Error resolving post link for postId: ${urlValue.postId}`, error)
            }
          } else if (
            typeof urlValue === 'object' &&
            urlValue !== null &&
            urlValue.kind === 'url' &&
            typeof urlValue.url === 'string'
          ) {
            newResolved.set(index, urlValue.url)
          } else if (typeof urlValue === 'string' && !urlValue.startsWith('{')) {
            newResolved.set(index, urlValue)
          }
        })
      )

      setResolvedLinks(newResolved)
    }

    resolveLinks()
  }, [callouts])

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1,
        delayChildren: 0.4,
      },
    },
  }

  const itemVariants = {
    hidden: { opacity: 0, y: 10, scale: 0.95 },
    visible: {
      opacity: 1,
      y: 0,
      scale: 1,
      transition: { duration: 0.8, ease: 'easeOut' },
    },
  }

  const buttons = callouts.map((callout, index) => {
    const resolved = resolveLink(callout?.url)
    const href = resolved.href || resolvedLinks.get(index)
    const linkTarget = getLinkTarget(callout?.url, callout?.target)

    if (!callout.label || !href || typeof href !== 'string' || href.trim() === '') return null

    const btn = (
      <a
        href={href}
        target={linkTarget}
        rel={linkTarget === '_blank' ? 'noopener noreferrer' : undefined}
        className={`inline-flex justify-center items-center py-3 px-5 text-sm sm:text-base font-medium text-center rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-standout-medium transition-all active:scale-95 ${
          isDarkBg
            ? 'bg-backdrop-low text-neutral-high hover:bg-backdrop-low/90'
            : 'text-on-high bg-standout-medium hover:bg-standout-medium/90'
        }`}
        data-inline-type="object"
        data-inline-path={`callouts.${index}`}
        data-inline-label={`Callout ${index + 1}`}
        data-inline-fields={JSON.stringify([
          { name: 'label', type: 'text', label: 'Label' },
          { name: 'url', type: 'link', label: 'Destination' },
          {
            name: 'target',
            type: 'select',
            label: 'Target',
            options: [
              { label: 'Same tab', value: '_self' },
              { label: 'New tab', value: '_blank' },
            ],
          },
        ])}
      >
        {callout.label}
      </a>
    )

    return _useReact ? (
      <motion.div key={index} variants={itemVariants}>
        {btn}
      </motion.div>
    ) : (
      <div key={index}>{btn}</div>
    )
  })

  if (_useReact) {
    return (
      <motion.div
        variants={containerVariants}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true }}
        className="flex flex-col mb-8 lg:mb-12 space-y-4 sm:flex-row sm:justify-center sm:space-y-0 sm:space-x-4"
      >
        {buttons}
      </motion.div>
    )
  }

  return (
    <div className="flex flex-col mb-8 lg:mb-12 space-y-4 sm:flex-row sm:justify-center sm:space-y-0 sm:space-x-4">
      {buttons}
    </div>
  )
}

export default function HeroWithCallout({
  title: initialTitle,
  subtitle: initialSubtitle,
  callouts: initialCallouts,
  backgroundColor = 'bg-backdrop-low',
  __moduleId,
  _useReact,
}: HeroWithCalloutProps) {
  const title = useInlineValue(__moduleId, 'title', initialTitle)
  const subtitle = useInlineValue(__moduleId, 'subtitle', initialSubtitle)
  const callouts = useInlineValue(__moduleId, 'callouts', initialCallouts)
  const bg = useInlineValue(__moduleId, 'backgroundColor', backgroundColor) || backgroundColor

  const isDarkBg = bg === 'bg-neutral-high' || bg === 'bg-backdrop-high' || bg === 'bg-standout-medium'
  const textColor = isDarkBg ? 'text-on-high' : 'text-neutral-high'
  const subtextColor = isDarkBg ? 'text-on-high/80' : 'text-neutral-medium'

  const content = (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-12 text-center">
      {_useReact ? (
        <motion.h1
          initial={{ opacity: 0, y: -20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
          className={`mb-4 text-4xl font-extrabold tracking-tight leading-tight ${textColor} md:text-5xl lg:text-6xl`}
          data-inline-path="title"
        >
          {title}
        </motion.h1>
      ) : (
        <h1
          className={`mb-4 text-4xl font-extrabold tracking-tight leading-tight ${textColor} md:text-5xl lg:text-6xl`}
          data-inline-path="title"
        >
          {title}
        </h1>
      )}

      {subtitle &&
        (_useReact ? (
          <motion.p
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className={`mb-8 text-lg font-normal ${subtextColor} lg:text-xl sm:px-4`}
            data-inline-path="subtitle"
          >
            {subtitle}
          </motion.p>
        ) : (
          <p
            className={`mb-8 text-lg font-normal ${subtextColor} lg:text-xl sm:px-4`}
            data-inline-path="subtitle"
          >
            {subtitle}
          </p>
        ))}

      {callouts && callouts.length > 0 && (
        <CalloutButtons callouts={callouts} _useReact={_useReact} isDarkBg={isDarkBg} />
      )}
    </div>
  )

  if (_useReact) {
    return (
      <motion.section
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true, margin: '-100px' }}
        transition={{ duration: 0.8 }}
        className={`${bg} py-12 lg:py-16`}
        data-module="hero-with-callout"
      >
        {content}
      </motion.section>
    )
  }

  return (
    <section className={`${bg} py-12 lg:py-16`} data-module="hero-with-callout">
      {content}
    </section>
  )
}
