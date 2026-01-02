import { motion } from 'framer-motion'
import { SiteLink } from '../site/components/SiteLink'
import { FontAwesomeIcon } from '../site/lib/icons'
import { useInlineValue } from '../components/inline-edit/InlineEditorContext'
import { getSectionStyles } from '../utils/colors'
import { SectionBackground } from '../components/SectionBackground'
import { THEME_OPTIONS } from '#modules/shared_fields'

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
  ctas?: Button[] | null
}

interface PricingProps {
  title: string
  subtitle?: string | null
  plans: PricingPlan[]
  theme?: string
  backgroundImage?: any
  backgroundTint?: boolean
  __moduleId?: string
  _useReact?: boolean
}

export default function Pricing({
  title: initialTitle,
  subtitle: initialSubtitle,
  plans: initialPlans,
  theme: initialTheme = 'low',
  backgroundImage: initialBackgroundImage,
  backgroundTint: initialBackgroundTint,
  __moduleId,
  _useReact,
}: PricingProps) {
  const title = useInlineValue(__moduleId, 'title', initialTitle)
  const subtitle = useInlineValue(__moduleId, 'subtitle', initialSubtitle)
  const plans = useInlineValue(__moduleId, 'plans', initialPlans)
  const theme = useInlineValue(__moduleId, 'theme', initialTheme) || initialTheme
  const backgroundImage = useInlineValue(__moduleId, 'backgroundImage', initialBackgroundImage)
  const backgroundTint = useInlineValue(__moduleId, 'backgroundTint', initialBackgroundTint)

  const styles = getSectionStyles(theme)
  const textColor = styles.textColor
  const subtextColor = styles.subtextColor

  const safePlans = Array.isArray(plans) ? plans.slice(0, 3) : []

  if (safePlans.length === 0) return null

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.18,
      },
    },
  }

  const itemVariants = {
    hidden: { opacity: 0, y: 40, scale: 0.95 },
    visible: {
      opacity: 1,
      y: 0,
      scale: 1,
      transition: {
        type: 'spring',
        damping: 18,
        stiffness: 90,
      },
    },
  }

  const headerContent = (
    <div className="max-w-3xl mx-auto text-center mb-10 sm:mb-12">
      {_useReact ? (
        <motion.h2
          initial={{ opacity: 0, y: -30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 1.0 }}
          className={`mb-4 text-3xl sm:text-4xl font-extrabold tracking-tight ${textColor}`}
          data-inline-path="title"
        >
          {title}
        </motion.h2>
      ) : (
        <h2
          className={`mb-4 text-3xl sm:text-4xl font-extrabold tracking-tight ${textColor}`}
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
            transition={{ duration: 1.0, delay: 0.25 }}
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

  const plansGrid = (
    <div className="space-y-8 lg:grid lg:grid-cols-3 sm:gap-6 lg:space-y-0">
      {safePlans.map((plan, idx) => {
        const isPrimary = !!plan.primary
        const hasFeatures = Array.isArray(plan.features) && plan.features.length > 0
        const hasCtas = Array.isArray(plan.ctas) && plan.ctas.length > 0

        const planCard = (
          <div
            className={`flex flex-col h-full p-6 mx-auto max-w-lg text-center ${styles.inverted ? 'bg-backdrop-low/10' : 'bg-backdrop-low'} rounded-lg border border-line-low shadow-sm xl:p-8 ${isPrimary ? 'ring-2 ring-standout-high shadow-md' : ''
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
              { name: 'primary', type: 'boolean', label: 'Highlight' },
            ])}
          >
            <h3 className={`mb-4 text-2xl font-semibold ${textColor}`}>
              <span data-inline-path={`plans.${idx}.name`}>{plan.name}</span>
            </h3>
            {plan.description && (
              <p className={`font-light text-sm sm:text-base ${subtextColor}`}>
                <span data-inline-path={`plans.${idx}.description`}>{plan.description}</span>
              </p>
            )}
            <div className="flex justify-center items-baseline my-8">
              <span className={`mr-2 text-4xl sm:text-5xl font-extrabold ${textColor}`}>
                $<span data-inline-path={`plans.${idx}.price`}>{plan.price}</span>
              </span>
              {plan.period && (
                <span className={`text-sm sm:text-base ${subtextColor}`}>
                  <span data-inline-path={`plans.${idx}.period`}>{plan.period}</span>
                </span>
              )}
            </div>
            {hasFeatures && (
              <ul role="list" className="mb-8 space-y-3 text-left">
                {plan.features!.map((f: string, fi: number) => (
                  <li key={fi} className="flex items-start space-x-3">
                    <span
                      className={`mt-0.5 inline-flex h-5 w-5 items-center justify-center rounded-full ${styles.inverted ? 'bg-success/20 text-success' : 'bg-success/10 text-success'}`}
                      aria-hidden="true"
                    >
                      <FontAwesomeIcon icon="check" size="sm" />
                    </span>
                    <span className={`text-sm sm:text-base ${textColor}`}>{f}</span>
                  </li>
                ))}
              </ul>
            )}
            {hasCtas && (
              <div className="mt-auto space-y-3">
                {plan.ctas!.map((cta, ci) => (
                  <PlanButton
                    key={ci}
                    {...cta}
                    inlineObjectPath={`plans.${idx}.ctas.${ci}`}
                    inlineObjectLabel={`Button ${ci + 1}`}
                  />
                ))}
              </div>
            )}
          </div>
        )

        return _useReact ? (
          <motion.div key={idx} variants={itemVariants} className="h-full">
            {planCard}
          </motion.div>
        ) : (
          <div key={idx} className="h-full">
            {planCard}
          </div>
        )
      })}
    </div>
  )

  return (
    <section
      className={`${styles.containerClasses} py-12 sm:py-16 relative overflow-hidden`}
      data-module="pricing"
      data-inline-type="background"
      data-inline-path="theme"
      data-inline-label="Background & Theme"
      data-inline-options={JSON.stringify(THEME_OPTIONS)}
    >
      <SectionBackground
        backgroundImage={backgroundImage}
        backgroundTint={backgroundTint}
        isInteractive={_useReact}
      />
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        {headerContent}
        {_useReact ? (
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-100px' }}
            variants={containerVariants}
          >
            {plansGrid}
          </motion.div>
        ) : (
          plansGrid
        )}
      </div>
    </section>
  )
}

function PlanButton({
  label,
  url,
  style = 'primary',
  target,
  inlineObjectPath,
  inlineObjectLabel,
}: Button & {
  inlineObjectPath?: string
  inlineObjectLabel?: string
}) {
  const styleClasses =
    {
      primary: 'text-on-high bg-standout-high hover:opacity-90',
      secondary: 'bg-backdrop-medium hover:bg-backdrop-high text-neutral-high',
      outline: 'border border-line-low hover:bg-backdrop-medium text-neutral-high',
    }[style] || 'text-on-high bg-standout-high hover:opacity-90'

  return (
    <SiteLink
      url={url}
      explicitTarget={target}
      className={`w-full inline-flex justify-center items-center px-5 py-2.5 text-sm font-medium rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-standout-high/60 transition-all active:scale-95 ${styleClasses}`}
      data-inline-type="object"
      data-inline-path={inlineObjectPath}
      data-inline-label={inlineObjectLabel}
      data-inline-fields={JSON.stringify([
        { name: 'label', type: 'text', label: 'Label' },
        { name: 'url', type: 'link', label: 'Destination' },
        {
          name: 'style',
          type: 'select',
          label: 'Style',
          options: [
            { label: 'Primary', value: 'primary' },
            { label: 'Secondary', value: 'secondary' },
            { label: 'Outline', value: 'outline' },
          ],
        },
      ])}
    >
      {label}
    </SiteLink>
  )
}
