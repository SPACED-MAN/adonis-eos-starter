import { motion, type Variants } from 'framer-motion'
import type { Button } from './types'
import { useInlineValue, useInlineField } from '../components/inline-edit/InlineEditorContext'
import { MediaRenderer } from '../components/MediaRenderer'
import { getSectionStyles } from '../utils/colors'
import { SectionBackground } from '../components/SectionBackground'
import { SiteLink } from '../site/components/SiteLink'
import { THEME_OPTIONS, MEDIA_FIT_OPTIONS } from '#modules/shared_fields'

interface HeroWithMediaProps {
  title: string
  subtitle?: string
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

export default function HeroWithMedia({
  title,
  subtitle,
  image,
  imagePosition = 'right',
  objectFit: initialObjectFit = 'contain',
  ctas: initialCtas,
  theme: initialTheme = 'low',
  backgroundImage: initialBackgroundImage,
  backgroundTint: initialBackgroundTint,
  __moduleId,
  _useReact,
}: HeroWithMediaProps) {
  const { value: imageValue, show: showImage, props: imageProps } = useInlineField(__moduleId, 'image', image, { type: 'media', label: 'Image' })
  const objectFit = useInlineValue(__moduleId, 'objectFit', initialObjectFit)
  const { value: titleValue, show: showTitle, props: titleProps } = useInlineField(__moduleId, 'title', title, { label: 'Title' })
  const { value: subtitleValue, show: showSubtitle, props: subtitleProps } = useInlineField(__moduleId, 'subtitle', subtitle, { label: 'Subtitle' })
  const ctas = useInlineValue(__moduleId, 'ctas', initialCtas)
  const theme = useInlineValue(__moduleId, 'theme', initialTheme) || initialTheme
  const backgroundImage = useInlineValue(__moduleId, 'backgroundImage', initialBackgroundImage)
  const backgroundTint = useInlineValue(__moduleId, 'backgroundTint', initialBackgroundTint)

  const styles = getSectionStyles(theme)
  const textColor = styles.textColor
  const subtextColor = styles.subtextColor

  const hasCtas = Boolean(ctas && ctas.length > 0)

  const containerVariants: Variants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.2,
      },
    },
  }

  const textVariants: Variants = {
    hidden: { opacity: 0, x: imagePosition === 'left' ? 30 : -30 },
    visible: {
      opacity: 1,
      x: 0,
      transition: { duration: 0.8, ease: 'easeOut' as const },
    },
  }

  const imageVariants: Variants = {
    hidden: { opacity: 0, scale: 0.9, x: imagePosition === 'left' ? -30 : 30 },
    visible: {
      opacity: 1,
      scale: 1,
      x: 0,
      transition: { duration: 1.0, ease: 'easeOut' as const },
    },
  }

  const imageMetadata = typeof imageValue === 'object' ? imageValue?.metadata : null
  const dynamicAspect = imageMetadata?.width && imageMetadata?.height
    ? { aspectRatio: `${imageMetadata.width} / ${imageMetadata.height}` }
    : {}

  const imageBlockContent = (
    <div
      className="w-full max-w-md overflow-hidden relative aspect-4/3"
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
            fetchPriority="high"
            decoding="async"
            size="large"
            objectFit={objectFit}
            playMode={typeof imageValue === 'object' ? imageValue.metadata?.playMode : 'autoplay'}
            className="w-full h-full"
          />
        )}
      </div>
    </div>
  )

  const imageBlock = showImage ? (
    <div className="lg:col-span-5 flex justify-center lg:justify-end">
      {_useReact ? (
        <motion.div variants={imageVariants} className="w-full">
          {imageBlockContent}
        </motion.div>
      ) : (
        imageBlockContent
      )}
    </div>
  ) : null

  const textBlock = (
    <div className="lg:col-span-7 space-y-6">
      {showTitle &&
        (_useReact ? (
          <motion.h1
            variants={textVariants}
            className={`max-w-2xl text-4xl font-extrabold tracking-tight leading-tight sm:text-5xl xl:text-6xl ${textColor}`}
            {...titleProps}
          >
            {titleValue}
          </motion.h1>
        ) : (
          <h1
            className={`max-w-2xl text-4xl font-extrabold tracking-tight leading-tight sm:text-5xl xl:text-6xl ${textColor}`}
            {...titleProps}
          >
            {titleValue}
          </h1>
        ))}

      {showSubtitle &&
        (_useReact ? (
          <motion.p
            variants={textVariants}
            className={`max-w-2xl text-lg lg:text-xl font-light ${subtextColor}`}
            {...subtitleProps}
          >
            {subtitleValue}
          </motion.p>
        ) : (
          <p
            className={`max-w-2xl text-lg lg:text-xl font-light ${subtextColor}`}
            {...subtitleProps}
          >
            {subtitleValue}
          </p>
        ))}

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

  if (_useReact) {
    return (
      <motion.section
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, margin: '-100px' }}
        variants={containerVariants}
        className={`${styles.containerClasses} py-12 lg:py-16 relative overflow-hidden`}
        data-module="hero-with-media"
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
          <div className="grid lg:grid-cols-12 gap-8 items-center">
            {imagePosition === 'left' && imageBlock}
            {textBlock}
            {imagePosition !== 'left' && imageBlock}
          </div>
        </div>
      </motion.section>
    )
  }

  return (
    <section
      className={`${styles.containerClasses} py-12 lg:py-16 relative overflow-hidden`}
      data-module="hero-with-media"
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
        <div className="grid lg:grid-cols-12 gap-8 items-center">
          {imagePosition === 'left' && imageBlock}
          {textBlock}
          {imagePosition !== 'left' && imageBlock}
        </div>
      </div>
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
      : 'bg-standout-high text-on-high',
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
      className={`inline-flex items-center justify-center px-5 py-3 text-base font-medium rounded-lg transition-colors duration-200 ${styleClasses} relative group`}
      data-inline-type="object"
      data-inline-path={inlineObjectPath}
      data-inline-label={inlineObjectLabel}
      data-inline-fields={ctaObjectFields}
    >
      {label}
    </SiteLink>
  )
}
