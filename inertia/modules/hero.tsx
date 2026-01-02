import { motion } from 'framer-motion'
import type { Button } from './types'
import { useInlineValue, useInlineField } from '../components/inline-edit/InlineEditorContext'
import { getSectionStyles } from '../utils/colors'
import { SectionBackground } from '../components/SectionBackground'
import { SiteLink } from '../site/components/SiteLink'
import { THEME_OPTIONS } from '#modules/shared_fields'

interface HeroProps {
  title: string
  subtitle?: string | null
  ctas?: Button[] | null
  theme?: string
  backgroundImage?: any
  backgroundTint?: boolean
  __moduleId?: string
  _useReact?: boolean
}

export default function Hero({
  title: initialTitle,
  subtitle: initialSubtitle,
  ctas: initialCtas,
  theme: initialTheme = 'low',
  backgroundImage: initialBackgroundImage,
  backgroundTint: initialBackgroundTint,
  __moduleId,
  _useReact,
}: HeroProps) {
  const { value: title, show: showTitle, props: titleProps } = useInlineField(__moduleId, 'title', initialTitle, { label: 'Title' })
  const { value: subtitle, show: showSubtitle, props: subtitleProps } = useInlineField(__moduleId, 'subtitle', initialSubtitle, { label: 'Subtitle' })
  const ctas = useInlineValue(__moduleId, 'ctas', initialCtas)
  const theme = useInlineValue(__moduleId, 'theme', initialTheme) || initialTheme
  const backgroundImage = useInlineValue(__moduleId, 'backgroundImage', initialBackgroundImage)
  const backgroundTint = useInlineValue(__moduleId, 'backgroundTint', initialBackgroundTint)

  const styles = getSectionStyles(theme)
  const textColor = styles.textColor
  const subtextColor = styles.subtextColor

  const hasCtas = Boolean(ctas && ctas.length > 0)

  const containerVariants = {
    hidden: { opacity: 0, y: 30 },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        duration: 1.0,
        staggerChildren: 0.25,
      },
    },
  }

  const itemVariants = {
    hidden: { opacity: 0, y: 30 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 1.0 },
    },
  }

  const content = (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-12 text-center">
      {showTitle &&
        (_useReact ? (
          <motion.h1
            variants={itemVariants}
            className={`mb-4 text-4xl font-extrabold tracking-tight leading-tight ${textColor} md:text-5xl lg:text-6xl`}
            {...titleProps}
          >
            {title}
          </motion.h1>
        ) : (
          <h1
            className={`mb-4 text-4xl font-extrabold tracking-tight leading-tight ${textColor} md:text-5xl lg:text-6xl`}
            {...titleProps}
          >
            {title}
          </h1>
        ))}

      {showSubtitle &&
        (_useReact ? (
          <motion.p
            variants={itemVariants}
            className={`mb-8 text-lg font-normal ${subtextColor} lg:text-xl sm:px-4`}
            {...subtitleProps}
          >
            {subtitle}
          </motion.p>
        ) : (
          <p
            className={`mb-8 text-lg font-normal ${subtextColor} lg:text-xl sm:px-4`}
            {...subtitleProps}
          >
            {subtitle}
          </p>
        ))}

      {hasCtas && (
        <div className="flex flex-col space-y-4 sm:flex-row sm:justify-center sm:space-y-0 sm:space-x-4">
          {ctas?.map((cta, index) => (
            _useReact ? (
              <motion.div key={index} variants={itemVariants}>
                <ButtonComponent
                  {...cta}
                  moduleId={__moduleId}
                  inlineObjectPath={`ctas.${index}`}
                  inlineObjectLabel={`Button ${index + 1}`}
                  inverted={styles.inverted}
                />
              </motion.div>
            ) : (
              <ButtonComponent
                key={index}
                {...cta}
                moduleId={__moduleId}
                inlineObjectPath={`ctas.${index}`}
                inlineObjectLabel={`Button ${index + 1}`}
                inverted={styles.inverted}
              />
            )
          ))}
        </div>
      )}
    </div>
  )

  if (_useReact) {
    return (
      <motion.section
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, margin: '-100px' }}
        variants={containerVariants}
        className={`${styles.containerClasses} py-12 lg:py-16 relative overflow-hidden`}
        data-module="hero"
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
        {content}
      </motion.section>
    )
  }

  return (
    <section
      className={`${styles.containerClasses} py-12 lg:py-16 relative overflow-hidden`}
      data-module="hero"
      data-inline-type="select"
      data-inline-path="theme"
      data-inline-label="Theme"
      data-inline-options={JSON.stringify(THEME_OPTIONS)}
    >
      <SectionBackground
        backgroundImage={backgroundImage}
        backgroundTint={backgroundTint}
        isInteractive={_useReact}
      />
      {content}
    </section>
  )
}

// Define the CTA object schema for inline editing
const ctaObjectFields = JSON.stringify([
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
])

interface ButtonComponentProps extends Button {
  moduleId?: string
  inlineObjectPath?: string
  inlineObjectLabel?: string
  inverted?: boolean
}

function ButtonComponent({
  label: initialLabel,
  url: initialUrl,
  style: initialStyle = 'primary',
  target,
  rel,
  moduleId,
  inlineObjectPath,
  inlineObjectLabel,
  inverted,
}: ButtonComponentProps) {
  // Use inline values so edits reflect immediately
  const obj = useInlineValue(moduleId, inlineObjectPath || '', {
    label: initialLabel,
    url: initialUrl,
    style: initialStyle,
  })
  const label = obj?.label ?? initialLabel
  const url = obj?.url ?? initialUrl
  const style: 'primary' | 'secondary' | 'outline' = obj?.style ?? initialStyle

  const styleMap = {
    primary: inverted
      ? 'bg-backdrop-low text-neutral-high hover:bg-backdrop-low/90'
      : 'bg-standout-high text-on-high hover:bg-standout-high/90',
    secondary: inverted
      ? 'bg-on-high/10 text-on-high hover:bg-on-high/20'
      : 'bg-backdrop-medium hover:bg-backdrop-high text-neutral-high',
    outline: inverted
      ? 'border border-on-high text-on-high hover:bg-on-high/10'
      : 'border border-line-low hover:bg-backdrop-medium text-neutral-high',
  }
  const styleClasses = styleMap[style] || styleMap.primary

  return (
    <SiteLink
      url={url}
      explicitTarget={target}
      className={`inline-flex items-center justify-center px-5 py-3 text-base font-medium rounded-lg transition-all active:scale-95 ${styleClasses} focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-standout-high relative group`}
      data-inline-type="object"
      data-inline-path={inlineObjectPath}
      data-inline-label={inlineObjectLabel}
      data-inline-fields={ctaObjectFields}
    >
      {label}
    </SiteLink>
  )
}
