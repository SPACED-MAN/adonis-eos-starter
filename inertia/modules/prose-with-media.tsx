import { motion, type Variants } from 'framer-motion'
import { FontAwesomeIcon } from '../site/lib/icons'
import type { Button, LinkValue } from './types'
import { useInlineValue, useInlineEditor, useInlineField } from '../components/inline-edit/InlineEditorContext'
import { resolveLink } from '../utils/resolve_link'
import { MediaRenderer } from '../components/MediaRenderer'
import { renderLexicalToHtml } from '../utils/lexical'
import { getSectionStyles } from '../utils/colors'
import { SectionBackground } from '../components/SectionBackground'
import { THEME_OPTIONS, MEDIA_FIT_OPTIONS } from '#modules/shared_fields'

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
  objectFit?: 'cover' | 'contain' | 'fill' | 'none' | 'scale-down'
  primaryCta?: Button | null
  theme?: string
  backgroundImage?: any
  backgroundTint?: boolean
  __moduleId?: string
  _useReact?: boolean
}

export default function ProseWithMedia({
  title,
  body,
  image,
  imagePosition = 'left',
  objectFit: initialObjectFit = 'contain',
  primaryCta,
  theme: initialTheme = 'low',
  backgroundImage: initialBackgroundImage,
  backgroundTint: initialBackgroundTint,
  __moduleId,
  _useReact,
}: ProseWithMediaProps) {
  const { value: titleValue, show: showTitle, props: titleProps } = useInlineField(__moduleId, 'title', title, { label: 'Title' })
  const { value: bodyValue, show: showBody, props: bodyProps } = useInlineField(__moduleId, 'body', body, { type: 'richtext', label: 'Body' })
  const { value: imageValue, show: showImage, props: imageProps } = useInlineField(__moduleId, 'image', image, { type: 'media', label: 'Image' })
  const objectFit = useInlineValue(__moduleId, 'objectFit', initialObjectFit)
  const theme = useInlineValue(__moduleId, 'theme', initialTheme) || initialTheme
  const backgroundImage = useInlineValue(__moduleId, 'backgroundImage', initialBackgroundImage)
  const backgroundTint = useInlineValue(__moduleId, 'backgroundTint', initialBackgroundTint)

  const styles = getSectionStyles(theme)
  const textColor = styles.textColor
  const subtextColor = styles.subtextColor

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

  const imageBlock = showImage ? (
    <div className="w-full">
      <div
        className="w-full overflow-hidden aspect-[4/3] rounded-lg relative"
        data-inline-type="select"
        data-inline-path="objectFit"
        data-inline-label="Media Fit"
        data-inline-options={JSON.stringify(MEDIA_FIT_OPTIONS)}
      >
        <div {...imageProps} className="w-full h-full">
          {imageValue && (
            <MediaRenderer
              image={imageValue}
              alt={(typeof imageValue === 'object' ? imageValue.altText : null) || ''}
              loading="lazy"
              decoding="async"
              objectFit={objectFit}
              playMode={typeof imageValue === 'object' ? imageValue.metadata?.playMode : 'autoplay'}
              className="w-full h-full"
            />
          )}
        </div>
      </div>
    </div>
  ) : null

  const textContent = (
    <div className="mt-8 md:mt-0">
      {showTitle &&
        (_useReact ? (
          <motion.h2
            variants={textVariants}
            className={`mb-4 text-3xl sm:text-4xl font-extrabold tracking-tight ${textColor}`}
            {...titleProps}
          >
            {titleValue}
          </motion.h2>
        ) : (
          <h2
            className={`mb-4 text-3xl sm:text-4xl font-extrabold tracking-tight ${textColor}`}
            {...titleProps}
          >
            {titleValue}
          </h2>
        ))}
      {showBody && (
        <>
          {_useReact ? (
            <motion.div
              variants={textVariants}
              className={`mb-6 prose prose-sm md:prose-base ${styles.proseInvert} ${subtextColor}`}
              suppressHydrationWarning
              {...bodyProps}
              dangerouslySetInnerHTML={{ __html: bodyHtml }}
            />
          ) : (
            <div
              className={`mb-6 prose prose-sm md:prose-base ${styles.proseInvert} ${subtextColor}`}
              suppressHydrationWarning
              {...bodyProps}
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
              className={`inline-flex items-center font-medium rounded-lg text-sm px-5 py-2.5 transition-all active:scale-95 ${styles.inverted
                ? 'bg-backdrop-low text-neutral-high hover:bg-backdrop-low/90'
                : 'text-on-high bg-standout-high hover:bg-standout-high/90'
                } focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-standout-high`}
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
        className={`${styles.containerClasses} py-12 sm:py-16 overflow-hidden relative`}
        data-module="prose-with-media"
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
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 relative z-10">{content}</div>
      </motion.section>
    )
  }

  return (
    <section
      className={`${styles.containerClasses} py-12 sm:py-16 relative overflow-hidden`}
      data-module="prose-with-media"
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
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 relative z-10">{content}</div>
    </section>
  )
}
