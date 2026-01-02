import { motion, type Variants } from 'framer-motion'
import { FontAwesomeIcon } from '../site/lib/icons'
import { useInlineValue } from '../components/inline-edit/InlineEditorContext'
import type { Button } from './types'
import { getSectionStyles } from '../utils/colors'
import { SectionBackground } from '../components/SectionBackground'
import { SiteLink } from '../site/components/SiteLink'
import { THEME_OPTIONS } from '#modules/shared_fields'

interface ExpandedFeatureItem {
  icon?: string | null
  title: string
  body: string
}

interface FeaturesListExpandedProps {
  title: string
  subtitle?: string | null
  features: ExpandedFeatureItem[]
  ctas?: Button[] | null
  theme?: string
  backgroundImage?: any
  backgroundTint?: boolean
  __moduleId?: string
  _useReact?: boolean
}

export default function FeaturesListExpanded({
  title: initialTitle,
  subtitle: initialSubtitle,
  features: initialFeatures,
  ctas: initialCtas,
  theme: initialTheme = 'low',
  backgroundImage: initialBackgroundImage,
  backgroundTint: initialBackgroundTint,
  __moduleId,
  _useReact,
}: FeaturesListExpandedProps) {
  const title = useInlineValue(__moduleId, 'title', initialTitle)
  const subtitle = useInlineValue(__moduleId, 'subtitle', initialSubtitle)
  const features = useInlineValue(__moduleId, 'features', initialFeatures)
  const ctas = useInlineValue(__moduleId, 'ctas', initialCtas)
  const theme = useInlineValue(__moduleId, 'theme', initialTheme) || initialTheme
  const backgroundImage = useInlineValue(__moduleId, 'backgroundImage', initialBackgroundImage)
  const backgroundTint = useInlineValue(__moduleId, 'backgroundTint', initialBackgroundTint)

  const styles = getSectionStyles(theme)
  const textColor = styles.textColor
  const subtextColor = styles.subtextColor
  const inverted = styles.inverted
  const iconBg = inverted
    ? 'bg-on-high/10 text-on-high'
    : 'bg-standout-high/10 text-standout-high'
  const lineStyle = inverted ? 'border-on-high/10' : 'border-line-low'

  const safeFeatures = Array.isArray(features) ? features.slice(0, 12) : []

  const hasCtas = Boolean(ctas && ctas.length > 0)

  const containerVariants: Variants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.2,
      },
    },
  }

  const itemVariants = (isEven: boolean): Variants => ({
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
            className={`flex items-center lg:w-4/6 mx-auto border-b ${lineStyle} pb-10 mb-10 sm:flex-row flex-col ${!isEven ? 'sm:flex-row-reverse' : ''
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
                className={`sm:w-32 sm:h-32 h-16 w-16 ${isEven ? 'sm:mr-10' : 'sm:ml-10'
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
          <motion.div
            key={idx}
            variants={itemVariants(isEven)}
            viewport={{ once: true, margin: '-50px' }}
          >
            {featureItem}
          </motion.div>
        ) : (
          <div key={idx}>{featureItem}</div>
        )
      })}
    </>
  )

  return (
    <section
      className={`${styles.containerClasses} py-12 sm:py-16 relative overflow-hidden`}
      data-module="features-list-expanded"
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
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
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

        {hasCtas && (
          <div className="flex flex-wrap justify-center items-center gap-4 mt-12">
            {ctas?.map((cta: Button, index: number) => (
              <SectionButton
                key={index}
                {...cta}
                inlinePath={`ctas.${index}`}
                inlineLabel={`Button ${index + 1}`}
                _useReact={_useReact}
                inverted={inverted}
              />
            ))}
          </div>
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
  inlinePath,
  inlineLabel,
  _useReact,
  inverted,
}: Button & {
  inlinePath?: string
  inlineLabel?: string
  _useReact?: boolean
  inverted?: boolean
}) {
  const styleClasses =
    {
      primary: inverted ? 'bg-backdrop-low text-neutral-high' : 'bg-standout-high text-on-high',
      secondary: inverted
        ? 'bg-on-high/10 text-on-high hover:bg-on-high/20'
        : 'bg-backdrop-medium hover:bg-backdrop-high text-neutral-high',
      outline: inverted
        ? 'border border-on-high text-on-high hover:bg-on-high/10'
        : 'border border-line-low hover:bg-backdrop-medium text-neutral-high',
    }[style] || 'bg-standout-high text-on-high'

  const btn = (
    <SiteLink
      url={url}
      explicitTarget={target}
      className={`inline-flex items-center justify-center px-8 py-3 text-base font-medium rounded-lg transition-all duration-200 ${styleClasses} active:scale-95`}
      data-inline-type="object"
      data-inline-path={inlinePath}
      data-inline-label={inlineLabel}
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

  if (!_useReact) return btn

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      whileInView={{ opacity: 1, scale: 1 }}
      viewport={{ once: true }}
      transition={{ duration: 0.8, delay: 0.4 }}
    >
      {btn}
    </motion.div>
  )
}
