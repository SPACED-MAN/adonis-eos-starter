import { resolveHrefAndTarget } from './hero-with-media'

type LinkValue =
  | null
  | undefined
  | string
  | {
      kind?: 'url' | 'post'
      url?: string
      postId?: string | number | null
      target?: '_self' | '_blank'
    }

interface FaqItem {
  question: string
  answer: string
  linkLabel?: string | null
  linkUrl?: LinkValue
}

interface FaqProps {
  title: string
  subtitle?: string | null
  items: FaqItem[]
}

export default function Faq({ title, subtitle, items }: FaqProps) {
  const safeItems = Array.isArray(items) ? items.filter(Boolean) : []
  if (safeItems.length === 0) return null

  const midpoint = Math.ceil(safeItems.length / 2)
  const left = safeItems.slice(0, midpoint)
  const right = safeItems.slice(midpoint)

  const renderItem = (item: FaqItem, idx: number) => {
    const hasLink = !!item.linkLabel && !!item.linkUrl
    const link = hasLink ? resolveHrefAndTarget(item.linkUrl!) : { href: undefined, target: '_self' as const }

    return (
      <div key={idx} className="mb-8 last:mb-0">
        <h3 className="flex items-start mb-3 text-base sm:text-lg font-semibold text-neutral-high">
          <span
            className="mt-1 mr-2 inline-flex h-5 w-5 items-center justify-center rounded-full bg-backdrop-medium text-neutral-medium flex-shrink-0"
            aria-hidden="true"
          >
            <svg
              className="h-3 w-3"
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path
                fillRule="evenodd"
                d="M10 2a8 8 0 1 0 0 16 8 8 0 0 0 0-16Zm0 4a1 1 0 0 0-.87.5 1 1 0 1 1-1.73-1A3 3 0 0 1 13 8a3 3 0 0 1-2 2.83V11a1 1 0 1 1-2 0v-1a1 1 0 0 1 1-1 1 1 0 1 0 0-2Zm0 8a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z"
                clipRule="evenodd"
              />
            </svg>
          </span>
          <span>{item.question}</span>
        </h3>
        <p className="text-sm sm:text-base text-neutral-medium">
          {item.answer}
          {hasLink && link.href && (
            <>
              {' '}
              <a
                href={link.href}
                target={link.target}
                rel={link.target === '_blank' ? 'noopener noreferrer' : undefined}
                className="font-medium text-standout hover:underline"
              >
                {item.linkLabel}
              </a>
            </>
          )}
        </p>
      </div>
    )
  }

  return (
    <section className="bg-backdrop-low py-12 sm:py-16" data-module="faq">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="max-w-3xl mb-8 sm:mb-10">
          <h2 className="mb-4 text-3xl sm:text-4xl font-extrabold tracking-tight text-neutral-high">
            {title}
          </h2>
          {subtitle && (
            <p className="text-neutral-medium text-base sm:text-lg">
              {subtitle}
            </p>
          )}
        </div>
        <div className="grid gap-10 border-t border-line pt-8 md:grid-cols-2 md:gap-12">
          <div>
            {left.map((item, idx) => renderItem(item, idx))}
          </div>
          <div>
            {right.map((item, idx) => renderItem(item, midpoint + idx))}
          </div>
        </div>
      </div>
    </section>
  )
}


