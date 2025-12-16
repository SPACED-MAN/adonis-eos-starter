/**
 * Prose Module
 *
 * Pure SSR-friendly component for rich text content from the Lexical editor.
 * Rendering mode (static vs React) is controlled by the backend module's
 * `getRenderingMode()` – this component is shared between admin preview
 * and the public site.
 */
import { useInlineValue } from '../components/inline-edit/InlineEditorContext'

interface LexicalJSON {
  root: {
    type: string
    children: any[]
  }
}

interface ProseProps {
  // Lexical JSON or pre-rendered HTML.
  // Note: content can be missing/undefined for older or partially-staged drafts;
  // the renderer must be resilient to avoid SSR 500s.
  content?: LexicalJSON | string | null
  maxWidth?: string // Tailwind class (e.g., 'max-w-4xl')
  fontSize?: string // Tailwind class (e.g., 'text-base')
  backgroundColor?: string // Tailwind class
  textColor?: string // Tailwind class
  padding?: string // Tailwind class
  __moduleId?: string
}

export default function Prose({
  content: initialContent,
  maxWidth: initialMaxWidth = 'max-w-4xl',
  fontSize: initialFontSize = 'text-base',
  backgroundColor: initialBackground = 'bg-transparent',
  textColor: initialTextColor = 'text-neutral-high',
  padding: initialPadding = 'py-12',
  __moduleId,
}: ProseProps) {
  const content = useInlineValue(__moduleId, 'content', initialContent)
  const maxWidth = useInlineValue(__moduleId, 'maxWidth', initialMaxWidth)
  const fontSize = useInlineValue(__moduleId, 'fontSize', initialFontSize)
  const backgroundColor = useInlineValue(__moduleId, 'backgroundColor', initialBackground)
  const textColor = useInlineValue(__moduleId, 'textColor', initialTextColor)
  const padding = useInlineValue(__moduleId, 'padding', initialPadding)

  // Normalize content so that saved JSON strings from the editor still render
  // as rich text instead of showing the raw JSON to the visitor.
  let htmlContent: string
  if (content === undefined || content === null) {
    htmlContent = '<p>Empty content</p>'
  } else if (typeof content === 'string') {
    const trimmed = content.trim()
    const looksJson = trimmed.startsWith('{') || trimmed.startsWith('[')
    if (looksJson) {
      try {
        const parsed = JSON.parse(trimmed)
        htmlContent = renderLexicalToHtml(parsed)
      } catch {
        // Fall back to treating the string as already-rendered HTML
        htmlContent = content
      }
    } else {
      htmlContent = content
    }
  } else {
    htmlContent = renderLexicalToHtml(content)
  }

  return (
    <section className={`${backgroundColor} ${padding}`} data-module="prose">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className={`${maxWidth} mx-auto`}>
          <div
            className={`prose ${fontSize} ${textColor}`}
            suppressHydrationWarning
            data-inline-type="richtext"
            data-inline-path="content"
            dangerouslySetInnerHTML={{ __html: htmlContent }}
          />
        </div>
      </div>
    </section>
  )
}

/**
 * Escape HTML entities to prevent code injection and render code as text
 */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

/**
 * Basic Lexical JSON to HTML renderer
 * Note: In production, this should be done server-side for true static rendering.
 * For now, this is a client-side fallback.
 */
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
        // Convert h1 to h2 (Hero module has the page h1)
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
        let text = node.text || ''

        // Apply formatting
        if (node.format) {
          if (node.format & 1) text = `<strong>${text}</strong>` // bold
          if (node.format & 2) text = `<em>${text}</em>` // italic
          if (node.format & 16) text = `<code>${escapeHtml(text)}</code>` // inline code - escape HTML
        }

        return text
      }

      case 'code': {
        // Code block - escape HTML to prevent rendering as actual HTML
        const codeContent = node.children?.map(renderNode).join('') || ''
        const language = node.language || 'typescript'
        return `<pre><code class="language-${escapeHtml(
          language
        )}">${escapeHtml(codeContent)}</code></pre>`
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
        const url = node.url || '#'
        const linkContent = node.children?.map(renderNode).join('') || ''
        return `<a href="${url}">${linkContent}</a>`
      }

      default:
        return node.children?.map(renderNode).join('') || ''
    }
  }

  return (json as any).root.children.map(renderNode).join('')
}
