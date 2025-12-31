import { motion, type Variants } from 'framer-motion'
import type { Button, LinkValue } from './types'
import { useInlineValue, useInlineEditor, useInlineField } from '../components/inline-edit/InlineEditorContext'
import { resolveLink } from '../utils/resolve_link'
import { MediaRenderer } from '../components/MediaRenderer'

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
  primaryCta?: Button | null
  secondaryCta?: Button | null
  backgroundColor?: string
  __moduleId?: string
  _useReact?: boolean
}

export function resolveHrefAndTarget(
  url: string | LinkValue,
  explicitTarget?: '_self' | '_blank'
): { href?: string; target: '_self' | '_blank' } {
  return resolveLink(url, explicitTarget)
}

export default function HeroWithMedia({
  title,
  subtitle,
  image,
  imagePosition = 'right',
  primaryCta,
  secondaryCta,
  backgroundColor = 'bg-backdrop-low',
  __moduleId,
  _useReact,
}: HeroWithMediaProps) {
  const { value: imageValue, enabled, show: showImage, props: imageProps } = useInlineField(__moduleId, 'image', image, { type: 'media', label: 'Image' })
  const { value: titleValue, show: showTitle, props: titleProps } = useInlineField(__moduleId, 'title', title, { label: 'Title' })
  const { value: subtitleValue, show: showSubtitle, props: subtitleProps } = useInlineField(__moduleId, 'subtitle', subtitle, { label: 'Subtitle' })
  const bg = useInlineValue(__moduleId, 'backgroundColor', backgroundColor) || backgroundColor

  const isDarkBg = bg === 'bg-neutral-high' || bg === 'bg-backdrop-high' || bg === 'bg-standout-medium'
  const textColor = isDarkBg ? 'text-on-high' : 'text-neutral-high'
  const subtextColor = isDarkBg ? 'text-on-high/80' : 'text-neutral-medium'

  const hasCtas = Boolean(primaryCta || secondaryCta)

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
      transition: { duration: 0.8, ease: 'easeOut' },
    },
  }

  const imageVariants: Variants = {
    hidden: { opacity: 0, scale: 0.9, x: imagePosition === 'left' ? -30 : 30 },
    visible: {
      opacity: 1,
      scale: 1,
      x: 0,
      transition: { duration: 1.0, ease: 'easeOut' },
    },
  }

  const imageBlockContent = (
    <div
      className="w-full max-w-md overflow-hidden relative aspect-[4/3]"
      {...imageProps}
    >
      {imageValue && (
        <MediaRenderer
          image={imageValue}
          alt={(typeof imageValue === 'object' ? imageValue.altText : null) || ''}
          fetchPriority="high"
          decoding="async"
          objectFit="contain"
          playMode={typeof imageValue === 'object' ? imageValue.metadata?.playMode : 'autoplay'}
        />
      )}
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
          {_useReact ? (
            <>
              {primaryCta && (
                <motion.div variants={textVariants}>
                  <ButtonComponent
                    {...primaryCta}
                    moduleId={__moduleId}
                    inlineObjectPath="primaryCta"
                    inlineObjectLabel="Primary CTA"
                    isDarkBg={isDarkBg}
                  />
                </motion.div>
              )}
              {secondaryCta && (
                <motion.div variants={textVariants}>
                  <ButtonComponent
                    {...secondaryCta}
                    moduleId={__moduleId}
                    inlineObjectPath="secondaryCta"
                    inlineObjectLabel="Secondary CTA"
                    isDarkBg={isDarkBg}
                  />
                </motion.div>
              )}
            </>
          ) : (
            <>
              {primaryCta && (
                <ButtonComponent
                  {...primaryCta}
                  moduleId={__moduleId}
                  inlineObjectPath="primaryCta"
                  inlineObjectLabel="Primary CTA"
                  isDarkBg={isDarkBg}
                />
              )}
              {secondaryCta && (
                <ButtonComponent
                  {...secondaryCta}
                  moduleId={__moduleId}
                  inlineObjectPath="secondaryCta"
                  inlineObjectLabel="Secondary CTA"
                  isDarkBg={isDarkBg}
                />
              )}
            </>
          )}
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
        className={`${bg} py-12 lg:py-16 overflow-hidden`}
        data-module="hero-with-media"
        data-inline-type="select"
        data-inline-path="backgroundColor"
        data-inline-label="Background Color"
        data-inline-options={JSON.stringify([
          { label: 'Transparent', value: 'bg-transparent' },
          { label: 'Low', value: 'bg-backdrop-low' },
          { label: 'Medium', value: 'bg-backdrop-medium' },
          { label: 'High', value: 'bg-backdrop-high' },
          { label: 'Dark', value: 'bg-neutral-high' },
        ])}
      >
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
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
      className={`${bg} py-12 lg:py-16`}
      data-module="hero-with-media"
      data-inline-type="select"
      data-inline-path="backgroundColor"
      data-inline-label="Background Color"
      data-inline-options={JSON.stringify([
        { label: 'Transparent', value: 'bg-transparent' },
        { label: 'Low', value: 'bg-backdrop-low' },
        { label: 'Medium', value: 'bg-backdrop-medium' },
        { label: 'High', value: 'bg-backdrop-high' },
        { label: 'Dark', value: 'bg-neutral-high' },
      ])}
    >
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
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
  isDarkBg?: boolean
}

function ButtonComponent({
  label: initialLabel,
  url: initialUrl,
  style: initialStyle = 'primary',
  target,
  rel,
  moduleId,
  inlineObjectPath,
  inlineObjectLabel,
  isDarkBg,
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
    primary: isDarkBg
      ? 'bg-backdrop-low text-neutral-high hover:bg-backdrop-low/90'
      : 'bg-standout-medium text-on-high',
    secondary: isDarkBg
      ? 'bg-on-high/10 text-on-high hover:bg-on-high/20'
      : 'bg-backdrop-medium hover:bg-backdrop-high text-neutral-high',
    outline: isDarkBg
      ? 'border border-on-high text-on-high hover:bg-on-high/10'
      : 'border border-line-low hover:bg-backdrop-medium text-neutral-high',
  }
  const styleClasses = styleMap[style] || styleMap.primary

  const { href, target: finalTarget } = resolveHrefAndTarget(url, target)
  if (!href) return null

  return (
    <a
      href={href}
      target={finalTarget}
      rel={finalTarget === '_blank' ? 'noopener noreferrer' : rel}
      className={`inline-flex items-center justify-center px-5 py-3 text-base font-medium rounded-lg transition-colors duration-200 ${styleClasses} relative group`}
      data-inline-type="object"
      data-inline-path={inlineObjectPath}
      data-inline-label={inlineObjectLabel}
      data-inline-fields={ctaObjectFields}
    >
      {label}
    </a>
  )
}
