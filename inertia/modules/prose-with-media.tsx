import { motion, type Variants } from 'framer-motion'
import { FontAwesomeIcon } from '../site/lib/icons'
import type { Button } from './types'
import { useInlineValue, useInlineField } from '../components/inline-edit/InlineEditorContext'
import { MediaRenderer } from '../components/MediaRenderer'
import { renderLexicalToHtml } from '../utils/lexical'
import { getSectionStyles } from '../utils/colors'
import { SectionBackground } from '../components/SectionBackground'
import { SiteLink } from '../site/components/SiteLink'
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
  ctas?: Button[] | null
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
  ctas: initialCtas,
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
  const ctas = useInlineValue(__moduleId, 'ctas', initialCtas)
  const theme = useInlineValue(__moduleId, 'theme', initialTheme) || initialTheme
  const backgroundImage = useInlineValue(__moduleId, 'backgroundImage', initialBackgroundImage)
  const backgroundTint = useInlineValue(__moduleId, 'backgroundTint', initialBackgroundTint)

  const styles = getSectionStyles(theme)
  const textColor = styles.textColor
  const subtextColor = styles.subtextColor

  const hasCtas = Boolean(ctas && ctas.length > 0)
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
        className="w-full overflow-hidden aspect-4/3 rounded-lg relative"
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
      {hasCtas && (
        <div className="flex flex-wrap items-center gap-4">
          {ctas?.map((cta: Button, index: number) => (
            _useReact ? (
              <motion.div key={index} variants={textVariants}>
                <ButtonComponent
                  {...cta}
                  moduleId={__moduleId}
                  inlineObjectPath={`ctas.${index}`}
                  inlineObjectLabel={`Button ${index + 1}`}
                  inverted={styles.inverted}
                />
              </motion.div>
            ) : (
              <ButtonComponent
                key={index}
                {...cta}
                moduleId={__moduleId}
                inlineObjectPath={`ctas.${index}`}
                inlineObjectLabel={`Button ${index + 1}`}
                inverted={styles.inverted}
              />
            )
          ))}
        </div>
      )}
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
        backgroundImage={backgroundImage}
        backgroundTint={backgroundTint}
        isInteractive={_useReact}
      />
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 relative z-10">{content}</div>
    </section>
  )
}

// Define the CTA object schema for inline editing
const ctaObjectFields = JSON.stringify([
  { name: 'label', type: 'text', label: 'Label' },
  { name: 'url', type: 'link', label: 'Destination' },
  {
    name: 'style',
    type: 'select',
    label: 'Style',
    options: [
      { label: 'Primary', value: 'primary' },
      { label: 'Secondary', value: 'secondary' },
      { label: 'Outline', value: 'outline' },
    ],
  },
])

interface ButtonComponentProps extends Button {
  moduleId?: string
  inlineObjectPath?: string
  inlineObjectLabel?: string
  inverted?: boolean
}

function ButtonComponent({
  label: initialLabel,
  url: initialUrl,
  style: initialStyle = 'primary',
  target,
  moduleId,
  inlineObjectPath,
  inlineObjectLabel,
  inverted,
}: ButtonComponentProps) {
  // Use inline values so edits reflect immediately
  const obj = useInlineValue(moduleId, inlineObjectPath || '', {
    label: initialLabel,
    url: initialUrl,
    style: initialStyle,
  })
  const label = obj?.label ?? initialLabel
  const url = obj?.url ?? initialUrl
  const style: 'primary' | 'secondary' | 'outline' = obj?.style ?? initialStyle

  const styleMap = {
    primary: inverted
      ? 'bg-backdrop-low text-neutral-high hover:bg-backdrop-low/90'
      : 'bg-standout-high text-on-high hover:bg-standout-high/90',
    secondary: inverted
      ? 'bg-on-high/10 text-on-high hover:bg-on-high/20'
      : 'bg-backdrop-medium hover:bg-backdrop-high text-neutral-high',
    outline: inverted
      ? 'border border-on-high text-on-high hover:bg-on-high/10'
      : 'border border-line-low hover:bg-backdrop-medium text-neutral-high',
  }
  const styleClasses = styleMap[style] || styleMap.primary

  return (
    <SiteLink
      url={url}
      explicitTarget={target}
      className={`inline-flex items-center justify-center px-5 py-2.5 text-sm font-medium rounded-lg transition-all active:scale-95 ${styleClasses} focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-standout-high relative group`}
      data-inline-type="object"
      data-inline-path={inlineObjectPath}
      data-inline-label={inlineObjectLabel}
      data-inline-fields={ctaObjectFields}
    >
      {label}
      <FontAwesomeIcon icon="arrow-right" className="ml-2 -mr-1 text-sm" />
    </SiteLink>
  )
}
