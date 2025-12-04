import { FontAwesomeIcon } from '../site/lib/icons'
import type { Button, LinkValue } from './types'

interface ExpandedFeatureItem {
  icon?: string | null
  title: string
  body: string
}

interface FeaturesListExpandedProps {
  title: string
  subtitle?: string | null
  features: ExpandedFeatureItem[]
  cta?: Button | null
  backgroundColor?: string
}

function resolveHrefAndTarget(
  url: string | LinkValue,
  explicitTarget?: '_self' | '_blank'
): { href?: string; target: '_self' | '_blank' } {
  let href: string | undefined
  let target: '_self' | '_blank' = '_self'

  if (!url) {
    return { href: undefined, target }
  }

  if (typeof url === 'string') {
    href = url
    target = explicitTarget || '_self'
    return { href, target }
  }

  if (url.kind === 'url') {
    href = url.url
  } else if (url.slug && url.locale) {
    href = `/${encodeURIComponent(url.locale)}/${encodeURIComponent(url.slug)}`
  } else if (url.slug) {
    href = `/${encodeURIComponent(url.slug)}`
  }

  const linkTarget = url.target === '_blank' ? '_blank' : '_self'
  target = explicitTarget || linkTarget

  return { href, target }
}

export default function FeaturesListExpanded({
  title,
  subtitle,
  features,
  cta,
  backgroundColor = 'bg-backdrop-low',
}: FeaturesListExpandedProps) {
  const safeFeatures = Array.isArray(features) ? features.slice(0, 12) : []

  const hasCta = Boolean(cta && cta.label && cta.url)

  return (
    <section
      className={`${backgroundColor} py-12 sm:py-16`}
      data-module="features-list-expanded"
    >
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="max-w-3xl mx-auto mb-10 text-center">
          <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-neutral-high mb-4">
            {title}
          </h2>
          {subtitle && (
            <p className="text-neutral-medium text-base sm:text-lg">
              {subtitle}
            </p>
          )}
        </div>

        {safeFeatures.map((feature, idx) => {
          const isEven = idx % 2 === 0

          return (
            <div
              key={idx}
              className={`flex items-center lg:w-3/5 mx-auto border-b border-line pb-10 mb-10 sm:flex-row flex-col ${
                !isEven ? 'sm:flex-row-reverse' : ''
              }`}
            >
              {feature.icon && (
                <div
                  className={`sm:w-32 sm:h-32 h-16 w-16 ${
                    isEven ? 'sm:mr-10' : 'sm:ml-10'
                  } inline-flex items-center justify-center rounded-full bg-standout/10 text-standout flex-shrink-0`}
                >
                  <FontAwesomeIcon
                    icon={feature.icon as any}
                    className="sm:w-12 sm:h-12 w-8 h-8"
                  />
                </div>
              )}

              <div className="flex-grow sm:text-left text-center mt-6 sm:mt-0">
                <h3 className="text-neutral-high text-lg sm:text-xl font-semibold mb-2">
                  {feature.title}
                </h3>
                <p className="leading-relaxed text-sm sm:text-base text-neutral-medium">
                  {feature.body}
                </p>
              </div>
            </div>
          )
        })}

        {hasCta && cta && (
          <SectionButton
            label={cta.label}
            url={cta.url}
            style={cta.style || 'primary'}
            target={cta.target}
            rel={cta.rel}
          />
        )}
      </div>
    </section>
  )
}

function SectionButton({ label, url, style = 'primary', target, rel }: Button) {
  const styleClasses =
    {
      primary: 'bg-standout text-on-standout',
      secondary: 'bg-backdrop-medium hover:bg-backdrop-high text-neutral-high',
      outline: 'border border-line hover:bg-backdrop-medium text-neutral-high',
    }[style] || 'bg-standout text-on-standout'

  const { href, target: finalTarget } = resolveHrefAndTarget(url, target)
  if (!href) return null

  return (
    <div className="flex justify-center mt-12">
      <a
        href={href}
        target={finalTarget}
        rel={finalTarget === '_blank' ? 'noopener noreferrer' : rel}
        className={`inline-flex items-center justify-center px-8 py-3 text-base font-medium rounded-lg transition-colors duration-200 ${styleClasses}`}
      >
        {label}
      </a>
    </div>
  )
}


