import { motion } from 'framer-motion'
import { FontAwesomeIcon } from '../site/lib/icons'
import { useInlineValue } from '../components/inline-edit/InlineEditorContext'
import { MediaRenderer } from '../components/MediaRenderer'

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
  backgroundColor?: string
  __moduleId?: string
  _useReact?: boolean
}

export default function Blockquote({
  quote: initialQuote,
  authorName: initialAuthorName,
  authorTitle: initialAuthorTitle,
  avatar: initialAvatar,
  backgroundColor = 'bg-backdrop-low',
  __moduleId,
  _useReact,
}: BlockquoteProps) {
  const quote = useInlineValue(__moduleId, 'quote', initialQuote)
  const authorName = useInlineValue(__moduleId, 'authorName', initialAuthorName)
  const authorTitle = useInlineValue(__moduleId, 'authorTitle', initialAuthorTitle)
  const avatar = useInlineValue(__moduleId, 'avatar', initialAvatar)
  const bg = useInlineValue(__moduleId, 'backgroundColor', backgroundColor)

  const isDarkBg = bg === 'bg-neutral-high'
  const textColor = isDarkBg ? 'text-backdrop-low' : 'text-neutral-high'
  const subtextColor = isDarkBg ? 'text-backdrop-low/80' : 'text-neutral-medium'
  const quoteIconColor = isDarkBg ? 'text-backdrop-low/40' : 'text-neutral-low'

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
          {_useReact ? (
            <motion.p
              initial={{ opacity: 0, scale: 0.95 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 1.0, delay: 0.25 }}
              className={`text-2xl md:text-3xl font-medium ${textColor}`}
              data-inline-path="quote"
              data-inline-type="textarea"
            >
              “{quote}”
            </motion.p>
          ) : (
            <p
              className={`text-2xl md:text-3xl font-medium ${textColor}`}
              data-inline-path="quote"
              data-inline-type="textarea"
            >
              “{quote}”
            </p>
          )}
        </blockquote>
        <figcaption className="flex items-center justify-center mt-8 space-x-4">
          {avatar && (
            <div className="w-14 h-14 rounded-full overflow-hidden shrink-0">
              <MediaRenderer
                image={avatar}
                variant="thumb"
                alt={(typeof avatar === 'object' ? avatar.altText : null) || authorName || ''}
                loading="lazy"
                decoding="async"
                data-inline-type="media"
                data-inline-path="avatar"
              />
            </div>
          )}
          <div className={`flex items-center divide-x-2 ${isDarkBg ? 'divide-backdrop-low/20' : 'divide-neutral-low/60'}`}>
            <div className={`pr-3 font-medium ${textColor}`} data-inline-path="authorName">
              {authorName}
            </div>
            {authorTitle && (
              <div
                className={`pl-3 text-sm font-light ${subtextColor}`}
                data-inline-path="authorTitle"
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
        className={`${bg} py-8 lg:py-16`}
        data-module="blockquote"
      >
        {content}
      </motion.section>
    )
  }

  return (
    <section className={`${bg} py-8 lg:py-16`} data-module="blockquote">
      {content}
    </section>
  )
}
