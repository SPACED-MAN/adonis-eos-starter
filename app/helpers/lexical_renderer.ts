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
  if (!lexicalJson || !lexicalJson.root) {
    return ''
  }

  return renderNode(lexicalJson.root)
}

/**
 * Render a single Lexical node
 */
function renderNode(node: LexicalNode): string {
  switch (node.type) {
    case 'root':
      return renderChildren(node as ElementNode)

    case 'paragraph':
      return renderParagraph(node as ElementNode)

    case 'heading':
      return renderHeading(node as ElementNode & { tag: string })

    case 'list':
      return renderList(node as ElementNode & { listType: 'bullet' | 'number'; tag: string })

    case 'listitem':
      return renderListItem(node as ElementNode)

    case 'quote':
      return renderQuote(node as ElementNode)

    case 'link':
      return renderLink(node as LinkNode)

    case 'text':
      return renderText(node as TextNode)

    case 'linebreak':
      return '<br>'

    default:
      // Unknown node type, render children if present
      return renderChildren(node as ElementNode)
  }
}

/**
 * Render children nodes
 */
function renderChildren(node: ElementNode): string {
  if (!node.children || node.children.length === 0) {
    return ''
  }

  return node.children.map((child) => renderNode(child)).join('')
}

/**
 * Render paragraph
 */
function renderParagraph(node: ElementNode): string {
  const content = renderChildren(node)
  return content ? `<p>${content}</p>` : '<p><br></p>'
}

/**
 * Render heading
 */
function renderHeading(node: ElementNode & { tag: string }): string {
  const tag = node.tag || 'h2'
  const content = renderChildren(node)
  return `<${tag}>${content}</${tag}>`
}

/**
 * Render list
 */
function renderList(node: ElementNode & { listType: 'bullet' | 'number'; tag: string }): string {
  const tag = node.listType === 'number' ? 'ol' : 'ul'
  const content = renderChildren(node)
  return `<${tag}>${content}</${tag}>`
}

/**
 * Render list item
 */
function renderListItem(node: ElementNode): string {
  const content = renderChildren(node)
  return `<li>${content}</li>`
}

/**
 * Render blockquote
 */
function renderQuote(node: ElementNode): string {
  const content = renderChildren(node)
  return `<blockquote>${content}</blockquote>`
}

/**
 * Render link
 */
function renderLink(node: LinkNode): string {
  const url = escapeHtml(node.url || '#')
  const title = node.title ? ` title="${escapeHtml(node.title)}"` : ''
  const rel = node.rel ? ` rel="${escapeHtml(node.rel)}"` : ''
  const target = node.target ? ` target="${escapeHtml(node.target)}"` : ''
  const content = renderChildren(node)

  return `<a href="${url}"${title}${rel}${target}>${content}</a>`
}

/**
 * Render text with formatting
 */
function renderText(node: TextNode): string {
  let text = escapeHtml(node.text)
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

