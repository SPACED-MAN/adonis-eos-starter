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
import { FontAwesomeIcon } from '../site/lib/icons'

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
              className="border border-border rounded-lg overflow-hidden"
            >
              {/* Header */}
              <button
                onClick={() => toggleItem(index)}
                className="w-full flex items-center justify-between p-4 text-left bg-backdrop-low hover:bg-backdrop-medium transition-colors"
                aria-expanded={isOpen}
              >
                <span className="font-semibold text-neutral-high">
                  {item.title}
                </span>
                <FontAwesomeIcon
                  icon="chevron-down"
                  className={`w-5 h-5 text-neutral-low transition-transform ${
                    isOpen ? 'rotate-180' : ''
                  }`}
                />
              </button>

              {/* Content */}
              {isOpen && (
                <div className="p-4 bg-backdrop-low border-t border-border">
                  <div
                    className="text-neutral-medium prose max-w-none"
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

