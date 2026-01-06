import { marked } from 'marked'

/**
 * Helper to parse inline markdown text into tokens
 * marked.js doesn't have lexInline, so we parse as a paragraph and extract tokens
 */
function parseInlineTokens(text: string): any[] {
  if (!text) return []
  try {
    const tokens = marked.lexer(text)
    // Extract inline tokens from paragraph or other block tokens
    const inlineTokens: any[] = []
    for (const token of tokens) {
      if ('tokens' in token && token.tokens && Array.isArray(token.tokens)) {
        inlineTokens.push(...token.tokens)
      } else if (token.type === 'text') {
        inlineTokens.push(token)
      }
    }
    return inlineTokens.length > 0 ? inlineTokens : [{ type: 'text', text }]
  } catch {
    return [{ type: 'text', text }]
  }
}

/**
 * Convert markdown to Lexical JSON using marked.js lexer.
 *
 * This is used for seeding docs and for MCP helpers so agents can provide markdown
 * instead of hand-authoring Lexical JSON.
 */
export function markdownToLexical(markdown: string, opts: { skipFirstH1?: boolean } = {}): any {
  const skipFirstH1 = opts.skipFirstH1 !== false

  marked.setOptions({
    gfm: true,
    breaks: false,
    pedantic: false,
  })

  const tokens = marked.lexer(markdown || '')

  const children: any[] = []
  let skippedFirstH1 = false

  for (const token of tokens as any[]) {
    if (skipFirstH1 && token.type === 'heading' && token.depth === 1 && !skippedFirstH1) {
      skippedFirstH1 = true
      continue
    }
    const node = tokenToLexicalNode(token)
    if (node) children.push(node)
  }

  return {
    root: {
      type: 'root',
      direction: 'ltr',
      format: '',
      indent: 0,
      version: 1,
      children,
    },
  }
}

function tokenToLexicalNode(token: any): any {
  switch (token.type) {
    case 'heading': {
      let headingTokens = token.tokens
      if (!headingTokens && token.text) {
        headingTokens = parseInlineTokens(token.text)
      }
      return {
        type: 'heading',
        tag: `h${token.depth}`,
        direction: 'ltr',
        format: '',
        indent: 0,
        version: 1,
        children: inlineTokensToLexical(headingTokens || []),
      }
    }

    case 'paragraph': {
      let inlineTokens = token.tokens
      if (!inlineTokens && token.text) {
        inlineTokens = parseInlineTokens(token.text)
      }
      return {
        type: 'paragraph',
        direction: 'ltr',
        format: '',
        indent: 0,
        version: 1,
        children: inlineTokensToLexical(inlineTokens || []),
      }
    }

    case 'list':
      return {
        type: 'list',
        listType: token.ordered ? 'number' : 'bullet',
        start: token.start || 1,
        tag: token.ordered ? 'ol' : 'ul',
        direction: 'ltr',
        format: '',
        indent: 0,
        version: 1,
        children: (token.items || []).map((item: any) => listItemToLexical(item)),
      }

    case 'code':
      return {
        type: 'code',
        language: token.lang || 'typescript',
        direction: 'ltr',
        format: '',
        indent: 0,
        version: 1,
        children: [
          {
            type: 'text',
            text: token.text,
            detail: 0,
            format: 0,
            mode: 'normal',
            style: '',
            version: 1,
          },
        ],
      }

    case 'blockquote': {
      const childTokens = token.tokens || []
      const quoteChildren = childTokens.map((t: any) => tokenToLexicalNode(t)).filter(Boolean)
      return {
        type: 'quote',
        direction: 'ltr',
        format: '',
        indent: 0,
        version: 1,
        children: quoteChildren.length
          ? quoteChildren
          : [
              {
                type: 'paragraph',
                children: [],
                direction: 'ltr',
                format: '',
                indent: 0,
                version: 1,
              },
            ],
      }
    }

    case 'hr':
      return {
        type: 'horizontalrule',
        version: 1,
      }

    case 'image':
      return {
        type: 'lexical-media',
        url: token.href,
        alt: token.text || '',
        version: 1,
      }

    case 'table':
      const headerRow = {
        type: 'tablerow',
        version: 1,
        children: token.header.map((cell: any, i: number) => ({
          type: 'tablecell',
          header: true,
          align: token.align[i],
          version: 1,
          children: [
            {
              type: 'paragraph',
              direction: 'ltr',
              format: '',
              indent: 0,
              version: 1,
              children: inlineTokensToLexical(cell.tokens || []),
            },
          ],
        })),
      }

      const rows = token.rows.map((row: any) => ({
        type: 'tablerow',
        version: 1,
        children: row.map((cell: any, i: number) => ({
          type: 'tablecell',
          header: false,
          align: token.align[i],
          version: 1,
          children: [
            {
              type: 'paragraph',
              direction: 'ltr',
              format: '',
              indent: 0,
              version: 1,
              children: inlineTokensToLexical(cell.tokens || []),
            },
          ],
        })),
      }))

      return {
        type: 'table',
        version: 1,
        children: [headerRow, ...rows],
      }

    case 'html':
      return {
        type: 'paragraph',
        direction: 'ltr',
        format: '',
        indent: 0,
        version: 1,
        children: [
          {
            type: 'text',
            text: token.text,
            detail: 0,
            format: 0,
            mode: 'normal',
            style: '',
            version: 1,
          },
        ],
      }

    case 'space':
    case 'text': {
      const raw = String(token.text || '').trim()
      if (!raw) return null
      const inline = parseInlineTokens(raw)
      return {
        type: 'paragraph',
        direction: 'ltr',
        format: '',
        indent: 0,
        version: 1,
        children: inlineTokensToLexical(inline || []),
      }
    }

    default:
      return null
  }
}

