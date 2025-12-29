/**
 * Lexical SSR Renderer
 *
 * Converts Lexical editor JSON to HTML for server-side rendering.
 * Supports common Lexical node types: paragraphs, headings, lists, links, text formatting.
 */

/**
 * Lexical node interface (simplified)
 */
interface LexicalNode {
  type: string
  version?: number
  [key: string]: any
}

/**
 * Text node with formatting
 */
interface TextNode extends LexicalNode {
  type: 'text'
  text: string
  format?: number // Bitmask for bold, italic, etc.
}

/**
 * Element node (container)
 */
interface ElementNode extends LexicalNode {
  children?: LexicalNode[]
  tag?: string
  indent?: number
  direction?: 'ltr' | 'rtl'
}

/**
 * Link node
 */
interface LinkNode extends ElementNode {
  type: 'link'
  url: string
  title?: string
  rel?: string
  target?: string
}

/**
 * Format flags (Lexical uses bitmask for text formatting)
 */
const FORMAT_BOLD = 1
const FORMAT_ITALIC = 2
const FORMAT_STRIKETHROUGH = 4
const FORMAT_UNDERLINE = 8
const FORMAT_CODE = 16

/**
 * Render Lexical JSON to HTML
 *
 * @param lexicalJson - Lexical editor state JSON
 * @returns HTML string
 */
export function renderLexicalToHtml(lexicalJson: any): string {
  if (!lexicalJson) {
    return ''
  }

  let data: any
  if (typeof lexicalJson === 'string') {
    try {
      data = JSON.parse(lexicalJson)
    } catch {
      return lexicalJson // Treat as raw HTML/text
    }
  } else {
    data = lexicalJson
  }

  if (!data || !data.root) {
    return typeof lexicalJson === 'string' ? lexicalJson : ''
  }

  return renderNode(data.root)
}

/**
 * Render a single Lexical node
 */
function renderNode(node: LexicalNode, isInsideCode = false): string {
  switch (node.type) {
    case 'root':
      return renderChildren(node as ElementNode, isInsideCode)

    case 'paragraph': {
      const content = renderChildren(node as ElementNode, isInsideCode)
      if (isInsideCode) return content
      return content ? `<p>${content}</p>` : '<p><br></p>'
    }

    case 'heading': {
      const tag = (node as any).tag || 'h2'
      const content = renderChildren(node as ElementNode, isInsideCode)
      if (isInsideCode) return content
      return `<${tag}>${content}</${tag}>`
    }

    case 'list': {
      const listType = (node as any).listType === 'number' ? 'ol' : 'ul'
      const content = renderChildren(node as ElementNode, isInsideCode)
      if (isInsideCode) return content
      return `<${listType}>${content}</${listType}>`
    }

    case 'listitem': {
      const content = renderChildren(node as ElementNode, isInsideCode)
      if (isInsideCode) return content
      return `<li>${content}</li>`
    }

    case 'quote': {
      const content = renderChildren(node as ElementNode, isInsideCode)
      if (isInsideCode) return content
      return `<blockquote>${content}</blockquote>`
    }

    case 'link':
      return renderLink(node as LinkNode, isInsideCode)

    case 'lexical-button':
    case 'button':
      return renderButton(node, isInsideCode)

    case 'lexical-media':
    case 'media':
      return renderMedia(node, isInsideCode)

    case 'text':
      return renderText(node as TextNode, isInsideCode)

    case 'code': {
      // Code block handler
      const children = (node as any).children || []
      const codeContent = children.map((c: any) => renderNode(c, true)).join('')
      const language = (node as any).language || 'text'
      return `<pre><code class="language-${escapeHtml(language)}">${escapeHtml(
        codeContent
      )}</code></pre>`
    }

    case 'linebreak':
      return isInsideCode ? '\n' : '<br>'

    case 'horizontalrule':
      return isInsideCode ? '' : '<hr>'

    default:
      // Unknown node type, render children if present
      return renderChildren(node as ElementNode, isInsideCode)
  }
}

/**
 * Render children nodes
 */
function renderChildren(node: ElementNode, isInsideCode = false): string {
  if (!node.children || node.children.length === 0) {
    return ''
  }

  return node.children.map((child) => renderNode(child, isInsideCode)).join('')
}

/**
 * Render link
 */
function renderLink(node: LinkNode, isInsideCode = false): string {
  const url = escapeHtml(node.url || '#')
  const title = node.title ? ` title="${escapeHtml(node.title)}"` : ''
  const rel = node.rel ? ` rel="${escapeHtml(node.rel)}"` : ''
  const target = node.target ? ` target="${escapeHtml(node.target)}"` : ''
  const content = renderChildren(node, isInsideCode)

  if (isInsideCode) return content
  return `<a href="${url}"${title}${rel}${target}>${content}</a>`
}

/**
 * Render button
 */
function renderButton(node: LexicalNode, isInsideCode = false): string {
  const url = escapeHtml(node.url || node.__url || '#')
  const variant = node.variant || node.__variant || 'primary'
  const content = renderChildren(node as ElementNode, isInsideCode)

  if (isInsideCode) return content

  const base =
    'inline-flex items-center justify-center px-5 py-3 text-base font-medium rounded-lg transition-colors duration-200 !no-underline !not-prose'
  const variants: Record<string, string> = {
    primary: '!bg-standout-medium !text-on-high hover:opacity-90',
    secondary: '!bg-backdrop-medium hover:bg-backdrop-high !text-neutral-high',
    outline: 'border border-line-low hover:bg-backdrop-medium !text-neutral-high',
  }
  const classes = `${base} ${variants[variant] || variants.primary} mb-4`

  return `<a href="${url}" class="${classes}">${content}</a>`
}

/**
 * Render media
 */
function renderMedia(node: LexicalNode, isInsideCode = false): string {
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

/**
 * Render text with formatting
 */
function renderText(node: TextNode, isInsideCode = false): string {
  let text = node.text || ''

  if (isInsideCode) return text

  text = escapeHtml(text)
  const format = node.format || 0

  // Apply formatting based on bitmask
  if (format & FORMAT_BOLD) {
    text = `<strong>${text}</strong>`
  }
  if (format & FORMAT_ITALIC) {
    text = `<em>${text}</em>`
  }
  if (format & FORMAT_STRIKETHROUGH) {
    text = `<s>${text}</s>`
  }
  if (format & FORMAT_UNDERLINE) {
    text = `<u>${text}</u>`
  }
  if (format & FORMAT_CODE) {
    text = `<code>${text}</code>`
  }

  return text
}

/**
 * Escape HTML special characters
 */
function escapeHtml(text: string): string {
  const map: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
  }
  return text.replace(/[&<>"']/g, (char) => map[char] || char)
}

/**
 * Extract plain text from Lexical JSON (for SEO descriptions, etc.)
 *
 * @param lexicalJson - Lexical editor state JSON
 * @returns Plain text string
 */
export function extractPlainText(lexicalJson: any): string {
  if (!lexicalJson || !lexicalJson.root) {
    return ''
  }

  return extractTextFromNode(lexicalJson.root)
}

/**
 * Extract plain text from a node recursively
 */
function extractTextFromNode(node: LexicalNode): string {
  if (node.type === 'text') {
    return (node as TextNode).text
  }

  const elementNode = node as ElementNode
  if (elementNode.children) {
    return elementNode.children.map((child) => extractTextFromNode(child)).join(' ')
  }

  return ''
}
