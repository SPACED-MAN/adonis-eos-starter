import { motion, type Variants } from 'framer-motion'
import { FontAwesomeIcon } from '../site/lib/icons'
import type { Button, LinkValue } from './types'
import { useInlineValue } from '../components/inline-edit/InlineEditorContext'
import { resolveLink } from '../utils/resolve_link'
import { MediaRenderer } from '../components/MediaRenderer'

import { renderLexicalToHtml } from '../utils/lexical'

interface LexicalJSON {
  root: {
    type: string
    children: any[]
  }
}

interface ProseWithMediaProps {
  title: string
  body?: LexicalJSON | null
  image?: {
    id: string
    url: string
    mimeType?: string
    altText?: string
    metadata?: any
  } | null // media object
  imagePosition?: 'left' | 'right'
  primaryCta?: Button | null
  backgroundColor?: string
  __moduleId?: string
  _useReact?: boolean
}

export default function ProseWithMedia({
  title,
  body,
  image,
  imagePosition = 'left',
  primaryCta,
  backgroundColor = 'bg-backdrop-low',
  __moduleId,
  _useReact,
}: ProseWithMediaProps) {
  const titleValue = useInlineValue(__moduleId, 'title', title)
  const bodyValue = useInlineValue(__moduleId, 'body', body)
  const imageValue = useInlineValue(__moduleId, 'image', image)
  const bg = useInlineValue(__moduleId, 'backgroundColor', backgroundColor) || backgroundColor

  const isDarkBg = bg === 'bg-neutral-high' || bg === 'bg-backdrop-high' || bg === 'bg-standout-low'
  const textColor = isDarkBg ? 'text-on-standout' : 'text-neutral-high'
  const subtextColor = isDarkBg ? 'text-on-standout/80' : 'text-neutral-medium'

  function resolveButtonHref(url: string | LinkValue): string | undefined {
    return resolveLink(url).href
  }

  const hasCta = Boolean(primaryCta && primaryCta.label && primaryCta.url)
  const bodyHtml = renderLexicalToHtml(bodyValue)

  const containerVariants: Variants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.25,
      },
    },
  }

  const textVariants: Variants = {
    hidden: { opacity: 0, x: imagePosition === 'left' ? 30 : -30 },
    visible: {
      opacity: 1,
      x: 0,
      transition: { duration: 1.0, ease: 'easeOut' },
    },
  }

  const imageVariants: Variants = {
    hidden: { opacity: 0, scale: 0.95, x: imagePosition === 'left' ? -30 : 30 },
    visible: {
      opacity: 1,
      scale: 1,
      x: 0,
      transition: { duration: 1.0, ease: 'easeOut' },
    },
  }

  const imageBlock = imageValue ? (
    <div className="w-full">
      <div
        className="w-full overflow-hidden aspect-[4/3]"
        data-inline-type="media"
        data-inline-path="image"
      >
        <MediaRenderer
          image={imageValue}
          alt={(typeof imageValue === 'object' ? imageValue.altText : null) || ''}
          loading="lazy"
          decoding="async"
          playMode={typeof imageValue === 'object' ? imageValue.metadata?.playMode : 'autoplay'}
        />
      </div>
    </div>
  ) : null

  const textContent = (
    <div className="mt-8 md:mt-0">
      {_useReact ? (
        <motion.h2
          variants={textVariants}
          className={`mb-4 text-3xl sm:text-4xl font-extrabold tracking-tight ${textColor}`}
          data-inline-path="title"
        >
          {titleValue}
        </motion.h2>
      ) : (
        <h2
          className={`mb-4 text-3xl sm:text-4xl font-extrabold tracking-tight ${textColor}`}
          data-inline-path="title"
        >
          {titleValue}
        </h2>
      )}
      {bodyValue && (
        <>
          {_useReact ? (
            <motion.div
              variants={textVariants}
              className={`mb-6 prose prose-sm md:prose-base ${isDarkBg ? 'prose-invert' : ''} ${subtextColor}`}
              suppressHydrationWarning
              data-inline-type="richtext"
              data-inline-path="body"
              data-inline-label="Body"
              dangerouslySetInnerHTML={{ __html: bodyHtml }}
            />
          ) : (
            <div
              className={`mb-6 prose prose-sm md:prose-base ${isDarkBg ? 'prose-invert' : ''} ${subtextColor}`}
              suppressHydrationWarning
              data-inline-type="richtext"
              data-inline-path="body"
              data-inline-label="Body"
              dangerouslySetInnerHTML={{ __html: bodyHtml }}
            />
          )}
        </>
      )}
      {hasCta &&
        primaryCta &&
        primaryCta.label &&
        primaryCta.url &&
        (() => {
          const href = resolveButtonHref(primaryCta.url)
          if (!href) return null
          const linkTarget =
            typeof primaryCta.url === 'object' && primaryCta.url && primaryCta.url.kind
              ? primaryCta.url.target === '_blank'
                ? '_blank'
                : '_self'
              : primaryCta.target || '_self'

          const btn = (
            <a
              href={href}
              target={linkTarget}
              rel={linkTarget === '_blank' ? 'noopener noreferrer' : undefined}
              className={`inline-flex items-center font-medium rounded-lg text-sm px-5 py-2.5 transition-all active:scale-95 ${isDarkBg
                ? 'bg-backdrop-low text-neutral-high hover:bg-backdrop-low/90'
                : 'text-on-standout bg-standout-medium hover:bg-standout-medium/90'
                } focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-standout-medium`}
            >
              {primaryCta.label}
              <FontAwesomeIcon icon="arrow-right" className="ml-2 -mr-1 text-sm" />
            </a>
          )

          return _useReact ? <motion.div variants={textVariants}>{btn}</motion.div> : btn
        })()}
    </div>
  )

  const content = (
    <div className="md:grid md:grid-cols-2 md:gap-8 xl:gap-16 items-center">
      {imagePosition === 'left' && (
        <>
          {_useReact ? <motion.div variants={imageVariants}>{imageBlock}</motion.div> : imageBlock}
        </>
      )}

      {textContent}

      {imagePosition !== 'left' && (
        <>
          {_useReact ? <motion.div variants={imageVariants}>{imageBlock}</motion.div> : imageBlock}
        </>
      )}
    </div>
  )

  if (_useReact) {
    return (
      <motion.section
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, margin: '-100px' }}
        variants={containerVariants}
        className={`${bg} py-12 sm:py-16 overflow-hidden`}
        data-module="prose-with-media"
      >
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">{content}</div>
      </motion.section>
    )
  }

  return (
    <section className={`${bg} py-12 sm:py-16`} data-module="prose-with-media">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">{content}</div>
    </section>
  )
}
