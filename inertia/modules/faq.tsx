import { resolveHrefAndTarget } from './hero-with-media'
import { FontAwesomeIcon } from '../site/lib/icons'
import { useInlineValue } from '../components/inline-edit/InlineEditorContext'

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
  __moduleId?: string
}

export default function Faq({
  title: initialTitle,
  subtitle: initialSubtitle,
  items: initialItems,
  __moduleId,
}: FaqProps) {
  const title = useInlineValue(__moduleId, 'title', initialTitle)
  const subtitle = useInlineValue(__moduleId, 'subtitle', initialSubtitle)
  const items = useInlineValue(__moduleId, 'items', initialItems)

  const safeItems = Array.isArray(items) ? items.filter(Boolean) : []
  if (safeItems.length === 0) return null

  const midpoint = Math.ceil(safeItems.length / 2)
  const left = safeItems.slice(0, midpoint)
  const right = safeItems.slice(midpoint)

  const renderItem = (item: FaqItem, idx: number) => {
    const hasLink = !!item.linkLabel && !!item.linkUrl
    const link = hasLink
      ? resolveHrefAndTarget(item.linkUrl!)
      : { href: undefined, target: '_self' as const }

    return (
      <div key={idx} className="mb-8 last:mb-0">
        <h3
          className="flex items-start mb-3 text-base sm:text-lg font-semibold text-neutral-high"
          data-inline-type="object"
          data-inline-path={`items.${idx}`}
          data-inline-fields={JSON.stringify([
            { name: 'question', type: 'text', label: 'Question' },
            { name: 'answer', type: 'textarea', label: 'Answer' },
            { name: 'linkLabel', type: 'text', label: 'Link Label' },
            { name: 'linkUrl', type: 'link', label: 'Link URL' },
          ])}
        >
          <span
            className="mt-0.5 mr-3 inline-flex h-8 w-8 items-center justify-center rounded-full bg-backdrop-medium text-neutral-medium shrink-0"
            aria-hidden="true"
          >
            <FontAwesomeIcon icon="circle-question" className="text-base sm:text-lg" />
          </span>
          <span data-inline-path={`items.${idx}.question`}>{item.question}</span>
        </h3>
        <p
          className="text-sm sm:text-base text-neutral-medium"
          data-inline-path={`items.${idx}.answer`}
        >
          {item.answer}
          {hasLink && link.href && (
            <>
              {' '}
              <a
                href={link.href}
                target={link.target}
                rel={link.target === '_blank' ? 'noopener noreferrer' : undefined}
                className="font-medium text-standout-high hover:underline"
                data-inline-type="link"
                data-inline-path={`items.${idx}.linkUrl`}
              >
                <span data-inline-path={`items.${idx}.linkLabel`}>{item.linkLabel}</span>
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
          <h2
            className="mb-4 text-3xl sm:text-4xl font-extrabold tracking-tight text-neutral-high"
            data-inline-path="title"
          >
            {title}
          </h2>
          {subtitle && (
            <p className="text-neutral-medium text-base sm:text-lg" data-inline-path="subtitle">
              {subtitle}
            </p>
          )}
        </div>
        <div className="grid gap-10 border-t border-line-low pt-8 md:grid-cols-2 md:gap-12">
          <div>{left.map((item, idx) => renderItem(item, idx))}</div>
          <div>{right.map((item, idx) => renderItem(item, midpoint + idx))}</div>
        </div>
      </div>
    </section>
  )
}
