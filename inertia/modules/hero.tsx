import { motion } from 'framer-motion'
import { useInlineValue, useInlineField } from '../components/inline-edit/InlineEditorContext'
import { getSectionStyles } from '../utils/colors'
import { SectionBackground } from '../components/SectionBackground'
import { THEME_OPTIONS } from '#modules/shared_fields'

interface HeroProps {
  title: string
  subtitle?: string | null
  theme?: string
  backgroundImage?: any
  backgroundTint?: boolean
  __moduleId?: string
  _useReact?: boolean
}

export default function Hero({
  title: initialTitle,
  subtitle: initialSubtitle,
  theme: initialTheme = 'low',
  backgroundImage: initialBackgroundImage,
  backgroundTint: initialBackgroundTint,
  __moduleId,
  _useReact,
}: HeroProps) {
  const { value: title, show: showTitle, props: titleProps } = useInlineField(__moduleId, 'title', initialTitle, { label: 'Title' })
  const { value: subtitle, show: showSubtitle, props: subtitleProps } = useInlineField(__moduleId, 'subtitle', initialSubtitle, { label: 'Subtitle' })
  const theme = useInlineValue(__moduleId, 'theme', initialTheme) || initialTheme
  const backgroundImage = useInlineValue(__moduleId, 'backgroundImage', initialBackgroundImage)
  const backgroundTint = useInlineValue(__moduleId, 'backgroundTint', initialBackgroundTint)

  const styles = getSectionStyles(theme)
  const textColor = styles.textColor
  const subtextColor = styles.subtextColor

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
          component={styles.backgroundComponent}
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
        component={styles.backgroundComponent}
        backgroundImage={backgroundImage}
        backgroundTint={backgroundTint}
        isInteractive={_useReact}
      />
      {content}
    </section>
  )
}
