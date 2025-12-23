/**
 * Breadcrumb Module
 *
 * Displays hierarchical navigation path for the current page.
 * Breadcrumb trail is automatically generated from post hierarchy and passed via page context.
 *
 * Configuration (edit below):
 * - Adjust BREADCRUMB_CONFIG to customize appearance and behavior
 */

import { usePage } from '@inertiajs/react'

// ============================================================================
// CONFIGURATION - Edit these values to customize breadcrumb behavior
// ============================================================================
const BREADCRUMB_CONFIG = {
  // Whether to show "Home" as the first breadcrumb item
  showHome: true,

  // Label for the home link (when showHome is true)
  homeLabel: 'Home',

  // Separator style between items
  // Options: 'chevron' (›), 'slash' (/), 'arrow' (→)
  separator: 'chevron' as 'chevron' | 'slash' | 'arrow',

  // Background color class
  backgroundColor: 'bg-backdrop-low',

  // Container max width (Tailwind classes)
  containerClass: 'max-w-7xl',

  // Text size class
  textSize: 'text-sm',
}

// ============================================================================

interface BreadcrumbItem {
  label: string
  url: string
  current?: boolean
}

interface PageProps {
  breadcrumbTrail?: BreadcrumbItem[]
  [key: string]: any
}

export default function Breadcrumb() {
  // Get breadcrumb trail from page context (automatically generated from post hierarchy)
  const { props } = usePage<PageProps>()
  const breadcrumbTrail = props.breadcrumbTrail || []

  const separatorMap = {
    chevron: '›',
    slash: '/',
    arrow: '→',
  }

  const separatorSymbol = separatorMap[BREADCRUMB_CONFIG.separator]

  // Build final breadcrumb list
  const items: BreadcrumbItem[] = []

  if (BREADCRUMB_CONFIG.showHome) {
    items.push({ label: BREADCRUMB_CONFIG.homeLabel, url: '/', current: false })
  }

  items.push(...breadcrumbTrail)

  // Don't render if no breadcrumbs
  if (items.length === 0) {
    return null
  }

  return (
    <nav
      className={`${BREADCRUMB_CONFIG.backgroundColor} py-3 border-b border-line-low`}
      data-module="breadcrumb"
      aria-label="Breadcrumb"
    >
      <div className={`${BREADCRUMB_CONFIG.containerClass} mx-auto px-4 sm:px-6 lg:px-8`}>
        <ol className={`flex items-center space-x-2 ${BREADCRUMB_CONFIG.textSize}`}>
          {items.map((item, index) => {
            const isLast = index === items.length - 1
            const isCurrent = item.current || isLast

            return (
              <li key={index} className="flex items-center">
                {index > 0 && (
                  <span className="text-neutral-low mx-2" aria-hidden="true">
                    {separatorSymbol}
                  </span>
                )}
                {isCurrent ? (
                  <span className="text-neutral-medium font-medium" aria-current="page">
                    {item.label}
                  </span>
                ) : (
                  <a
                    href={item.url}
                    className="text-neutral-high hover:text-standout-high transition-colors"
                  >
                    {item.label}
                  </a>
                )}
              </li>
            )
          })}
        </ol>
      </div>
    </nav>
  )
}
