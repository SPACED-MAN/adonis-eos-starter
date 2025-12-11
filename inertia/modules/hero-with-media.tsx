import { useEffect, useState } from 'react'
import { pickMediaVariantUrl } from '../lib/media'
import type { Button, LinkValue } from './types'
import { useInlineValue } from '../components/inline-edit/InlineEditorContext'

interface HeroWithMediaProps {
  title: string
  subtitle?: string
  image?: string | null // media ID
  imageAlt?: string | null
  imagePosition?: 'left' | 'right'
  primaryCta?: Button | null
  secondaryCta?: Button | null
  backgroundColor?: string
  __moduleId?: string
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
  __moduleId,
}: HeroWithMediaProps) {
  const imageId = useInlineValue(__moduleId, 'image', image)
  const titleValue = useInlineValue(__moduleId, 'title', title)
  const subtitleValue = useInlineValue(__moduleId, 'subtitle', subtitle)
  const [resolvedImageUrl, setResolvedImageUrl] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    async function resolveImage() {
      if (!imageId) {
        if (!cancelled) setResolvedImageUrl(null)
        return
      }

      try {
        const res = await fetch(`/public/media/${encodeURIComponent(String(imageId))}`)
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
  }, [imageId])

  const hasCtas = Boolean(primaryCta || secondaryCta)

  const imageBlock = resolvedImageUrl ? (
    <div className="lg:col-span-5 flex justify-center lg:justify-end">
      <div
        className="w-full max-w-md rounded-xl overflow-hidden border border-line-low bg-backdrop-high relative"
        data-inline-type="media"
        data-inline-path="image"
      >
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
            <h1
              className="max-w-2xl text-4xl font-extrabold tracking-tight leading-tight sm:text-5xl xl:text-6xl text-neutral-high"
              data-inline-path="title"
            >
              {titleValue}
            </h1>
            {subtitleValue && (
              <p
                className="max-w-2xl text-lg lg:text-xl font-light text-neutral-medium"
                data-inline-path="subtitle"
              >
                {subtitleValue}
              </p>
            )}

            {hasCtas && (
              <div className="flex flex-wrap items-center gap-4">
                {primaryCta && (
                  <ButtonComponent
                    {...primaryCta}
                    moduleId={__moduleId}
                    inlineObjectPath="primaryCta"
                    inlineObjectLabel="Primary CTA"
                  />
                )}
                {secondaryCta && (
                  <ButtonComponent
                    {...secondaryCta}
                    moduleId={__moduleId}
                    inlineObjectPath="secondaryCta"
                    inlineObjectLabel="Secondary CTA"
                  />
                )}
              </div>
            )}
          </div>

          {imagePosition !== 'left' && imageBlock}
        </div>
      </div>
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
}: ButtonComponentProps) {
  // Use inline values so edits reflect immediately
  const obj = useInlineValue(moduleId, inlineObjectPath || '', { label: initialLabel, url: initialUrl, style: initialStyle })
  const label = obj?.label ?? initialLabel
  const url = obj?.url ?? initialUrl
  const style: 'primary' | 'secondary' | 'outline' = obj?.style ?? initialStyle

  const styleMap = {
    primary: 'bg-standout text-on-standout',
    secondary: 'bg-backdrop-medium hover:bg-backdrop-high text-neutral-high',
    outline: 'border border-line-low hover:bg-backdrop-medium text-neutral-high',
  }
  const styleClasses = styleMap[style] || styleMap.primary

  const { href, target: finalTarget } = resolveHrefAndTarget(url, target)
  if (!href) return null

  return (
    <a
      href={href}
      target={finalTarget}
      rel={finalTarget === '_blank' ? 'noopener noreferrer' : rel}
      className={`inline-flex items-center justify-center px-5 py-3 text-base font-medium rounded-lg transition-colors duration-200 ${styleClasses} relative group`}
      data-inline-type="object"
      data-inline-path={inlineObjectPath}
      data-inline-label={inlineObjectLabel}
      data-inline-fields={ctaObjectFields}
    >
      {label}
    </a>
  )
}


