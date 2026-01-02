import { motion } from 'framer-motion'
import { FontAwesomeIcon } from '../site/lib/icons'
import { useInlineValue, useInlineField } from '../components/inline-edit/InlineEditorContext'
import { MediaRenderer } from '../components/MediaRenderer'
import { getSectionStyles } from '../utils/colors'
import { SectionBackground } from '../components/SectionBackground'
import { THEME_OPTIONS } from '#modules/shared_fields'

interface BlockquoteProps {
  quote: string
  authorName: string
  authorTitle?: string | null
  avatar?: {
    id: string
    url: string
    mimeType?: string
    altText?: string
    metadata?: any
  } | null // media object
  theme?: string
  backgroundImage?: any
  backgroundTint?: boolean
  __moduleId?: string
  _useReact?: boolean
}

export default function Blockquote({
  quote: initialQuote,
  authorName: initialAuthorName,
  authorTitle: initialAuthorTitle,
  avatar: initialAvatar,
  theme: initialTheme = 'low',
  backgroundImage: initialBackgroundImage,
  backgroundTint: initialBackgroundTint,
  __moduleId,
  _useReact,
}: BlockquoteProps) {
  const { value: quote, show: showQuote, props: quoteProps } = useInlineField(__moduleId, 'quote', initialQuote, { label: 'Quote', type: 'textarea' })
  const { value: authorName, show: showAuthorName, props: authorNameProps } = useInlineField(__moduleId, 'authorName', initialAuthorName, { label: 'Author Name' })
  const { value: authorTitle, show: showAuthorTitle, props: authorTitleProps } = useInlineField(__moduleId, 'authorTitle', initialAuthorTitle, { label: 'Author Title' })
  const { value: avatar, show: showAvatar, props: avatarProps } = useInlineField(__moduleId, 'avatar', initialAvatar, { type: 'media', label: 'Avatar' })
  const theme = useInlineValue(__moduleId, 'theme', initialTheme) || initialTheme
  const backgroundImage = useInlineValue(__moduleId, 'backgroundImage', initialBackgroundImage)
  const backgroundTint = useInlineValue(__moduleId, 'backgroundTint', initialBackgroundTint)

  const styles = getSectionStyles(theme)
  const textColor = styles.textColor
  const subtextColor = styles.subtextColor
  const quoteIconColor = styles.quoteIconColor

  const content = (
    <div className="max-w-7xl px-4 mx-auto text-center">
      <figure className="max-w-3xl mx-auto">
        <div className={`mx-auto mb-6 flex items-center justify-center ${quoteIconColor}`}>
          {_useReact ? (
            <motion.div
              initial={{ rotate: -15, scale: 0.8 }}
              whileInView={{ rotate: 0, scale: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 1.0, type: 'spring', damping: 15 }}
            >
              <FontAwesomeIcon icon="quote-left" size="3x" className="inline-block" />
            </motion.div>
          ) : (
            <FontAwesomeIcon icon="quote-left" size="3x" className="inline-block" />
          )}
        </div>
        <blockquote>
          {showQuote &&
            (_useReact ? (
              <motion.p
                initial={{ opacity: 0, scale: 0.95 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ duration: 1.0, delay: 0.25 }}
                className={`text-2xl md:text-3xl font-medium ${textColor}`}
                {...quoteProps}
              >
                {quote ? `“${quote}”` : ""}
              </motion.p>
            ) : (
              <p
                className={`text-2xl md:text-3xl font-medium ${textColor}`}
                {...quoteProps}
              >
                {quote ? `“${quote}”` : ""}
              </p>
            ))}
        </blockquote>
        <figcaption className="flex items-center justify-center mt-8 space-x-4">
          {showAvatar && (
            <div
              className={`w-14 h-14 rounded-full overflow-hidden shrink-0 relative ${!avatar ? "bg-backdrop-medium/50 border border-dashed border-line-medium" : ""}`}
              {...avatarProps}
            >
              {avatar && (
                <MediaRenderer
                  image={avatar}
                  variant="thumb"
                  alt={(typeof avatar === 'object' ? avatar.altText : null) || authorName || ''}
                  loading="lazy"
                  decoding="async"
                />
              )}
            </div>
          )}
          <div
            className={`flex items-center divide-x-2 ${styles.inverted ? 'divide-backdrop-low/20' : 'divide-neutral-low/60'}`}
          >
            {showAuthorName && (
              <div className={`pr-3 font-medium ${textColor}`} {...authorNameProps}>
                {authorName}
              </div>
            )}
            {showAuthorTitle && (
              <div
                className={`pl-3 text-sm font-light ${subtextColor}`}
                {...authorTitleProps}
              >
                {authorTitle}
              </div>
            )}
          </div>
        </figcaption>
      </figure>
    </div>
  )

  if (_useReact) {
    return (
      <motion.section
        initial={{ opacity: 0, y: 30 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-100px' }}
        transition={{ duration: 1.0, ease: 'easeOut' }}
        className={`${styles.containerClasses} py-8 lg:py-16 relative overflow-hidden`}
        data-module="blockquote"
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
        <div className="relative z-10">
          {content}
        </div>
      </motion.section>
    )
  }

  return (
    <section
      className={`${styles.containerClasses} py-16 lg:py-24 relative overflow-hidden`}
      data-module="blockquote"
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
      <div className="relative z-10">
        {content}
      </div>
    </section>
  )
}
