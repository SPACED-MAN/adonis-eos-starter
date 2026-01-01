import { motion } from 'framer-motion'
import { FontAwesomeIcon } from '../site/lib/icons'
import { useInlineValue } from '../components/inline-edit/InlineEditorContext'
import { getSectionStyles } from '../utils/colors'
import { SectionBackground } from '../components/SectionBackground'
import { THEME_OPTIONS } from '#modules/shared_fields'

interface FeatureItem {
  icon?: string | null
  title: string
  body: string
}

interface FeaturesListProps {
  title: string
  subtitle?: string | null
  features: FeatureItem[]
  theme?: string
  backgroundImage?: any
  backgroundTint?: boolean
  __moduleId?: string
  _useReact?: boolean
}

export default function FeaturesList({
  title: initialTitle,
  subtitle: initialSubtitle,
  features: initialFeatures,
  theme: initialTheme = 'low',
  backgroundImage: initialBackgroundImage,
  backgroundTint: initialBackgroundTint,
  __moduleId,
  _useReact,
}: FeaturesListProps) {
  const title = useInlineValue(__moduleId, 'title', initialTitle)
  const subtitle = useInlineValue(__moduleId, 'subtitle', initialSubtitle)
  const features = useInlineValue(__moduleId, 'features', initialFeatures)
  const theme = useInlineValue(__moduleId, 'theme', initialTheme) || initialTheme
  const backgroundImage = useInlineValue(__moduleId, 'backgroundImage', initialBackgroundImage)
  const backgroundTint = useInlineValue(__moduleId, 'backgroundTint', initialBackgroundTint)

  const styles = getSectionStyles(theme)
  const textColor = styles.textColor
  const subtextColor = styles.subtextColor
  const iconBg = styles.inverted
    ? 'bg-on-high/10 text-on-high'
    : 'bg-standout-high/10 text-standout-high'

  const safeFeatures = Array.isArray(features) ? features.slice(0, 24) : []

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.12,
      },
    },
  }

  const itemVariants = {
    hidden: { opacity: 0, y: 30 },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        duration: 1.0,
        ease: 'easeOut',
      },
    },
  }

  const headerContent = (
    <div className="max-w-2xl lg:max-w-3xl mb-8 lg:mb-12">
      {_useReact ? (
        <motion.h2
          initial={{ opacity: 0, x: -30 }}
          whileInView={{ opacity: 1, x: 0 }}
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
            initial={{ opacity: 0, x: -30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 1.0, delay: 0.15 }}
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

  const gridContent = safeFeatures.length > 0 && (
    <div className="space-y-8 md:grid md:grid-cols-2 lg:grid-cols-3 md:gap-8 md:space-y-0">
      {safeFeatures.map((feature, idx) => {
        const item = (
          <div
            className="flex flex-col h-full"
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
                className={`flex justify-center items-center mb-4 w-10 h-10 lg:w-12 lg:h-12 rounded-full ${iconBg}`}
              >
                <FontAwesomeIcon icon={feature.icon as any} className="text-base lg:text-lg" />
              </div>
            )}
            <h3
              className={`mb-2 text-lg sm:text-xl font-semibold ${textColor}`}
              data-inline-path={`features.${idx}.title`}
            >
              {feature.title}
            </h3>
            <p
              className={`text-sm sm:text-base ${subtextColor}`}
              data-inline-path={`features.${idx}.body`}
            >
              {feature.body}
            </p>
          </div>
        )

        return _useReact ? (
          <motion.div key={idx} variants={itemVariants}>
            {item}
          </motion.div>
        ) : (
          <div key={idx}>{item}</div>
        )
      })}
    </div>
  )

  return (
    <section
      className={`${styles.containerClasses} py-12 sm:py-16 relative overflow-hidden`}
      data-module="features-list"
      data-inline-type="background"
      data-inline-path="theme"
      data-inline-label="Background & Theme"
      data-inline-options={JSON.stringify(THEME_OPTIONS)}
    >
      <SectionBackground
        component={styles.backgroundComponent}
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
            viewport={{ once: true, margin: '-100px' }}
            variants={containerVariants}
          >
            {gridContent}
          </motion.div>
        ) : (
          gridContent
        )}
      </div>
    </section>
  )
}
