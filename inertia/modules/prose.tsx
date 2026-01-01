import { motion } from 'framer-motion'
import { useInlineValue, useInlineField } from '../components/inline-edit/InlineEditorContext'
import { renderLexicalToHtml } from '../utils/lexical'
import { getSectionStyles } from '../utils/colors'
import { SectionBackground } from '../components/SectionBackground'

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
  theme?: string // Tailwind class
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
  theme: initialTheme = 'transparent',
  textColor: initialTextColor = 'text-neutral-high',
  textAlign: initialTextAlign = 'left',
  padding: initialPadding = 'py-12',
  __moduleId,
  _useReact,
}: ProseProps) {
  const { value: content, show: showContent, props: contentProps } = useInlineField(__moduleId, 'content', initialContent, { type: 'richtext', label: 'Content' })
  const maxWidth = useInlineValue(__moduleId, 'maxWidth', initialMaxWidth)
  const fontSize = useInlineValue(__moduleId, 'fontSize', initialFontSize)
  const theme =
    useInlineValue(__moduleId, 'theme', initialTheme) || initialTheme

  const styles = getSectionStyles(theme)
  const textColor = styles.inverted ? styles.textColor : initialTextColor
  const textAlign = useInlineValue(__moduleId, 'textAlign', initialTextAlign)
  const padding = useInlineValue(__moduleId, 'padding', initialPadding)

  // Normalize content so that saved JSON strings from the editor still render
  // as rich text instead of showing the raw JSON to the visitor.
  let htmlContent: string
  if (content === undefined || content === null) {
    htmlContent = '' // Let global CSS handles placeholder
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
    <div className="container mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
      <div className={`w-full ${maxWidth}`}>
        {showContent && (
          <div
            className={`prose max-w-none ${styles.proseInvert} ${fontSize} ${textColor} ${textAlign === 'center'
              ? 'text-center'
              : textAlign === 'right'
                ? 'text-right'
                : textAlign === 'justify'
                  ? 'text-justify'
                  : 'text-left'
              }`}
            suppressHydrationWarning
            {...contentProps}
            dangerouslySetInnerHTML={{ __html: htmlContent }}
          />
        )}
      </div>
    </div>
  )

  const sectionClasses = `${styles.containerClasses} ${padding} relative overflow-hidden`

  if (_useReact) {
    return (
      <motion.section
        initial={{ opacity: 0, y: 30 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-100px' }}
        transition={{ duration: 1.0, ease: 'easeOut' }}
        className={sectionClasses}
        data-module="prose"
      >
        <SectionBackground component={styles.backgroundComponent} />
        {innerContent}
      </motion.section>
    )
  }

  return (
    <section className={sectionClasses} data-module="prose">
      <SectionBackground component={styles.backgroundComponent} />
      {innerContent}
    </section>
  )
}
