/**
 * Centralized Lexical JSON to HTML renderer for Inertia modules.
 */

interface LexicalJSON {
  root: {
    type: string
    children: any[]
  }
}

/**
 * Escape HTML entities to prevent code injection and render code as text
 */
export function escapeHtml(text: string): string {
  if (!text) return ''
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

/**
 * Basic Lexical JSON to HTML renderer
 */
export function renderLexicalToHtml(json: LexicalJSON | string | null | undefined): string {
  if (!json) return ''

  let data: any
  if (typeof json === 'string') {
    try {
      data = JSON.parse(json)
    } catch {
      return json // Treat as raw HTML
    }
  } else {
    data = json
  }

  if (!data || !data.root || !Array.isArray(data.root.children)) {
    return typeof json === 'string' ? json : ''
  }

  const renderNode = (node: any, isInsideCode = false): string => {
    switch (node.type) {
      case 'paragraph': {
        const pContent = node.children?.map((c: any) => renderNode(c, isInsideCode)).join('') || ''
        // Avoid wrapping in <p> if we're already inside a code block
        return isInsideCode ? pContent : `<p>${pContent}</p>`
      }

      case 'heading': {
        // Convert h1 to h2 (Hero module usually has the page h1)
        let level = node.tag || 'h2'
        if (level === 'h1') level = 'h2'
        const hContent = node.children?.map((c: any) => renderNode(c, isInsideCode)).join('') || ''
        return isInsideCode ? hContent : `<${level}>${hContent}</${level}>`
      }

      case 'list': {
        const listTag = node.listType === 'number' ? 'ol' : 'ul'
        const listContent =
          node.children?.map((c: any) => renderNode(c, isInsideCode)).join('') || ''
        return isInsideCode ? listContent : `<${listTag}>${listContent}</${listTag}>`
      }

      case 'listitem': {
        const liContent = node.children?.map((c: any) => renderNode(c, isInsideCode)).join('') || ''
        return isInsideCode ? liContent : `<li>${liContent}</li>`
      }

      case 'text': {
        let text = node.text || ''

        // If we're inside a code block, we want the raw text without HTML tags.
        // It will be escaped by the parent 'code' node handler.
        if (isInsideCode) {
          return text
        }

        // Escape HTML for normal text
        text = escapeHtml(text)

        // Apply formatting
        if (node.format) {
          if (node.format & 1) text = `<strong>${text}</strong>` // bold
          if (node.format & 2) text = `<em>${text}</em>` // italic
          if (node.format & 4) text = `<span class="line-through">${text}</span>` // strikethrough
          if (node.format & 8) text = `<span class="underline">${text}</span>` // underline
          if (node.format & 16) text = `<code>${text}</code>` // inline code
        }

        return text
      }

      case 'code': {
        // Code block - escape HTML to prevent rendering as actual HTML
        // We pass true to renderNode to get the raw text from children
        const codeContent = node.children?.map((c: any) => renderNode(c, true)).join('') || ''
        const language = node.language || 'text'
        return `<pre><code class="language-${escapeHtml(
          language
        )}">${escapeHtml(codeContent)}</code></pre>`
      }

      case 'horizontalrule':
        return isInsideCode ? '' : '<hr />'

      case 'linebreak':
        return isInsideCode ? '\n' : '<br />'

      case 'quote': {
        const quoteContent =
          node.children?.map((c: any) => renderNode(c, isInsideCode)).join('') || ''
        return isInsideCode ? quoteContent : `<blockquote>${quoteContent}</blockquote>`
      }

      case 'link': {
        const url = escapeHtml(node.url || '#')
        const linkContent =
          node.children?.map((c: any) => renderNode(c, isInsideCode)).join('') || ''
        return isInsideCode ? linkContent : `<a href="${url}">${linkContent}</a>`
      }

      case 'lexical-button':
      case 'button': {
        const url = escapeHtml(node.url || node.__url || '#')
        const variant = node.variant || node.__variant || 'primary'
        const buttonContent =
          node.children?.map((c: any) => renderNode(c, isInsideCode)).join('') || ''

        if (isInsideCode) return buttonContent

        const base =
          'inline-flex items-center justify-center px-5 py-3 text-base font-medium rounded-lg transition-colors duration-200 !no-underline !not-prose'
        const variants: Record<string, string> = {
          primary: '!bg-standout-medium !text-on-high hover:opacity-90',
          secondary: '!bg-backdrop-medium hover:bg-backdrop-high !text-neutral-high',
          outline: 'border border-line-low hover:bg-backdrop-medium !text-neutral-high',
        }
        const classes = `${base} ${variants[variant] || variants.primary} mb-4`

        return `<a href="${url}" class="${classes}">${buttonContent}</a>`
      }

      case 'lexical-media':
      case 'media': {
        const url = escapeHtml(node.url || node.__url || '')
        const alt = escapeHtml(node.alt || node.__alt || '')
        const mimeType = node.mimeType || node.__mimeType || ''
        const isVideo = mimeType.startsWith('video/') || url.toLowerCase().endsWith('.mp4')

        if (isInsideCode) return url

        let html = `<div class="my-8 rounded-xl overflow-hidden border border-line-low bg-backdrop-medium max-w-4xl mx-auto shadow-sm">`
        if (isVideo) {
          html += `<video src="${url}" class="w-full h-auto block" controls playsinline></video>`
        } else {
          html += `<img src="${url}" alt="${alt}" class="w-full h-auto block" loading="lazy" />`
        }

        if (alt) {
          html += `<div class="px-4 py-3 text-sm text-neutral-medium border-t border-line-low italic bg-backdrop-low/50">${alt}</div>`
        }
        html += `</div>`
        return html
      }

      default:
        return node.children?.map((c: any) => renderNode(c, isInsideCode)).join('') || ''
    }
  }

  return data.root.children.map((c: any) => renderNode(c)).join('')
}
