import { motion } from 'framer-motion'
import { useInlineValue, useInlineField } from '../components/inline-edit/InlineEditorContext'

interface HeroProps {
  title: string
  subtitle?: string | null
  backgroundColor?: string
  __moduleId?: string
  _useReact?: boolean
}

export default function Hero({
  title: initialTitle,
  subtitle: initialSubtitle,
  backgroundColor = 'bg-backdrop-low',
  __moduleId,
  _useReact,
}: HeroProps) {
  const { value: title, show: showTitle, props: titleProps } = useInlineField(__moduleId, 'title', initialTitle, { label: 'Title' })
  const { value: subtitle, show: showSubtitle, props: subtitleProps } = useInlineField(__moduleId, 'subtitle', initialSubtitle, { label: 'Subtitle' })
  const bg = useInlineValue(__moduleId, 'backgroundColor', backgroundColor) || backgroundColor

  const isDarkBg = bg === 'bg-neutral-high' || bg === 'bg-backdrop-high' || bg === 'bg-standout-medium'
  const textColor = isDarkBg ? 'text-on-high' : 'text-neutral-high'
  const subtextColor = isDarkBg ? 'text-on-high/80' : 'text-neutral-medium'

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
        className={`${bg} py-12 lg:py-16`}
        data-module="hero"
      >
        {content}
      </motion.section>
    )
  }

  return (
    <section className={`${bg} py-12 lg:py-16`} data-module="hero">
      {content}
    </section>
  )
}
