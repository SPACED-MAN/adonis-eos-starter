/**
 * Prose Module - Static Variant
 * 
 * Pure SSR component (no hydration, max performance)
 * Use for rich text content from Lexical editor
 * 
 * Located in inertia/modules/ (shared between admin preview and public site)
 * Naming convention: -static suffix indicates pure SSR rendering
 */

interface LexicalJSON {
  root: {
    type: string
    children: any[]
  }
}

interface ProseStaticProps {
  content: LexicalJSON | string // Lexical JSON or pre-rendered HTML
  maxWidth?: string // Tailwind class (e.g., 'max-w-4xl')
  fontSize?: string // Tailwind class (e.g., 'text-base')
  backgroundColor?: string // Tailwind class
  textColor?: string // Tailwind class
  padding?: string // Tailwind class
}

export default function ProseStatic({
  content,
  maxWidth = 'max-w-4xl',
  fontSize = 'text-base',
  backgroundColor = 'bg-transparent',
  textColor = 'text-sand-900 dark:text-sand-50',
  padding = 'py-12',
}: ProseStaticProps) {
  // If content is already HTML string, use it directly
  // Otherwise, it's Lexical JSON that needs to be rendered on the server
  // (For now, we expect server to pre-render Lexical → HTML)
  const htmlContent = typeof content === 'string' 
    ? content 
    : renderLexicalToHtml(content)

  return (
    <section className={`${backgroundColor} ${padding}`} data-module="prose">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className={`${maxWidth} mx-auto`}>
          <div 
            className={`prose prose-sand dark:prose-invert ${fontSize} ${textColor}`}
            dangerouslySetInnerHTML={{ __html: htmlContent }}
          />
        </div>
      </div>
    </section>
  )
}

/**
 * Basic Lexical JSON to HTML renderer
 * Note: In production, this should be done server-side for true static rendering
 * For now, this is a client-side fallback
 */
function renderLexicalToHtml(json: LexicalJSON): string {
  if (!json.root || !json.root.children) {
    return '<p>Empty content</p>'
  }

  const renderNode = (node: any): string => {
    switch (node.type) {
      case 'paragraph':
        const pContent = node.children?.map(renderNode).join('') || ''
        return `<p>${pContent}</p>`
      
      case 'heading':
        const level = node.tag || 'h2'
        const hContent = node.children?.map(renderNode).join('') || ''
        return `<${level}>${hContent}</${level}>`
      
      case 'list':
        const listTag = node.listType === 'number' ? 'ol' : 'ul'
        const listContent = node.children?.map(renderNode).join('') || ''
        return `<${listTag}>${listContent}</${listTag}>`
      
      case 'listitem':
        const liContent = node.children?.map(renderNode).join('') || ''
        return `<li>${liContent}</li>`
      
      case 'text':
        let text = node.text || ''
        
        // Apply formatting
        if (node.format) {
          if (node.format & 1) text = `<strong>${text}</strong>` // bold
          if (node.format & 2) text = `<em>${text}</em>` // italic
          if (node.format & 8) text = `<code>${text}</code>` // code
        }
        
        return text
      
      case 'link':
        const url = node.url || '#'
        const linkContent = node.children?.map(renderNode).join('') || ''
        return `<a href="${url}">${linkContent}</a>`
      
      default:
        return node.children?.map(renderNode).join('') || ''
    }
  }

  return json.root.children.map(renderNode).join('')
}

