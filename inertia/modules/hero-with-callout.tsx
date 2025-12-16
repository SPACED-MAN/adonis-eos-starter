import type { LinkValue } from './types'
import { useInlineValue } from '../components/inline-edit/InlineEditorContext'
import { resolveLink, resolvePostLink } from '../utils/resolve_link'
import { useState, useEffect } from 'react'

interface CalloutButton {
  label?: string
  url?: string | LinkValue
  target?: '_self' | '_blank'
}

interface HeroWithCalloutProps {
  title: string
  subtitle?: string | null
  callouts?: CalloutButton[] | null
  backgroundColor?: string
  __moduleId?: string
}

function getLinkTarget(
  url: string | LinkValue | undefined,
  fallbackTarget?: '_self' | '_blank'
): '_self' | '_blank' {
  if (url && typeof url === 'object' && url.kind) {
    return url.target === '_blank' ? '_blank' : '_self'
  }
  return fallbackTarget || '_self'
}

/**
 * CalloutButtons component that handles async resolution of post links
 */
function CalloutButtons({
  callouts,
}: {
  callouts: CalloutButton[]
}) {
  const [resolvedLinks, setResolvedLinks] = useState<Map<number, string>>(new Map())

  useEffect(() => {
    // Resolve any post links that need async fetching
    const resolveLinks = async () => {
      const newResolved = new Map<number, string>()

      await Promise.all(
        callouts.map(async (callout, index) => {
          if (!callout?.url) return

          // Normalize the URL - handle stringified JSON objects
          let urlValue = callout.url
          if (typeof urlValue === 'string' && urlValue.startsWith('{') && urlValue.includes('"kind"')) {
            try {
              urlValue = JSON.parse(urlValue)
            } catch {
              // If parsing fails, treat as regular URL string
            }
          }

          const resolved = resolveLink(urlValue)
          
          // If we already have a resolved href (from server-resolved URL), use it
          if (resolved.href && typeof resolved.href === 'string') {
            newResolved.set(index, resolved.href)
            return
          }
          
          // If href is undefined and it's a post reference, fetch it from the API
          // This ensures we get the correct URL pattern (e.g., /module-catalog not /page/module-catalog)
          if (typeof urlValue === 'object' && urlValue !== null && urlValue.kind === 'post' && urlValue.postId) {
            try {
              const asyncResolved = await resolvePostLink(urlValue.postId, urlValue.target)
              if (asyncResolved.href && typeof asyncResolved.href === 'string') {
                newResolved.set(index, asyncResolved.href)
              } else {
                // If async resolution failed, log for debugging
                console.warn(`Failed to resolve post link for postId: ${urlValue.postId}`)
              }
            } catch (error) {
              console.error(`Error resolving post link for postId: ${urlValue.postId}`, error)
            }
          } else if (typeof urlValue === 'object' && urlValue !== null && urlValue.kind === 'url' && typeof urlValue.url === 'string') {
            // It's already a URL type, use it directly
            newResolved.set(index, urlValue.url)
          } else if (typeof urlValue === 'string' && !urlValue.startsWith('{')) {
            // It's a plain string URL (not a stringified JSON object)
            newResolved.set(index, urlValue)
          }
        })
      )

      setResolvedLinks(newResolved)
    }

    resolveLinks()
  }, [callouts])

  return (
    <div className="flex flex-col mb-8 lg:mb-12 space-y-4 sm:flex-row sm:justify-center sm:space-y-0 sm:space-x-4">
      {callouts.map((callout, index) => {
        // Get resolved href (either from sync resolution or async fetch)
        // Make sure we don't use the raw URL object - only use resolved hrefs
        const resolved = resolveLink(callout?.url)
        const href = resolved.href || resolvedLinks.get(index)
        const linkTarget = getLinkTarget(callout?.url, callout?.target)

        // Only render if we have both a label and a valid href (not undefined, not empty, not an object)
        if (!callout.label || !href || typeof href !== 'string' || href.trim() === '') return null

        return (
          <a
            key={index}
            href={href}
            target={linkTarget}
            rel={linkTarget === '_blank' ? 'noopener noreferrer' : undefined}
            className="inline-flex justify-center items-center py-3 px-5 text-sm sm:text-base font-medium text-center text-on-standout rounded-lg bg-standout-medium hover:bg-standout-medium/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-standout-medium transition-colors"
            data-inline-type="object"
            data-inline-path={`callouts.${index}`}
            data-inline-label={`Callout ${index + 1}`}
            data-inline-fields={JSON.stringify([
              { name: 'label', type: 'text', label: 'Label' },
              { name: 'url', type: 'link', label: 'Destination' },
              {
                name: 'target',
                type: 'select',
                label: 'Target',
                options: [
                  { label: 'Same tab', value: '_self' },
                  { label: 'New tab', value: '_blank' },
                ],
              },
            ])}
          >
            {callout.label}
          </a>
        )
      })}
    </div>
  )
}

export default function HeroWithCallout({
  title: initialTitle,
  subtitle: initialSubtitle,
  callouts: initialCallouts,
  backgroundColor = 'bg-backdrop-low',
  __moduleId,
}: HeroWithCalloutProps) {
  const title = useInlineValue(__moduleId, 'title', initialTitle)
  const subtitle = useInlineValue(__moduleId, 'subtitle', initialSubtitle)
  const callouts = useInlineValue(__moduleId, 'callouts', initialCallouts)
  const bg = useInlineValue(__moduleId, 'backgroundColor', backgroundColor)
  return (
    <section className={`${bg} py-12 lg:py-16`} data-module="hero-with-callout">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-12 text-center">
        <h1
          className="mb-4 text-4xl font-extrabold tracking-tight leading-tight text-neutral-high md:text-5xl lg:text-6xl"
          data-inline-path="title"
        >
          {title}
        </h1>
        {subtitle && (
          <p
            className="mb-8 text-lg font-normal text-neutral-medium lg:text-xl sm:px-4"
            data-inline-path="subtitle"
          >
            {subtitle}
          </p>
        )}

        {callouts && callouts.length > 0 && (
          <CalloutButtons callouts={callouts} />
        )}
      </div>
    </section>
  )
}
