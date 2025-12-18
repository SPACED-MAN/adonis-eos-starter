import { useEffect, useState } from 'react'
import { pickMediaVariantUrl } from '../lib/media'
import { FontAwesomeIcon } from '../site/lib/icons'
import type { Button, LinkValue } from './types'
import { useInlineValue } from '../components/inline-edit/InlineEditorContext'
import { resolveLink } from '../utils/resolve_link'

interface LexicalJSON {
  root: {
    type: string
    children: any[]
  }
}

interface ProseWithMediaProps {
  title: string
  // Lexical JSON or legacy string (plain text / HTML / JSON string)
  body?: LexicalJSON | string | null
  image?: string | null // media ID
  imageAlt?: string | null
  imagePosition?: 'left' | 'right'
  primaryCta?: Button | null
  backgroundColor?: string
  __moduleId?: string
}

export default function ProseWithMedia({
  title,
  body,
  image,
  imageAlt,
  imagePosition = 'left',
  primaryCta,
  backgroundColor = 'bg-backdrop-low',
  __moduleId,
}: ProseWithMediaProps) {
  const titleValue = useInlineValue(__moduleId, 'title', title)
  const bodyValue = useInlineValue(__moduleId, 'body', body)
  const imageId = useInlineValue(__moduleId, 'image', image)
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

  function resolveButtonHref(url: string | LinkValue): string | undefined {
    return resolveLink(url).href
  }

  const hasCta = Boolean(primaryCta && primaryCta.label && primaryCta.url)
  const bodyHtml = bodyValue ? lexicalContentToHtml(bodyValue) : ''

  const imageBlock = resolvedImageUrl ? (
    <div className="w-full">
      <div
        className="w-full rounded-xl overflow-hidden border border-line-low bg-backdrop-high aspect-[4/3]"
        data-inline-type="media"
        data-inline-path="image"
      >
        <img
          src={resolvedImageUrl}
          alt={imageAlt || ''}
          className="w-full h-full object-cover"
          loading="lazy"
          decoding="async"
        />
      </div>
    </div>
  ) : null

  return (
    <section className={`${backgroundColor} py-12 sm:py-16`} data-module="prose-with-media">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="md:grid md:grid-cols-2 md:gap-8 xl:gap-16 items-center">
          {imagePosition === 'left' && imageBlock}

          <div className="mt-8 md:mt-0">
            <h2
              className="mb-4 text-3xl sm:text-4xl font-extrabold tracking-tight text-neutral-high"
              data-inline-path="title"
            >
              {titleValue}
            </h2>
            {bodyValue && (
              <div
                className="mb-6 prose prose-sm md:prose-base text-neutral-medium"
                suppressHydrationWarning
                data-inline-type="richtext"
                data-inline-path="body"
                data-inline-label="Body"
                dangerouslySetInnerHTML={{ __html: bodyHtml }}
              />
            )}
            {hasCta &&
              primaryCta &&
              primaryCta.label &&
              primaryCta.url &&
              (() => {
                const href = resolveButtonHref(primaryCta.url)
                if (!href) return null
                const linkTarget =
                  typeof primaryCta.url === 'object' && primaryCta.url && primaryCta.url.kind
                    ? primaryCta.url.target === '_blank'
                      ? '_blank'
                      : '_self'
                    : primaryCta.target || '_self'
                return (
                  <a
                    href={href}
                    target={linkTarget}
                    rel={linkTarget === '_blank' ? 'noopener noreferrer' : undefined}
                    className="inline-flex items-center text-on-standout bg-standout-medium hover:bg-standout-medium/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-standout-medium font-medium rounded-lg text-sm px-5 py-2.5 transition-colors"
                  >
                    {primaryCta.label}
                    <FontAwesomeIcon icon="arrow-right" className="ml-2 -mr-1 text-sm" />
                  </a>
                )
              })()}
          </div>

          {imagePosition !== 'left' && imageBlock}
        </div>
      </div>
    </section>
  )
}

/**
 * Convert Lexical JSON to HTML for rendering.
 */
function lexicalContentToHtml(content: LexicalJSON | string): string {
  if (content === undefined || content === null) return '<p>Empty content</p>'
  if (typeof content === 'string') {
    const trimmed = content.trim()
    const looksJson = trimmed.startsWith('{') || trimmed.startsWith('[')
    if (looksJson) {
      try {
        const parsed = JSON.parse(trimmed)
        return renderLexicalToHtml(parsed)
      } catch {
        return '<p>Invalid content format</p>'
      }
    }
    return '<p>Invalid content format</p>'
  }
  return renderLexicalToHtml(content)
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

function renderLexicalToHtml(json: LexicalJSON): string {
  if (!json || !(json as any).root || !(json as any).root.children) {
    return '<p>Empty content</p>'
  }

  const renderNode = (node: any): string => {
    switch (node.type) {
      case 'paragraph': {
        const pContent = node.children?.map(renderNode).join('') || ''
        return `<p>${pContent}</p>`
      }
      case 'heading': {
        let level = node.tag || 'h2'
        if (level === 'h1') level = 'h2'
        const hContent = node.children?.map(renderNode).join('') || ''
        return `<${level}>${hContent}</${level}>`
      }
      case 'list': {
        const listTag = node.listType === 'number' ? 'ol' : 'ul'
        const listContent = node.children?.map(renderNode).join('') || ''
        return `<${listTag}>${listContent}</${listTag}>`
      }
      case 'listitem': {
        const liContent = node.children?.map(renderNode).join('') || ''
        return `<li>${liContent}</li>`
      }
      case 'text': {
        let text = escapeHtml(node.text || '')
        if (node.format) {
          if (node.format & 1) text = `<strong>${text}</strong>`
          if (node.format & 2) text = `<em>${text}</em>`
          if (node.format & 16) text = `<code>${text}</code>`
        }
        return text
      }
      case 'code': {
        const codeContent = node.children?.map(renderNode).join('') || ''
        const language = node.language || 'text'
        return `<pre><code class="language-${escapeHtml(language)}">${escapeHtml(
          codeContent
        )}</code></pre>`
      }
      case 'horizontalrule':
        return '<hr />'
      case 'linebreak':
        return '<br />'
      case 'quote': {
        const quoteContent = node.children?.map(renderNode).join('') || ''
        return `<blockquote>${quoteContent}</blockquote>`
      }
      case 'link': {
        const url = escapeHtml(node.url || '#')
        const linkContent = node.children?.map(renderNode).join('') || ''
        return `<a href="${url}">${linkContent}</a>`
      }
      default:
        return node.children?.map(renderNode).join('') || ''
    }
  }

  return (json as any).root.children.map(renderNode).join('')
}