function listItemToLexical(item: any): any {
  const children: any[] = []

  // marked list items often contain tokens for nested content
  const itemTokens: any[] = Array.isArray(item.tokens) ? item.tokens : []

  // When item has inline tokens only (e.g. task list), normalize to a paragraph
  if (itemTokens.length === 0 && item.text) {
    const inline = parseInlineTokens(String(item.text))
    children.push({
      type: 'paragraph',
      direction: 'ltr',
      format: '',
      indent: 0,
      version: 1,
      children: inlineTokensToLexical(inline || []),
    })
  } else {
    for (const token of itemTokens) {
      if (token.type === 'text') {
        const inlineTokens = token.tokens || parseInlineTokens(String(token.text || ''))
        children.push({
          type: 'paragraph',
          direction: 'ltr',
          format: '',
          indent: 0,
          version: 1,
          children: inlineTokensToLexical(inlineTokens),
        })
        continue
      }
      const node = tokenToLexicalNode(token)
      if (node) children.push(node)
    }
  }

  return {
    type: 'listitem',
    direction: 'ltr',
    format: '',
    indent: 0,
    version: 1,
    checked: item.task ? (item.checked ? true : false) : undefined,
    value: 1,
    children,
  }
}

function inlineTokensToLexical(tokens: any[]): any[] {
  const out: any[] = []

  for (const token of tokens || []) {
    switch (token.type) {
      case 'text':
        if (token.text) {
          out.push({
            type: 'text',
            text: token.text,
            detail: 0,
            format: 0,
            mode: 'normal',
            style: '',
            version: 1,
          })
        }
        break

      case 'strong': {
        const children = inlineTokensToLexical(token.tokens || [])
        for (const child of children) {
          if (child.type === 'text') child.format = (child.format || 0) | 1
          out.push(child)
        }
        break
      }

      case 'em': {
        const children = inlineTokensToLexical(token.tokens || [])
        for (const child of children) {
          if (child.type === 'text') child.format = (child.format || 0) | 2
          out.push(child)
        }
        break
      }

      case 'del': {
        const children = inlineTokensToLexical(token.tokens || [])
        for (const child of children) {
          if (child.type === 'text') child.format = (child.format || 0) | 4
          out.push(child)
        }
        break
      }

      case 'codespan':
        out.push({
          type: 'text',
          text: token.text || '',
          detail: 0,
          format: 16,
          mode: 'normal',
          style: '',
          version: 1,
        })
        break

      case 'br':
        out.push({ type: 'linebreak', version: 1 })
        break

      case 'link': {
        const linkTokens = token.tokens || parseInlineTokens(String(token.text || ''))
        const children = inlineTokensToLexical(linkTokens || [])
        out.push({
          type: 'link',
          url: token.href || '#',
          title: token.title || '',
          rel: 'noreferrer noopener',
          target: '_blank',
          direction: 'ltr',
          format: '',
          indent: 0,
          version: 1,
          children,
        })
        break
      }

      default:
        if (token.raw) {
          out.push({
            type: 'text',
            text: String(token.raw),
            detail: 0,
            format: 0,
            mode: 'normal',
            style: '',
            version: 1,
          })
        }
        break
    }
  }

  return out
}
