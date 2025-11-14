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

interface AccordionItem {
  title: string
  content: string
}

interface AccordionProps {
  items: AccordionItem[]
  allowMultiple?: boolean
  defaultOpenIndex?: number
}

export default function Accordion({
  items,
  allowMultiple = false,
  defaultOpenIndex,
}: AccordionProps) {
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

  return (
    <div className="accordion-module max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8" data-module="accordion">
      <div className="space-y-2">
        {items.map((item, index) => {
          const isOpen = openIndices.has(index)

          return (
            <div
              key={index}
              className="border border-sand-200 dark:border-sand-700 rounded-lg overflow-hidden"
            >
              {/* Header */}
              <button
                onClick={() => toggleItem(index)}
                className="w-full flex items-center justify-between p-4 text-left bg-neutral-50 dark:bg-neutral-800 hover:bg-neutral-100 dark:hover:bg-neutral-700 transition-colors"
                aria-expanded={isOpen}
              >
                <span className="font-semibold text-neutral-900 dark:text-neutral-50">
                  {item.title}
                </span>
                <svg
                  className={`w-5 h-5 text-neutral-600 dark:text-neutral-400 transition-transform ${
                    isOpen ? 'rotate-180' : ''
                  }`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 9l-7 7-7-7"
                  />
                </svg>
              </button>

              {/* Content */}
              {isOpen && (
                <div className="p-4 bg-white dark:bg-sand-900 border-t border-sand-200 dark:border-sand-700">
                  <div
                    className="text-neutral-700 dark:text-neutral-300 prose dark:prose-invert max-w-none"
                    dangerouslySetInnerHTML={{ __html: item.content }}
                  />
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

