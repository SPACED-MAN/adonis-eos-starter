import { useEffect, useRef, useState } from 'react'
import { motion, useSpring, useTransform, animate } from 'framer-motion'
import { useInlineValue } from '../components/inline-edit/InlineEditorContext'
import { getSectionStyles } from '../utils/colors'
import { SectionBackground } from '../components/SectionBackground'
import { THEME_OPTIONS } from '#modules/shared_fields'

interface StatItem {
  value: number
  suffix?: string | null
  label: string
}

interface StatisticsProps {
  stats: StatItem[]
  theme?: string
  _useReact?: boolean
}

function Counter({
  value,
  shouldStart,
  suffix,
}: {
  value: number
  shouldStart: boolean
  suffix?: string | null
}) {
  const count = useSpring(0, {
    stiffness: 100,
    damping: 30,
    restDelta: 0.001,
  })

  useEffect(() => {
    if (shouldStart) {
      count.set(value)
    }
  }, [shouldStart, value, count])

  const display = useTransform(count, (latest) => {
    const v = Math.round(latest)
    if (value >= 1_000_000_000) return `${Math.round(v / 1_000_000_000)}B`
    if (value >= 1_000_000) return `${Math.round(v / 1_000_000)}M`
    if (value >= 1_000) return `${Math.round(v / 1_000)}K`
    return v.toLocaleString()
  })

  return (
    <motion.dt className="mb-2 text-3xl md:text-4xl font-extrabold">
      <motion.span>{display}</motion.span>
      {suffix ? suffix : ''}
    </motion.dt>
  )
}

export default function Statistics({
  stats,
  theme: initialTheme = 'low',
  _useReact,
  __moduleId,
}: StatisticsProps & { __moduleId?: string }) {
  const [hasEntered, setHasEntered] = useState(false)
  const sectionRef = useRef<HTMLElement | null>(null)
  const theme = useInlineValue(__moduleId, 'theme', initialTheme) || initialTheme

  const styles = getSectionStyles(theme)
  const textColor = styles.textColor
  const subtextColor = styles.subtextColor

  useEffect(() => {
    if (!_useReact) return
    const el = sectionRef.current
    if (!el) return

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setHasEntered(true)
            observer.disconnect()
            break
          }
        }
      },
      {
        threshold: 0.3,
      }
    )

    observer.observe(el)
    return () => observer.disconnect()
  }, [_useReact])

  const safeStats = Array.isArray(stats) ? stats.slice(0, 12) : []

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
    hidden: { opacity: 0, scale: 0.9, y: 30 },
    visible: {
      opacity: 1,
      scale: 1,
      y: 0,
      transition: { duration: 1.0, ease: 'easeOut' },
    },
  }

  const formatStatic = (val: number) => {
    if (val >= 1_000_000_000) return `${Math.round(val / 1_000_000_000)}B`
    if (val >= 1_000_000) return `${Math.round(val / 1_000_000)}M`
    if (val >= 1_000) return `${Math.round(val / 1_000)}K`
    return val.toLocaleString()
  }

  const content = (
    <div className="max-w-screen-xl px-4 mx-auto text-center">
      <dl className={`grid max-w-screen-md gap-8 mx-auto ${textColor} sm:grid-cols-3`}>
        {safeStats.map((stat, idx) => {
          const item = (
            <div key={idx} className="flex flex-col items-center justify-center">
              {_useReact ? (
                <Counter value={stat.value} shouldStart={hasEntered} suffix={stat.suffix} />
              ) : (
                <dt className="mb-2 text-3xl md:text-4xl font-extrabold">
                  {formatStatic(stat.value)}
                  {stat.suffix ? stat.suffix : ''}
                </dt>
              )}
              <dd className={`font-light ${subtextColor}`}>{stat.label}</dd>
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
      </dl>
    </div>
  )

  if (_useReact) {
    return (
      <motion.section
        ref={sectionRef}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, margin: '-100px' }}
        variants={containerVariants}
        className={`${styles.containerClasses} py-12 lg:py-16 relative overflow-hidden`}
        data-module="statistics"
        data-inline-type="select"
        data-inline-path="theme"
        data-inline-label="Theme"
        data-inline-options={JSON.stringify(THEME_OPTIONS)}
      >
        <SectionBackground component={styles.backgroundComponent} />
        <div className="relative z-10">{content}</div>
      </motion.section>
    )
  }

  return (
    <section
      ref={sectionRef}
      className={`${styles.containerClasses} py-12 lg:py-16 relative overflow-hidden`}
      data-module="statistics"
      data-inline-type="select"
      data-inline-path="theme"
      data-inline-label="Theme"
      data-inline-options={JSON.stringify(THEME_OPTIONS)}
    >
      <SectionBackground component={styles.backgroundComponent} />
      <div className="relative z-10">{content}</div>
    </section>
  )
}
