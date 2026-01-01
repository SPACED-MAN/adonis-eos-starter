/**
 * Accordion Module - React Variant
 *
 * Interactive React component (SSR + hydration)
 * Use for FAQ sections, collapsible content, etc.
 *
 * Located in inertia/modules/ (shared between admin preview and public site)
 * No -static suffix = React component with full interactivity
 */

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { FontAwesomeIcon } from '../site/lib/icons'
import { useInlineValue, useInlineField } from '../components/inline-edit/InlineEditorContext'
import { renderLexicalToHtml } from '../utils/lexical'
import { getSectionStyles } from '../utils/colors'
import { SectionBackground } from '../components/SectionBackground'
import { THEME_OPTIONS } from '#modules/shared_fields'

interface AccordionItem {
  title: string
  content: any // Lexical JSON or string
}

interface AccordionsProps {
  title?: string
  subtitle?: string
  items: AccordionItem[]
  allowMultiple?: boolean
  theme?: string
  __moduleId?: string
  _useReact?: boolean
}

function renderContent(content: any): string {
  if (!content) return ''
  if (typeof content === 'string') {
    const trimmed = content.trim()
    const looksJson = trimmed.startsWith('{') || trimmed.startsWith('[')
    if (looksJson) {
      try {
        return renderLexicalToHtml(JSON.parse(trimmed))
      } catch {
        return content
      }
    }
    return content
  }
  return renderLexicalToHtml(content)
}

export default function Accordions({
  title: initialTitle,
  subtitle: initialSubtitle,
  items: initialItems = [],
  allowMultiple = false,
  theme: initialTheme = 'transparent',
  __moduleId,
}: AccordionsProps) {
  const { value: title, show: showTitle, props: titleProps } = useInlineField(__moduleId, 'title', initialTitle, { label: 'Title' })
  const { value: subtitle, show: showSubtitle, props: subtitleProps } = useInlineField(__moduleId, 'subtitle', initialSubtitle, { label: 'Subtitle' })
  const items = useInlineValue(__moduleId, 'items', initialItems) || []
  const theme = useInlineValue(__moduleId, 'theme', initialTheme) || initialTheme

  const styles = getSectionStyles(theme)
  const textColor = styles.textColor
  const subtextColor = styles.subtextColor
  const itemBg = styles.inverted ? 'bg-backdrop-low/10' : 'bg-backdrop-low'
  const itemBorder = styles.inverted ? 'border-backdrop-low/20' : 'border-border'

  const [openIndices, setOpenIndices] = useState<Set<number>>(new Set())

  const toggleItem = (index: number) => {
    setOpenIndices((prev) => {
      const newSet = new Set(prev)
      if (newSet.has(index)) {
        newSet.delete(index)
      } else {
        if (!allowMultiple) {
          newSet.clear()
        }
        newSet.add(index)
      }
      return newSet
    })
  }

  return (
    <section
      className={`${styles.containerClasses} py-16 lg:py-24 relative overflow-hidden`}
      data-module="accordions"
      data-inline-type="select"
      data-inline-path="theme"
      data-inline-label="Theme"
      data-inline-options={JSON.stringify(THEME_OPTIONS)}
    >
      <SectionBackground component={styles.backgroundComponent} />
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-3xl relative z-10">
        {(showTitle || showSubtitle) && (
          <div className="mb-12 text-center">
            {showTitle && (
              <h2 className={`text-3xl md:text-4xl font-extrabold tracking-tight mb-4 ${textColor}`} {...titleProps}>
                {title}
              </h2>
            )}
            {showSubtitle && (
              <p className={`text-lg ${subtextColor}`} {...subtitleProps}>
                {subtitle}
              </p>
            )}
          </div>
        )}

        <div className="space-y-3">
          {items.map((item: AccordionItem, index: number) => {
            const isOpen = openIndices.has(index)
            const htmlContent = renderContent(item.content)

            return (
              <div key={index} className={`border ${itemBorder} rounded-xl overflow-hidden transition-all duration-300 ${isOpen ? 'shadow-lg ring-1 ring-standout-high/20' : ''}`}>
                <button
                  onClick={() => toggleItem(index)}
                  className={`w-full flex items-center justify-between p-5 text-left ${itemBg} hover:bg-backdrop-medium/50 transition-colors`}
                  aria-expanded={isOpen}
                >
                  <span className={`font-semibold ${textColor}`} data-inline-path={`items.${index}.title`}>
                    {item.title}
                  </span>
                  <FontAwesomeIcon
                    icon="chevron-down"
                    className={`${subtextColor} transition-transform duration-300 ${isOpen ? 'rotate-180 text-standout-high' : ''
                      }`}
                    size="xs"
                  />
                </button>

                <AnimatePresence initial={false}>
                  {isOpen && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.3, ease: [0.23, 1, 0.32, 1] }}
                      className="overflow-hidden"
                    >
                      <div className={`p-6 ${itemBg} border-t ${itemBorder}`}>
                        <div
                          className={`${subtextColor} prose prose-sm md:prose-base max-w-none ${styles.proseInvert}`}
                          data-inline-type="richtext"
                          data-inline-path={`items.${index}.content`}
                          dangerouslySetInnerHTML={{ __html: htmlContent }}
                        />
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
