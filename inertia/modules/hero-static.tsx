/**
 * Hero Module - Static Variant
 * 
 * Pure SSR component (no hydration, max performance)
 * Use for simple hero sections with text, image, and links
 * 
 * Located in inertia/modules/ (shared between admin preview and public site)
 * Naming convention: -static suffix indicates pure SSR rendering
 */

import type { Button, TextAlignment } from './types'

interface HeroStaticProps {
  title: string
  subtitle?: string
  alignment?: TextAlignment
  image?: string
  imagePosition?: 'center' | 'top' | 'bottom'
  primaryCta?: Button
  secondaryCta?: Button
  backgroundColor?: string
  minHeight?: string
}

export default function HeroStatic({
  title,
  subtitle,
  alignment = 'center',
  image,
  imagePosition = 'center',
  primaryCta,
  secondaryCta,
  backgroundColor = 'bg-sand-50 dark:bg-sand-900',
  minHeight = 'min-h-[70vh]',
}: HeroStaticProps) {
  const alignmentClasses = {
    left: 'text-left items-start',
    center: 'text-center items-center',
    right: 'text-right items-end',
  }[alignment]

  const ctaAlignment = {
    left: 'justify-start',
    center: 'justify-center',
    right: 'justify-end',
  }[alignment]

  return (
    <section
      className={`relative ${backgroundColor} ${minHeight} flex items-center justify-center overflow-hidden`}
      data-module="hero"
    >
      {/* Background Image */}
      {image && (
        <div className="absolute inset-0">
          <img
            src={image}
            alt=""
            className={`w-full h-full object-cover object-${imagePosition}`}
            loading="lazy"
          />
          <div className="absolute inset-0 bg-sand-900/20 dark:bg-sand-900/40"></div>
        </div>
      )}

      {/* Content */}
      <div className="relative z-10 container mx-auto px-4 sm:px-6 lg:px-8">
        <div className={`flex flex-col ${alignmentClasses} max-w-4xl mx-auto`}>
          {/* Title */}
          <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold text-sand-900 dark:text-sand-50 mb-6">
            {title}
          </h1>

          {/* Subtitle */}
          {subtitle && (
            <p className="text-xl sm:text-2xl text-sand-700 dark:text-sand-300 mb-8 max-w-2xl">
              {subtitle}
            </p>
          )}

          {/* CTAs */}
          {(primaryCta || secondaryCta) && (
            <div className={`flex flex-col sm:flex-row gap-4 ${ctaAlignment}`}>
              {primaryCta && <ButtonComponent {...primaryCta} />}
              {secondaryCta && <ButtonComponent {...secondaryCta} />}
            </div>
          )}
        </div>
      </div>
    </section>
  )
}

/**
 * Button Component
 * Reusable button component for CTAs and actions
 */
function ButtonComponent({ label, url, style = 'primary', target = '_self', rel }: Button) {
  const styleClasses = {
    primary:
      'bg-sand-900 hover:bg-sand-800 text-sand-50 dark:bg-sand-50 dark:hover:bg-sand-100 dark:text-sand-900',
    secondary:
      'bg-sand-700 hover:bg-sand-600 text-sand-50 dark:bg-sand-300 dark:hover:bg-sand-200 dark:text-sand-900',
    outline:
      'border-2 border-sand-900 hover:bg-sand-900 text-sand-900 hover:text-sand-50 dark:border-sand-50 dark:hover:bg-sand-50 dark:text-sand-50 dark:hover:text-sand-900',
  }[style]

  return (
    <a
      href={url}
      target={target}
      rel={rel}
      className={`inline-flex items-center justify-center px-8 py-4 text-lg font-semibold rounded-lg transition-colors duration-200 ${styleClasses}`}
    >
      {label}
    </a>
  )
}

