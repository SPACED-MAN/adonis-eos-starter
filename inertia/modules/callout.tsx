import { useMemo } from 'react'
import { motion, type Variants } from 'framer-motion'
import type { Button } from './types'
import { useInlineValue, useInlineField } from '../components/inline-edit/InlineEditorContext'
import { MediaRenderer } from '../components/MediaRenderer'
import { renderLexicalToHtml } from '../utils/lexical'
import { resolveLink } from '../utils/resolve_link'

interface CalloutProps {
  title: string
  prose?: any // Lexical JSON
  image?: {
    id: string
    url: string
    mimeType?: string
    altText?: string
    metadata?: any
  } | null
  ctas?: Button[]
  variant?: 'centered' | 'split-left' | 'split-right'
  backgroundColor?: string
  __moduleId?: string
  _useReact?: boolean
}

export default function Callout(props: CalloutProps) {
  const {
    title: initialTitle,
    prose: initialProse,
    image: initialImage,
    ctas: initialCtas = [],
    variant: initialVariant = 'centered',
    backgroundColor: initialBackground = 'bg-backdrop-low',
    __moduleId,
    _useReact,
  } = props

  const { value: title, show: showTitle, props: titleProps } = useInlineField(__moduleId, 'title', initialTitle || 'Ready to get started?', { label: 'Title' })
  const { value: richProse, show: showProse, props: proseProps } = useInlineField(__moduleId, 'prose', initialProse, { type: 'richtext', label: 'Prose' })
  const { value: image, show: showImage, props: imageProps } = useInlineField(__moduleId, 'image', initialImage, { type: 'media', label: 'Image' })
  const ctas = useInlineValue(__moduleId, 'ctas', initialCtas) || initialCtas
  const variant =
    useInlineValue(__moduleId, 'variant', initialVariant) || initialVariant || 'centered'
  const backgroundColor =
    useInlineValue(__moduleId, 'backgroundColor', initialBackground) ||
    initialBackground ||
    'bg-backdrop-low'

  const isDarkBg = backgroundColor === 'bg-neutral-high' || backgroundColor === 'bg-backdrop-high' || backgroundColor === 'bg-standout-low'
  const textColor = isDarkBg ? 'text-on-standout' : 'text-neutral-high'
  const subtextColor = isDarkBg ? 'text-on-standout/80' : 'text-neutral-medium'

  const htmlProse = useMemo(() => {
    const hasRichContent = (val: any) => {
      if (!val) return false
      if (typeof val === 'string') return val.trim().length > 0
      if (typeof val !== 'object') return false

      // Lexical JSON structure check: must have children and not just an empty paragraph
      const children = val.root?.children || val.children
      if (!children || !Array.isArray(children) || children.length === 0) return false

      if (
        children.length === 1 &&
        children[0].type === 'paragraph' &&
        (!children[0].children ||
          children[0].children.length === 0 ||
          (children[0].children.length === 1 &&
            children[0].children[0].type === 'text' &&
            !children[0].children[0].text))
      ) {
        return false
      }
      return true
    }

    // Use 'prose' field
    const proseToRender = hasRichContent(richProse) ? richProse : null

    if (!proseToRender) return null

    if (typeof proseToRender === 'string') {
      const trimmed = proseToRender.trim()
      if (!trimmed) return null
      if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
        try {
          const parsed = JSON.parse(trimmed)
          return renderLexicalToHtml(parsed)
        } catch {
          return trimmed
        }
      }
      return trimmed
    }
    return renderLexicalToHtml(proseToRender)
  }, [richProse])

  const containerVariants: Variants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1,
      },
    },
  }

  const itemVariants: Variants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.6, ease: 'easeOut' },
    },
  }

  const imageVariants: Variants = {
    hidden: { opacity: 0, scale: 0.95 },
    visible: {
      opacity: 1,
      scale: 1,
      transition: { duration: 0.8, ease: 'easeOut' },
    },
  }

  const renderButtons = () => {
    if (!ctas || ctas.length === 0) return null

    return (
      <div
        className={`flex flex-wrap items-center gap-4 ${variant === 'split-left' || variant === 'split-right' ? 'justify-start' : 'justify-center'
          }`}
        data-inline-type="repeater"
        data-inline-path="ctas"
      >
        {ctas.map((cta: Button, idx: number) => (
          <ButtonComponent
            key={`${cta.label}-${idx}`}
            {...cta}
            idx={idx}
            moduleId={__moduleId}
            isDarkBg={isDarkBg}
          />
        ))}
      </div>
    )
  }

  const textBlock = (
    <div
      className={`space-y-6 ${variant === 'split-left' || variant === 'split-right' ? 'text-left' : 'text-center'}`}
    >
      {showTitle && (
        <h2
          className={`text-3xl font-extrabold tracking-tight sm:text-4xl ${textColor}`}
          {...titleProps}
        >
          {title}
        </h2>
      )}

      {showProse && (
        <div
          className={`prose max-w-none ${isDarkBg ? 'prose-invert' : ''} ${subtextColor}`}
          {...proseProps}
          dangerouslySetInnerHTML={{ __html: htmlProse }}
        />
      )}

      {renderButtons()}
    </div>
  )

  const imageBlock = showImage ? (
    <div
      className="w-full relative overflow-hidden aspect-video rounded-xl bg-backdrop-medium/30"
      {...imageProps}
    >
      {image && (
        <MediaRenderer
          image={image}
          alt={(typeof image === 'object' ? image.altText : null) || ''}
          playMode={typeof image === 'object' ? image.metadata?.playMode : 'autoplay'}
          objectFit="contain"
          className="w-full h-full object-contain"
        />
      )}
    </div>
  ) : null

  const renderedContent = (
    <div className="container mx-auto px-4 sm:px-6 lg:px-8">
      {variant === 'split-left' || variant === 'split-right' ? (
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          {variant === 'split-left' && (
            <>
              <div className="order-2 lg:order-1">
                {_useReact ? (
                  <motion.div variants={imageVariants}>{imageBlock}</motion.div>
                ) : (
                  imageBlock
                )}
              </div>
              <div className="order-1 lg:order-2">
                {_useReact ? (
                  <motion.div variants={itemVariants}>{textBlock}</motion.div>
                ) : (
                  textBlock
                )}
              </div>
            </>
          )}
          {variant === 'split-right' && (
            <>
              <div className="order-1">
                {_useReact ? (
                  <motion.div variants={itemVariants}>{textBlock}</motion.div>
                ) : (
                  textBlock
                )}
              </div>
              <div className="order-2">
                {_useReact ? (
                  <motion.div variants={imageVariants}>{imageBlock}</motion.div>
                ) : (
                  imageBlock
                )}
              </div>
            </>
          )}
        </div>
      ) : (
        /* Default to centered if unknown or explicit centered */
        <div className="max-w-3xl mx-auto">
          {_useReact ? (
            <motion.div variants={itemVariants}>
              {textBlock}
              {image && <div className="mt-10">{imageBlock}</div>}
            </motion.div>
          ) : (
            <>
              {textBlock}
              {image && <div className="mt-10">{imageBlock}</div>}
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
        className={`${backgroundColor} py-16 lg:py-24 overflow-hidden`}
        data-module="callout"
      >
        {renderedContent}
      </motion.section>
    )
  }

  return (
    <section
      className={`${backgroundColor} py-16 lg:py-24`}
      data-module="callout"
      data-inline-type="select"
      data-inline-path="backgroundColor"
      data-inline-options={JSON.stringify([
        { label: 'Transparent', value: 'bg-transparent' },
        { label: 'Low', value: 'bg-backdrop-low' },
        { label: 'Medium', value: 'bg-backdrop-medium' },
        { label: 'High', value: 'bg-backdrop-high' },
        { label: 'Dark', value: 'bg-neutral-high' },
      ])}
    >
      {renderedContent}
    </section>
  )
}

function ButtonComponent({
  label: initialLabel,
  url: initialUrl,
  style: initialStyle = 'primary',
  target,
  rel,
  idx,
  moduleId,
  isDarkBg,
}: Button & { idx: number; moduleId?: string; isDarkBg?: boolean }) {
  const repeaterObj = useInlineValue(moduleId, `ctas[${idx}]`, {
    label: initialLabel,
    url: initialUrl,
    style: initialStyle,
  })

  const label = repeaterObj?.label ?? initialLabel
  const url = repeaterObj?.url ?? initialUrl
  const style = repeaterObj?.style ?? initialStyle

  const { href, target: finalTarget } = resolveLink(url, target)
  if (!href) return null

  const styleMap = {
    primary: isDarkBg
      ? 'bg-white text-standout-medium hover:bg-neutral-50'
      : 'bg-standout-medium text-on-standout hover:opacity-90',
    secondary: isDarkBg
      ? 'bg-on-standout/10 text-on-standout hover:bg-on-standout/20'
      : 'bg-backdrop-medium hover:bg-backdrop-high text-neutral-high',
    outline: isDarkBg
      ? 'border border-on-standout text-on-standout hover:bg-on-standout/10'
      : 'border border-line-low hover:bg-backdrop-medium text-neutral-high',
  }

  const styleClasses = styleMap[style as keyof typeof styleMap] || styleMap.primary

  const ctaFields = JSON.stringify([
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

  return (
    <a
      href={href}
      target={finalTarget}
      rel={finalTarget === '_blank' ? 'noopener noreferrer' : rel}
      className={`inline-flex items-center justify-center px-6 py-3 text-base font-semibold rounded-xl transition-all duration-200 ${styleClasses}`}
      data-inline-type="object"
      data-inline-path={`ctas[${idx}]`}
      data-inline-fields={ctaFields}
    >
      {label}
    </a>
  )
}
