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
  backgroundColor = 'bg-backdrop-low',
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
            loading="eager"
            decoding="async"
            fetchPriority="high"
          />
          <div className="absolute inset-0 bg-[rgba(0,0,0,0.2)] dark:bg-[rgba(0,0,0,0.4)]"></div>
        </div>
      )}

      {/* Content */}
      <div className="relative z-10 container mx-auto px-4 sm:px-6 lg:px-8">
        <div className={`flex flex-col ${alignmentClasses} max-w-4xl mx-auto`}>
          {/* Title */}
          <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold text-neutral-high mb-6">
            {title}
          </h1>

          {/* Subtitle */}
          {subtitle && (
            <p className="text-xl sm:text-2xl text-neutral-medium mb-8 max-w-2xl">
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
    primary: 'bg-standout text-on-standout',
    secondary: 'bg-backdrop-medium hover:bg-backdrop-high text-neutral-high',
    outline: 'border-2 border-standout hover:bg-standout text-standout hover:text-on-standout',
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

