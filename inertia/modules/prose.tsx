import { motion } from 'framer-motion'
import { useInlineValue, useInlineField } from '../components/inline-edit/InlineEditorContext'
import { renderLexicalToHtml } from '../utils/lexical'
import { getSectionStyles } from '../utils/colors'
import { SectionBackground } from '../components/SectionBackground'

import { THEME_OPTIONS } from '#modules/shared_fields'

interface LexicalJSON {
  root: {
    type: string
    children: any[]
  }
}

interface ProseProps {
  title?: string
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
  backgroundImage?: any
  backgroundTint?: boolean
  __moduleId?: string
  _useReact?: boolean
}

export default function Prose({
  title: initialTitle,
  content: initialContent,
  // Default to full width so prose fills whatever container it's placed in.
  maxWidth: initialMaxWidth = 'max-w-none',
  fontSize: initialFontSize = 'text-base',
  theme: initialTheme = 'transparent',
  textColor: initialTextColor = 'text-neutral-high',
  textAlign: initialTextAlign = 'left',
  padding: initialPadding = 'py-12',
  backgroundImage: initialBackgroundImage,
  backgroundTint: initialBackgroundTint,
  __moduleId,
  _useReact,
}: ProseProps) {
  const { value: title, show: showTitle, props: titleProps } = useInlineField(__moduleId, 'title', initialTitle, { label: 'Title' })
  const { value: content, show: showContent, props: contentProps } = useInlineField(__moduleId, 'content', initialContent, { type: 'richtext', label: 'Content' })
  const maxWidth = useInlineValue(__moduleId, 'maxWidth', initialMaxWidth)
  const fontSize = useInlineValue(__moduleId, 'fontSize', initialFontSize)
  const theme =
    useInlineValue(__moduleId, 'theme', initialTheme) || initialTheme
  const backgroundImage = useInlineValue(__moduleId, 'backgroundImage', initialBackgroundImage)
  const backgroundTint = useInlineValue(__moduleId, 'backgroundTint', initialBackgroundTint)

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
        {showTitle && title && (
          <h2
            className={`text-3xl font-extrabold tracking-tight mb-8 ${textColor} ${textAlign === 'center'
              ? 'text-center'
              : textAlign === 'right'
                ? 'text-right'
                : 'text-left'
              }`}
            {...titleProps}
          >
            {title}
          </h2>
        )}
        {showContent && (
          <div
            className={`prose max-w-none ${styles.proseInvert} ${fontSize} ${textColor} ${textAlign === 'center'
              ? 'text-center [&_ul]:inline-block [&_ol]:inline-block [&_ul]:text-left [&_ol]:text-left [&_li]:text-left'
              : textAlign === 'right'
                ? 'text-right list-inside'
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
        {innerContent}
      </motion.section>
    )
  }

  return (
    <section
      className={sectionClasses}
      data-module="prose"
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
      {innerContent}
    </section>
  )
}
