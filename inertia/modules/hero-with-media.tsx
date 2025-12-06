import { useEffect, useState } from 'react'
import { pickMediaVariantUrl } from '../lib/media'
import type { Button, LinkValue } from './types'

interface HeroWithMediaProps {
  title: string
  subtitle?: string
  image?: string | null // media ID
  imageAlt?: string | null
  imagePosition?: 'left' | 'right'
  primaryCta?: Button | null
  secondaryCta?: Button | null
  backgroundColor?: string
}

export function resolveHrefAndTarget(
  url: string | LinkValue,
  explicitTarget?: '_self' | '_blank'
): { href?: string; target: '_self' | '_blank' } {
  let href: string | undefined
  let target: '_self' | '_blank' = '_self'

  if (!url) {
    return { href: undefined, target }
  }

  if (typeof url === 'string') {
    href = url
    target = explicitTarget || '_self'
    return { href, target }
  }

  if (url.kind === 'url') {
    href = url.url
  } else if (url.slug && url.locale) {
    href = `/${encodeURIComponent(url.locale)}/${encodeURIComponent(url.slug)}`
  } else if (url.slug) {
    href = `/${encodeURIComponent(url.slug)}`
  }

  const linkTarget = url.target === '_blank' ? '_blank' : '_self'
  target = explicitTarget || linkTarget

  return { href, target }
}

export default function HeroWithMedia({
  title,
  subtitle,
  image,
  imageAlt,
  imagePosition = 'right',
  primaryCta,
  secondaryCta,
  backgroundColor = 'bg-backdrop-low',
}: HeroWithMediaProps) {
  const [resolvedImageUrl, setResolvedImageUrl] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    async function resolveImage() {
      if (!image) {
        if (!cancelled) setResolvedImageUrl(null)
        return
      }

      try {
        const res = await fetch(`/public/media/${encodeURIComponent(String(image))}`)
        if (!res.ok) {
          if (!cancelled) setResolvedImageUrl(null)
          return
        }
        const j = await res.json().catch(() => null)
        const data = j?.data
        if (!data) {
          if (!cancelled) setResolvedImageUrl(null)
          return
        }
        const meta = (data as any).metadata || {}
        const variants = Array.isArray(meta?.variants) ? (meta.variants as any[]) : []
        const darkSourceUrl =
          typeof meta.darkSourceUrl === 'string' ? (meta.darkSourceUrl as string) : undefined
        const url = pickMediaVariantUrl(data.url, variants, undefined, { darkSourceUrl })
        if (!cancelled) setResolvedImageUrl(url)
      } catch {
        if (!cancelled) setResolvedImageUrl(null)
      }
    }

    resolveImage()
    return () => {
      cancelled = true
    }
  }, [image])

  const hasCtas = Boolean(primaryCta || secondaryCta)

  const imageBlock = resolvedImageUrl ? (
    <div className="lg:col-span-5 flex justify-center lg:justify-end">
      <div className="w-full max-w-md rounded-xl overflow-hidden border border-line-low bg-backdrop-high">
        <img
          src={resolvedImageUrl}
          alt={imageAlt || ''}
          className="w-full h-auto object-cover"
          loading="lazy"
          decoding="async"
        />
      </div>
    </div>
  ) : null

  return (
    <section className={`${backgroundColor} py-12 lg:py-16`} data-module="hero-with-media">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid lg:grid-cols-12 gap-8 items-center">
          {imagePosition === 'left' && imageBlock}

          <div className="lg:col-span-7 space-y-6">
            <h1 className="max-w-2xl text-4xl font-extrabold tracking-tight leading-tight sm:text-5xl xl:text-6xl text-neutral-high">
              {title}
            </h1>
            {subtitle && (
              <p className="max-w-2xl text-lg lg:text-xl font-light text-neutral-medium">
                {subtitle}
              </p>
            )}

            {hasCtas && (
              <div className="flex flex-wrap items-center gap-4">
                {primaryCta && <ButtonComponent {...primaryCta} />}
                {secondaryCta && <ButtonComponent {...secondaryCta} />}
              </div>
            )}
          </div>

          {imagePosition !== 'left' && imageBlock}
        </div>
      </div>
    </section>
  )
}

function ButtonComponent({ label, url, style = 'primary', target = '_self', rel }: Button) {
  const styleClasses =
    {
      primary: 'bg-standout text-on-standout',
      secondary: 'bg-backdrop-medium hover:bg-backdrop-high text-neutral-high',
      outline:
        'border border-line-low hover:bg-backdrop-medium text-neutral-high',
    }[style] || 'bg-standout text-on-standout'

  const { href, target: finalTarget } = resolveHrefAndTarget(url, target)
  if (!href) return null

  return (
    <a
      href={href}
      target={finalTarget}
      rel={finalTarget === '_blank' ? 'noopener noreferrer' : rel}
      className={`inline-flex items-center justify-center px-5 py-3 text-base font-medium rounded-lg transition-colors duration-200 ${styleClasses}`}
    >
      {label}
    </a>
  )
}


