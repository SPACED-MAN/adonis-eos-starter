// @ts-ignore
import Prism from './prism_init'
// @ts-ignore
import 'prismjs/components/prism-json.js'
// @ts-ignore
import 'prismjs/components/prism-bash.js'
// @ts-ignore
import 'prismjs/components/prism-javascript.js'
// @ts-ignore
import 'prismjs/components/prism-typescript.js'
// @ts-ignore
import 'prismjs/components/prism-css.js'
// @ts-ignore
import 'prismjs/components/prism-markdown.js'
// @ts-ignore
import 'prismjs/components/prism-sql.js'
// @ts-ignore
import 'prismjs/components/prism-python.js'

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

        // Smart default: if no language is specified, check if it looks like a shell/config snippet
        let language = node.language
        if (!language) {
          const trimmed = codeContent.trim()
          if (trimmed.startsWith('#') || trimmed.startsWith('$ ')) {
            language = 'bash'
          } else {
            language = 'javascript'
          }
        }

        if (isInsideCode) return codeContent

        // Syntax highlighting with Prism
        let highlightedCode = escapeHtml(codeContent)
        try {
          const prismLang = Prism.languages[language]
          if (prismLang) {
            highlightedCode = Prism.highlight(codeContent, prismLang, language)
          }
        } catch (e) {
          // Fallback to escaped content
        }

        return `<div class="code-block-wrapper my-6">
          ${node.language
            ? `<div class="bg-[#161b22] px-4 py-2 text-xs font-mono text-[#8b949e] border border-[#30363d] border-b-0 rounded-t-lg tracking-widest uppercase flex justify-between items-center leading-none">
              <span>${escapeHtml(node.language)}</span>
            </div>`
            : ''
          }
          <pre class="${node.language ? 'my-0! rounded-t-none!' : ''}"><code class="language-${escapeHtml(
            language
          )}">${highlightedCode}</code></pre>
        </div>`
      }

      case 'horizontalrule':
        return isInsideCode ? '' : '<hr />'

      case 'table': {
        const tContent = node.children?.map((c: any) => renderNode(c, isInsideCode)).join('') || ''
        return isInsideCode
          ? tContent
          : `<div class="my-8 overflow-x-auto border border-line-low rounded-lg shadow-sm">
              <table class="w-full text-left border-collapse border-spacing-0 min-w-[600px]">
                <tbody class="divide-y divide-line-low">
                  ${tContent}
                </tbody>
              </table>
            </div>`
      }

      case 'tablerow': {
        const trContent = node.children?.map((c: any) => renderNode(c, isInsideCode)).join('') || ''
        return isInsideCode ? trContent : `<tr>${trContent}</tr>`
      }

      case 'tablecell': {
        const isHeader = node.header === true || node.tag === 'th'
        const tag = isHeader ? 'th' : 'td'
        const align = node.align
        const alignClass = align ? ` text-${align}` : ''
        const classes = `${isHeader ? 'bg-backdrop-medium font-bold' : 'bg-backdrop-low/30'} px-4 py-4 text-sm text-neutral-high border-r border-line-low last:border-0${alignClass}`
        const cellContent = node.children?.map((c: any) => renderNode(c, isInsideCode)).join('') || ''
        return isInsideCode ? cellContent : `<${tag} class="${classes}">${cellContent}</${tag}>`
      }

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
          primary: '!bg-standout-high !text-on-high hover:opacity-90',
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
