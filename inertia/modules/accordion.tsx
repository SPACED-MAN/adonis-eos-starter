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
import { motion, AnimatePresence, type Variants } from 'framer-motion'
import { FontAwesomeIcon } from '../site/lib/icons'
import { useInlineValue } from '../components/inline-edit/InlineEditorContext'
import { renderLexicalToHtml } from '../utils/lexical'

interface AccordionItem {
  title: string
  content: any // Lexical JSON or string
}

interface AccordionProps {
  items: AccordionItem[]
  allowMultiple?: boolean
  defaultOpenIndex?: number
  backgroundColor?: string
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

export default function Accordion({
  items: initialItems,
  allowMultiple = false,
  defaultOpenIndex,
  backgroundColor = 'bg-transparent',
  __moduleId,
  _useReact,
}: AccordionProps) {
  const items = useInlineValue(__moduleId, 'items', initialItems) || []
  const bg = useInlineValue(__moduleId, 'backgroundColor', backgroundColor) || backgroundColor

  const isDarkBg = bg === 'bg-neutral-high' || bg === 'bg-backdrop-high' || bg === 'bg-standout-low'
  const textColor = isDarkBg ? 'text-on-standout' : 'text-neutral-high'
  const subtextColor = isDarkBg ? 'text-on-standout/80' : 'text-neutral-medium'
  const itemBg = isDarkBg ? 'bg-backdrop-low/10' : 'bg-backdrop-low'
  const itemBorder = isDarkBg ? 'border-backdrop-low/20' : 'border-border'

  const [openIndices, setOpenIndices] = useState<Set<number>>(
    new Set(defaultOpenIndex !== undefined ? [defaultOpenIndex] : [])
  )

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

  const containerVariants = {
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
      transition: { duration: 0.8, ease: 'easeOut' },
    },
  }

  const content = (
    <div className="space-y-2">
      {items.map((item: AccordionItem, index: number) => {
        const isOpen = openIndices.has(index)
        const htmlContent = renderContent(item.content)

        const accordionItem = (
          <div key={index} className={`border ${itemBorder} rounded-lg overflow-hidden`}>
            {/* Header */}
            <button
              onClick={() => toggleItem(index)}
              className={`w-full flex items-center justify-between p-4 text-left ${itemBg} hover:opacity-90 transition-opacity`}
              aria-expanded={isOpen}
            >
              <span
                className={`font-semibold ${textColor}`}
                data-inline-path={`items.${index}.title`}
              >
                {item.title}
              </span>
              <FontAwesomeIcon
                icon="chevron-down"
                className={`w-5 h-5 ${subtextColor} transition-transform ${
                  isOpen ? 'rotate-180' : ''
                }`}
              />
            </button>

            {/* Content */}
            <AnimatePresence initial={false}>
              {isOpen && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.3, ease: 'easeInOut' }}
                  className="overflow-hidden"
                >
                  <div className={`p-4 ${itemBg} border-t ${itemBorder}`}>
                    <div
                      className={`${subtextColor} prose max-w-none ${isDarkBg ? 'prose-invert' : ''}`}
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

        return _useReact ? (
          <motion.div key={index} variants={itemVariants}>
            {accordionItem}
          </motion.div>
        ) : (
          <div key={index}>{accordionItem}</div>
        )
      })}
    </div>
  )

  if (_useReact) {
    return (
      <section
        className={`${bg} py-12 lg:py-16`}
        data-module="accordion"
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
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-3xl">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-50px' }}
            variants={containerVariants}
            className="accordion-module"
          >
            {content}
          </motion.div>
        </div>
      </section>
    )
  }

  return (
    <section
      className={`${bg} py-12 lg:py-16`}
      data-module="accordion"
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
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-3xl">
        <div className="accordion-module">{content}</div>
      </div>
    </section>
  )
}
