import { FontAwesomeIcon } from '../site/lib/icons'
import { useInlineValue } from '../components/inline-edit/InlineEditorContext'

interface FeatureItem {
  icon?: string | null
  title: string
  body: string
}

interface FeaturesListProps {
  title: string
  subtitle?: string | null
  features: FeatureItem[]
  backgroundColor?: string
  __moduleId?: string
}

export default function FeaturesList({
  title: initialTitle,
  subtitle: initialSubtitle,
  features: initialFeatures,
  backgroundColor = 'bg-backdrop-low',
  __moduleId,
}: FeaturesListProps) {
  const title = useInlineValue(__moduleId, 'title', initialTitle)
  const subtitle = useInlineValue(__moduleId, 'subtitle', initialSubtitle)
  const features = useInlineValue(__moduleId, 'features', initialFeatures)

  const safeFeatures = Array.isArray(features) ? features.slice(0, 24) : []

  return (
    <section className={`${backgroundColor} py-12 sm:py-16`} data-module="features-list">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="max-w-2xl lg:max-w-3xl mb-8 lg:mb-12">
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

        {safeFeatures.length > 0 && (
          <div className="space-y-8 md:grid md:grid-cols-2 lg:grid-cols-3 md:gap-8 md:space-y-0">
            {safeFeatures.map((feature, idx) => (
              <div
                key={idx}
                className="flex flex-col"
                data-inline-type="object"
                data-inline-path={`features.${idx}`}
                data-inline-label={`Feature ${idx + 1}`}
                data-inline-fields={JSON.stringify([
                  {
                    name: 'icon',
                    type: 'select',
                    label: 'Icon',
                    options: [
                      { label: 'check', value: 'check' },
                      { label: 'bolt', value: 'bolt' },
                      { label: 'gear', value: 'gear' },
                      { label: 'circle-question', value: 'circle-question' },
                      { label: 'rocket', value: 'rocket' },
                      { label: 'palette', value: 'palette' },
                    ],
                  },
                  { name: 'title', type: 'text', label: 'Title' },
                  { name: 'body', type: 'textarea', label: 'Body' },
                ])}
              >
                {feature.icon && (
                  <div className="flex justify-center items-center mb-4 w-10 h-10 lg:w-12 lg:h-12 rounded-full bg-standout-medium/10 text-standout-medium">
                    <FontAwesomeIcon icon={feature.icon as any} className="text-base lg:text-lg" />
                  </div>
                )}
                <h3
                  className="mb-2 text-lg sm:text-xl font-semibold text-neutral-high"
                  data-inline-path={`features.${idx}.title`}
                >
                  {feature.title}
                </h3>
                <p
                  className="text-sm sm:text-base text-neutral-medium"
                  data-inline-path={`features.${idx}.body`}
                >
                  {feature.body}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  )
}
