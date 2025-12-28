import { motion } from 'framer-motion'
import { useInlineValue } from '../components/inline-edit/InlineEditorContext'

import { renderLexicalToHtml } from '../utils/lexical'

interface LexicalJSON {
  root: {
    type: string
    children: any[]
  }
}

interface ProseProps {
  // Lexical JSON or pre-rendered HTML.
  // Note: content can be missing/undefined for older or partially-staged drafts;
  // the renderer must be resilient to avoid SSR 500s.
  content?: LexicalJSON | string | null
  maxWidth?: string // Tailwind class (e.g., 'max-w-4xl')
  fontSize?: string // Tailwind class (e.g., 'text-base')
  backgroundColor?: string // Tailwind class
  textColor?: string // Tailwind class
  textAlign?: 'left' | 'center' | 'right' | 'justify' // Alignment inside prose
  padding?: string // Tailwind class
  __moduleId?: string
  _useReact?: boolean
}

export default function Prose({
  content: initialContent,
  // Default to full width so prose fills whatever container it's placed in.
  maxWidth: initialMaxWidth = 'max-w-none',
  fontSize: initialFontSize = 'text-base',
  backgroundColor: initialBackground = 'bg-transparent',
  textColor: initialTextColor = 'text-neutral-high',
  textAlign: initialTextAlign = 'left',
  padding: initialPadding = 'py-12',
  __moduleId,
  _useReact,
}: ProseProps) {
  const content = useInlineValue(__moduleId, 'content', initialContent)
  const maxWidth = useInlineValue(__moduleId, 'maxWidth', initialMaxWidth)
  const fontSize = useInlineValue(__moduleId, 'fontSize', initialFontSize)
  const backgroundColor = useInlineValue(__moduleId, 'backgroundColor', initialBackground)
  const isDarkBg = backgroundColor === 'bg-neutral-high' || backgroundColor === 'bg-backdrop-high' || backgroundColor === 'bg-standout-low'
  const textColor = isDarkBg ? 'text-on-standout' : initialTextColor
  const textAlign = useInlineValue(__moduleId, 'textAlign', initialTextAlign)
  const padding = useInlineValue(__moduleId, 'padding', initialPadding)

  // Normalize content so that saved JSON strings from the editor still render
  // as rich text instead of showing the raw JSON to the visitor.
  let htmlContent: string
  if (content === undefined || content === null) {
    htmlContent = '<p>Empty content</p>'
  } else if (typeof content === 'string') {
    const trimmed = content.trim()
    const looksJson = trimmed.startsWith('{') || trimmed.startsWith('[')
    if (looksJson) {
      try {
        const parsed = JSON.parse(trimmed)
        htmlContent = renderLexicalToHtml(parsed)
      } catch {
        // Fall back to treating the string as already-rendered HTML
        htmlContent = content
      }
    } else {
      htmlContent = content
    }
  } else {
    htmlContent = renderLexicalToHtml(content)
  }

  const innerContent = (
    <div className="container mx-auto px-4 sm:px-6 lg:px-8">
      <div className={`w-full ${maxWidth}`}>
        <div
          className={`prose max-w-none ${isDarkBg ? 'prose-invert' : ''} ${fontSize} ${textColor} ${textAlign === 'center'
              ? 'text-center'
              : textAlign === 'right'
                ? 'text-right'
                : textAlign === 'justify'
                  ? 'text-justify'
                  : 'text-left'
            }`}
          suppressHydrationWarning
          data-inline-type="richtext"
          data-inline-path="content"
          dangerouslySetInnerHTML={{ __html: htmlContent }}
        />
      </div>
    </div>
  )

  if (_useReact) {
    return (
      <motion.section
        initial={{ opacity: 0, y: 30 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-100px' }}
        transition={{ duration: 1.0, ease: 'easeOut' }}
        className={`${backgroundColor} ${padding}`}
        data-module="prose"
      >
        {innerContent}
      </motion.section>
    )
  }

  return (
    <section className={`${backgroundColor} ${padding}`} data-module="prose">
      {innerContent}
    </section>
  )
}
