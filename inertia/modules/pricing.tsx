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

interface PricingPlan {
  name: string
  description?: string | null
  price: string
  period?: string | null
  features?: string[]
  primary?: boolean
  ctaLabel?: string | null
  ctaUrl?: LinkValue
}

interface PricingProps {
  title: string
  subtitle?: string | null
  plans: PricingPlan[]
  __moduleId?: string
}

export default function Pricing({
  title: initialTitle,
  subtitle: initialSubtitle,
  plans: initialPlans,
  __moduleId,
}: PricingProps) {
  const title = useInlineValue(__moduleId, 'title', initialTitle)
  const subtitle = useInlineValue(__moduleId, 'subtitle', initialSubtitle)
  const plans = useInlineValue(__moduleId, 'plans', initialPlans)

  const safePlans = Array.isArray(plans) ? plans.slice(0, 3) : []

  if (safePlans.length === 0) return null

  return (
    <section className="bg-backdrop-low py-12 sm:py-16" data-module="pricing">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="max-w-3xl mx-auto text-center mb-10 sm:mb-12">
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
        <div className="space-y-8 lg:grid lg:grid-cols-3 sm:gap-6 lg:space-y-0">
          {safePlans.map((plan, idx) => {
            const isPrimary = !!plan.primary
            const hasFeatures = Array.isArray(plan.features) && plan.features.length > 0
            const hrefInfo = resolveHrefAndTarget(plan.ctaUrl)
            const hasCta = !!plan.ctaLabel && !!hrefInfo.href
            return (
              <div
                key={idx}
                className={`flex flex-col p-6 mx-auto max-w-lg text-center bg-backdrop-low rounded-lg border border-line-low shadow-sm xl:p-8 ${
                  isPrimary ? 'ring-2 ring-standout-medium shadow-md' : ''
                }`}
                data-inline-type="object"
                data-inline-path={`plans.${idx}`}
                data-inline-label={`Plan ${idx + 1}`}
                data-inline-fields={JSON.stringify([
                  { name: 'name', type: 'text', label: 'Name' },
                  { name: 'description', type: 'textarea', label: 'Description' },
                  { name: 'price', type: 'text', label: 'Price' },
                  { name: 'period', type: 'text', label: 'Period' },
                  { name: 'features', type: 'repeater-text', label: 'Features (one per line)' },
                  { name: 'ctaLabel', type: 'text', label: 'CTA Label' },
                  { name: 'ctaUrl', type: 'link', label: 'CTA Link' },
                  { name: 'primary', type: 'boolean', label: 'Highlight' },
                ])}
              >
                <h3 className="mb-4 text-2xl font-semibold text-neutral-high">
                  <span data-inline-path={`plans.${idx}.name`}>{plan.name}</span>
                </h3>
                {plan.description && (
                  <p className="font-light text-sm sm:text-base text-neutral-medium">
                    <span data-inline-path={`plans.${idx}.description`}>{plan.description}</span>
                  </p>
                )}
                <div className="flex justify-center items-baseline my-8">
                  <span className="mr-2 text-4xl sm:text-5xl font-extrabold text-neutral-high">
                    $<span data-inline-path={`plans.${idx}.price`}>{plan.price}</span>
                  </span>
                  {plan.period && (
                    <span className="text-sm sm:text-base text-neutral-medium">
                      <span data-inline-path={`plans.${idx}.period`}>{plan.period}</span>
                    </span>
                  )}
                </div>
                {hasFeatures && (
                  <ul role="list" className="mb-8 space-y-3 text-left">
                    {plan.features!.map((f: string, fi: number) => (
                      <li key={fi} className="flex items-start space-x-3">
                        <span
                          className="mt-0.5 inline-flex h-5 w-5 items-center justify-center rounded-full bg-success/10 text-success"
                          aria-hidden="true"
                        >
                          <FontAwesomeIcon icon="check" className="h-3.5 w-3.5" />
                        </span>
                        <span className="text-sm sm:text-base text-neutral-high">{f}</span>
                      </li>
                    ))}
                  </ul>
                )}
                {hasCta && (
                  <a
                    href={hrefInfo.href}
                    target={hrefInfo.target}
                    rel={hrefInfo.target === '_blank' ? 'noopener noreferrer' : undefined}
                    className={`mt-auto inline-flex justify-center items-center px-5 py-2.5 text-sm font-medium rounded-lg text-on-standout bg-standout-medium hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-standout-medium/60`}
                    data-inline-type="link"
                    data-inline-path={`plans.${idx}.ctaUrl`}
                  >
                    <span data-inline-path={`plans.${idx}.ctaLabel`}>{plan.ctaLabel}</span>
                  </a>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
