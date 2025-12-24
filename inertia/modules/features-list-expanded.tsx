import { motion } from 'framer-motion'
import { FontAwesomeIcon } from '../site/lib/icons'
import { useInlineValue } from '../components/inline-edit/InlineEditorContext'
import type { Button, LinkValue } from './types'
import { resolveLink } from '../utils/resolve_link'

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
  __moduleId?: string
  _useReact?: boolean
}

function resolveHrefAndTarget(
  url: string | LinkValue,
  explicitTarget?: '_self' | '_blank'
): { href?: string; target: '_self' | '_blank' } {
  return resolveLink(url, explicitTarget)
}

export default function FeaturesListExpanded({
  title: initialTitle,
  subtitle: initialSubtitle,
  features: initialFeatures,
  cta: initialCta,
  backgroundColor = 'bg-backdrop-low',
  __moduleId,
  _useReact,
}: FeaturesListExpandedProps) {
  const title = useInlineValue(__moduleId, 'title', initialTitle)
  const subtitle = useInlineValue(__moduleId, 'subtitle', initialSubtitle)
  const features = useInlineValue(__moduleId, 'features', initialFeatures)
  const cta = useInlineValue(__moduleId, 'cta', initialCta)
  const bg = useInlineValue(__moduleId, 'backgroundColor', backgroundColor) || backgroundColor

  const isDarkBg = bg === 'bg-neutral-high'
  const textColor = isDarkBg ? 'text-backdrop-low' : 'text-neutral-high'
  const subtextColor = isDarkBg ? 'text-backdrop-low/80' : 'text-neutral-medium'
  const iconBg = isDarkBg ? 'bg-backdrop-low/10 text-backdrop-low' : 'bg-standout-medium/10 text-standout-medium'
  const lineStyle = isDarkBg ? 'border-backdrop-low/10' : 'border-line-low'

  const safeFeatures = Array.isArray(features) ? features.slice(0, 12) : []

  const hasCta = Boolean(cta && cta.label && cta.url)

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.2,
      },
    },
  }

  const itemVariants = (isEven: boolean) => ({
    hidden: { opacity: 0, x: isEven ? -30 : 30 },
    visible: {
      opacity: 1,
      x: 0,
      transition: { duration: 0.8, ease: 'easeOut' },
    },
  })

  const headerContent = (
    <div className="max-w-3xl mx-auto mb-10 text-center">
      {_useReact ? (
        <motion.h2
          initial={{ opacity: 0, y: -20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8 }}
          className={`text-3xl sm:text-4xl font-extrabold tracking-tight ${textColor} mb-4`}
          data-inline-path="title"
        >
          {title}
        </motion.h2>
      ) : (
        <h2
          className={`text-3xl sm:text-4xl font-extrabold tracking-tight ${textColor} mb-4`}
          data-inline-path="title"
        >
          {title}
        </h2>
      )}
      {subtitle &&
        (_useReact ? (
          <motion.p
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className={`${subtextColor} text-base sm:text-lg`}
            data-inline-path="subtitle"
          >
            {subtitle}
          </motion.p>
        ) : (
          <p className={`${subtextColor} text-base sm:text-lg`} data-inline-path="subtitle">
            {subtitle}
          </p>
        ))}
    </div>
  )

  const featuresList = (
    <>
      {safeFeatures.map((feature, idx) => {
        const isEven = idx % 2 === 0
        const featureItem = (
          <div
            className={`flex items-center lg:w-3/5 mx-auto border-b ${lineStyle} pb-10 mb-10 sm:flex-row flex-col ${
              !isEven ? 'sm:flex-row-reverse' : ''
            }`}
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
              <div
                className={`sm:w-32 sm:h-32 h-16 w-16 ${
                  isEven ? 'sm:mr-10' : 'sm:ml-10'
                } inline-flex items-center justify-center rounded-full ${iconBg} shrink-0`}
              >
                <FontAwesomeIcon icon={feature.icon as any} size="2x" />
              </div>
            )}

            <div className="grow sm:text-left text-center mt-6 sm:mt-0">
              <h3
                className={`${textColor} text-lg sm:text-xl font-semibold mb-2`}
                data-inline-path={`features.${idx}.title`}
              >
                {feature.title}
              </h3>
              <p
                className={`leading-relaxed text-sm sm:text-base ${subtextColor}`}
                data-inline-path={`features.${idx}.body`}
              >
                {feature.body}
              </p>
            </div>
          </div>
        )

        return _useReact ? (
          <motion.div key={idx} variants={itemVariants(isEven)} viewport={{ once: true, margin: '-50px' }}>
            {featureItem}
          </motion.div>
        ) : (
          <div key={idx}>{featureItem}</div>
        )
      })}
    </>
  )

  return (
    <section className={`${bg} py-12 sm:py-16`} data-module="features-list-expanded">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        {headerContent}

        {_useReact ? (
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-50px' }}
            variants={containerVariants}
          >
            {featuresList}
          </motion.div>
        ) : (
          featuresList
        )}

        {hasCta && cta && (
          <SectionButton
            label={cta?.label}
            url={cta?.url}
            style={cta?.style || 'primary'}
            target={cta?.target}
            rel={cta?.rel}
            inlinePath="cta"
            _useReact={_useReact}
            isDarkBg={isDarkBg}
          />
        )}
      </div>
    </section>
  )
}

function SectionButton({
  label,
  url,
  style = 'primary',
  target,
  rel,
  inlinePath,
  _useReact,
  isDarkBg,
}: Button & { inlinePath?: string; _useReact?: boolean; isDarkBg?: boolean }) {
  const styleClasses =
    {
      primary: isDarkBg ? 'bg-backdrop-low text-neutral-high' : 'bg-standout-medium text-on-standout',
      secondary: isDarkBg ? 'bg-backdrop-low/10 text-backdrop-low hover:bg-backdrop-low/20' : 'bg-backdrop-medium hover:bg-backdrop-high text-neutral-high',
      outline: isDarkBg ? 'border border-backdrop-low text-backdrop-low hover:bg-backdrop-low/10' : 'border border-line-low hover:bg-backdrop-medium text-neutral-high',
    }[style] || 'bg-standout-medium text-on-standout'

  const { href, target: finalTarget } = resolveHrefAndTarget(url, target)
  if (!href) return null

  const btn = (
    <a
      href={href}
      target={finalTarget}
      rel={finalTarget === '_blank' ? 'noopener noreferrer' : rel}
      className={`inline-flex items-center justify-center px-8 py-3 text-base font-medium rounded-lg transition-all duration-200 ${styleClasses} active:scale-95`}
      data-inline-type="link"
      data-inline-path={inlinePath ? `${inlinePath}.url` : undefined}
    >
      <span data-inline-path={inlinePath ? `${inlinePath}.label` : undefined}>{label}</span>
    </a>
  )

  return (
    <div className="flex justify-center mt-12">
      {_useReact ? (
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8, delay: 0.4 }}
        >
          {btn}
        </motion.div>
      ) : (
        btn
      )}
    </div>
  )
}

