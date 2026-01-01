import { motion, useScroll, useTransform, useSpring } from 'framer-motion'
import { useRef } from 'react'
import { useInlineValue, useInlineField } from '../components/inline-edit/InlineEditorContext'
import { MediaRenderer } from '../components/MediaRenderer'
import { getSectionStyles } from '../utils/colors'
import { SectionBackground } from '../components/SectionBackground'
import { THEME_OPTIONS } from '#modules/shared_fields'

interface HeroWithImmersionProps {
  title: string
  subtitle?: string
  backgroundImage?: any
  foregroundImage?: any
  imagePosition?: 'left' | 'right'
  height?: string
  parallaxIntensity?: 'subtle' | 'moderate' | 'dramatic'
  theme?: string
  __moduleId?: string
  _useReact?: boolean
}

export default function HeroWithImmersion({
  title: initialTitle,
  subtitle: initialSubtitle,
  backgroundImage,
  foregroundImage,
  imagePosition = 'right',
  height = 'h-screen',
  parallaxIntensity = 'moderate',
  theme: initialTheme = 'high',
  __moduleId,
  _useReact,
}: HeroWithImmersionProps) {
  const containerRef = useRef<HTMLElement>(null)

  const { value: title, show: showTitle, props: titleProps } = useInlineField(__moduleId, 'title', initialTitle, { label: 'Title' })
  const { value: subtitle, show: showSubtitle, props: subtitleProps } = useInlineField(__moduleId, 'subtitle', initialSubtitle, { label: 'Subtitle' })
  const bgImage = useInlineValue(__moduleId, 'backgroundImage', backgroundImage)
  const fgImage = useInlineValue(__moduleId, 'foregroundImage', foregroundImage)
  const imagePos = useInlineValue(__moduleId, 'imagePosition', imagePosition) || imagePosition
  const intensityValue = useInlineValue(__moduleId, 'parallaxIntensity', parallaxIntensity)
  const theme = useInlineValue(__moduleId, 'theme', initialTheme) || initialTheme
  const styles = getSectionStyles(theme)

  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ['start start', 'end start'],
  })

  // Smooth out the scroll progress to remove "choppiness"
  const smoothScrollProgress = useSpring(scrollYProgress, {
    stiffness: 100,
    damping: 30,
    restDelta: 0.001,
  })

  // Intensity multipliers for depth effect
  const multipliers = {
    subtle: { bg: 0.05, mid: 0.15, fg: 0.25 },
    moderate: { bg: 0.15, mid: 0.35, fg: 0.55 },
    dramatic: { bg: 0.3, mid: 0.7, fg: 1.1 },
  }

  const m = multipliers[intensityValue as keyof typeof multipliers] || multipliers.moderate

  // Transform values based on smooth scroll
  const bgY = useTransform(smoothScrollProgress, [0, 1], ['0%', `${m.bg * 100}%`])
  const midY = useTransform(smoothScrollProgress, [0, 1], ['0%', `${-m.mid * 100}%`])
  const fgY = useTransform(smoothScrollProgress, [0, 1], ['0%', `${-m.fg * 100}%`])
  const opacity = useTransform(smoothScrollProgress, [0, 0.7], [1, 0])
  const scale = useTransform(smoothScrollProgress, [0, 1], [1, 1.1])

  const renderContent = (isInteractive: boolean) => {
    const Container = isInteractive ? motion.div : 'div'
    const Title = isInteractive ? motion.h1 : 'h1'
    const Subtitle = isInteractive ? motion.p : 'p'
    const Foreground = isInteractive ? motion.div : 'div'
    const Background = isInteractive ? motion.div : 'div'

    return (
      <div className="relative w-full h-full flex items-center justify-center overflow-hidden">
        {/* Background Layer (Full Width) */}
        <Background
          // @ts-ignore
          style={isInteractive ? { y: bgY, scale } : {}}
          className="absolute inset-0 z-0"
        >
          {bgImage ? (
            <MediaRenderer
              image={bgImage}
              className="w-full h-full"
              objectFit="cover"
              // @ts-ignore
              fetchPriority="high"
            />
          ) : (
            <div className={`w-full h-full ${styles.containerClasses}`} />
          )}
          <div className="absolute inset-0 bg-black/40" />
        </Background>

        {/* 2-Column Grid for Content and Foreground */}
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 relative z-10 w-full h-full py-12 lg:py-20 flex items-center">
          <div className="grid lg:grid-cols-2 gap-12 items-center w-full">
            {/* Text Column */}
            <Container
              // @ts-ignore
              style={isInteractive ? { y: midY, opacity } : {}}
              className={`text-center lg:text-left space-y-8 ${imagePos === 'left' ? 'lg:order-2' : 'lg:order-1'}`}
            >
              {showTitle && (
              <Title
                className="text-5xl md:text-7xl lg:text-8xl xl:text-9xl font-black text-neutral-high tracking-tighter drop-shadow-[0_10px_10px_rgba(0,0,0,0.5)] leading-[0.9]"
                  {...titleProps}
              >
                {title}
              </Title>
              )}
              {showSubtitle && (
                <Subtitle
                  className="text-xl md:text-2xl lg:text-3xl text-neutral-high/90 font-medium max-w-2xl drop-shadow-md"
                  {...subtitleProps}
                >
                  {subtitle}
                </Subtitle>
              )}
            </Container>

            {/* Foreground Image Column */}
            <div className={`relative h-[40vh] lg:h-full flex items-center justify-center ${imagePos === 'left' ? 'lg:justify-start lg:order-1' : 'lg:justify-end lg:order-2'}`}>
              {fgImage && (
                <Foreground
                  // @ts-ignore
                  style={isInteractive ? { y: fgY } : {}}
                  className={`w-full h-full pointer-events-none flex items-center justify-center ${imagePos === 'left' ? 'lg:items-end lg:justify-start' : 'lg:items-end lg:justify-end'}`}
                >
                  <div className="w-full h-full max-h-[70vh]">
                    <MediaRenderer
                      image={fgImage}
                      className="w-full h-full object-bottom"
                      objectFit="contain"
                    />
                  </div>
                </Foreground>
              )}
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <section
      ref={containerRef}
      className={`relative ${height} overflow-hidden ${styles.containerClasses}`}
      data-module="hero-with-immersion"
      data-inline-type="select"
      data-inline-path="theme"
      data-inline-label="Theme"
      data-inline-options={JSON.stringify(THEME_OPTIONS)}
    >
      <SectionBackground component={styles.backgroundComponent} />
      {renderContent(!!_useReact)}
    </section>
  )
}

