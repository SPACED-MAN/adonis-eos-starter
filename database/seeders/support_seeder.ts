import { BaseSeeder } from '@adonisjs/lucid/seeders'
import db from '@adonisjs/lucid/services/db'
import { randomUUID } from 'node:crypto'
import { readFile, readdir } from 'node:fs/promises'
import { join } from 'node:path'
import { marked } from 'marked'

export default class extends BaseSeeder {
  /**
   * Convert markdown to Lexical JSON using marked.js lexer
   */
  private async markdownToLexical(markdown: string): Promise<any> {
    // Configure marked to enable all features
    marked.setOptions({
      gfm: true, // GitHub Flavored Markdown
      breaks: false,
      pedantic: false,
    })

    // Use marked lexer to parse markdown into tokens with full inline parsing
    const tokens = marked.lexer(markdown)

    const children: any[] = []
    let skippedFirstH1 = false

    for (let i = 0; i < tokens.length; i++) {
      const token = tokens[i]

      // Skip the first H1 since the page title will be rendered separately
      if (token.type === 'heading' && token.depth === 1 && !skippedFirstH1) {
        skippedFirstH1 = true
        continue
      }

      const lexicalNode = this.tokenToLexicalNode(token)
      if (lexicalNode) {
        children.push(lexicalNode)
      }
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

  /**
   * Convert a marked token to a Lexical node
   */
  private tokenToLexicalNode(token: any): any {
    switch (token.type) {
      case 'heading':
        // For headings, we MUST use token.tokens (parsed inline content)
        let headingTokens = token.tokens
        if (!headingTokens && token.text) {
          // Manually inline lex if tokens aren't provided
          headingTokens = marked.lexer.lexInline(token.text)
        }
        return {
          type: 'heading',
          tag: `h${token.depth}`,
          direction: 'ltr',
          format: '',
          indent: 0,
          version: 1,
          children: this.inlineTokensToLexical(headingTokens || []),
        }

      case 'paragraph':
        // For paragraphs, we MUST use token.tokens (parsed inline content)
        // If token.tokens doesn't exist, we need to manually parse the text
        let inlineTokens = token.tokens
        if (!inlineTokens && token.text) {
          // Manually inline lex if tokens aren't provided
          inlineTokens = marked.lexer.lexInline(token.text)
        }
        return {
          type: 'paragraph',
          direction: 'ltr',
          format: '',
          indent: 0,
          version: 1,
          children: this.inlineTokensToLexical(inlineTokens || []),
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
          children: token.items.map((item: any) => this.listItemToLexical(item)),
        }

      case 'code':
        // Code blocks in Lexical use 'code' type with text children
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

      case 'hr':
        return {
          type: 'horizontalrule',
          version: 1,
        }

      case 'blockquote':
        return {
          type: 'quote',
          direction: 'ltr',
          format: '',
          indent: 0,
          version: 1,
          children: token.tokens
            ? token.tokens.map((t: any) => this.tokenToLexicalNode(t)).filter(Boolean)
            : [],
        }

      case 'space':
        return null // Skip whitespace tokens

      default:
        // For unknown types, try to extract text
        if (token.text) {
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
        }
        return null
    }
  }

  /**
   * Convert list item token to Lexical list item node
   */
  private listItemToLexical(item: any): any {
    let children: any[] = []

    if (item.tokens && item.tokens.length > 0) {
      // Process each token in the list item
      for (const token of item.tokens) {
        if (token.type === 'text' && token.tokens) {
          // This is inline text with nested formatting (bold, italic, etc.)
          // Wrap it in a paragraph
          children.push({
            type: 'paragraph',
            direction: 'ltr',
            format: '',
            indent: 0,
            version: 1,
            children: this.inlineTokensToLexical(token.tokens),
          })
        } else {
          // Block-level token (paragraph, etc.)
          const node = this.tokenToLexicalNode(token)
          if (node) {
            children.push(node)
          }
        }
      }
    } else if (item.text) {
      // If no tokens, parse the text as inline content and wrap in paragraph
      const inlineTokens = marked.lexer.lexInline(item.text)
      children = [{
        type: 'paragraph',
        direction: 'ltr',
        format: '',
        indent: 0,
        version: 1,
        children: this.inlineTokensToLexical(inlineTokens),
      }]
    }

    return {
      type: 'listitem',
      value: 1,
      direction: 'ltr',
      format: '',
      indent: 0,
      version: 1,
      children,
    }
  }

  /**
   * Convert inline tokens (bold, italic, links, etc.) to Lexical text nodes
   */
  private inlineTokensToLexical(tokens: any[]): any[] {
    const children: any[] = []

    for (const token of tokens) {
      switch (token.type) {
        case 'text':
          children.push({
            type: 'text',
            text: token.text,
            detail: 0,
            format: 0,
            mode: 'normal',
            style: '',
            version: 1,
          })
          break

        case 'strong':
          // Bold text (format: 1 = bold)
          if (token.tokens) {
            // Recursively process nested tokens
            const boldChildren = this.inlineTokensToLexical(token.tokens)
            boldChildren.forEach((child) => {
              if (child.type === 'text') {
                child.format = 1 // Bold
              }
              children.push(child)
            })
          } else if (token.text) {
            // Fallback: use raw text
            children.push({
              type: 'text',
              text: token.text,
              detail: 0,
              format: 1, // Bold
              mode: 'normal',
              style: '',
              version: 1,
            })
          }
          break

        case 'em':
          // Italic text (format: 2 = italic)
          if (token.tokens) {
            // Recursively process nested tokens
            const italicChildren = this.inlineTokensToLexical(token.tokens)
            italicChildren.forEach((child) => {
              if (child.type === 'text') {
                child.format = 2 // Italic
              }
              children.push(child)
            })
          } else if (token.text) {
            // Fallback: use raw text
            children.push({
              type: 'text',
              text: token.text,
              detail: 0,
              format: 2, // Italic
              mode: 'normal',
              style: '',
              version: 1,
            })
          }
          break

        case 'codespan':
          children.push({
            type: 'text',
            text: token.text,
            detail: 0,
            format: 16, // Inline code format
            mode: 'normal',
            style: '',
            version: 1,
          })
          break

        case 'link':
          children.push({
            type: 'link',
            url: token.href,
            direction: 'ltr',
            format: '',
            indent: 0,
            version: 1,
            children: this.inlineTokensToLexical(
              token.tokens || [{ type: 'text', text: token.text }]
            ),
          })
          break

        case 'br':
          children.push({
            type: 'linebreak',
            version: 1,
          })
          break

        default:
          // Fallback: treat as plain text
          if (token.text) {
            children.push({
              type: 'text',
              text: token.text,
              detail: 0,
              format: 0,
              mode: 'normal',
              style: '',
              version: 1,
            })
          }
      }
    }

    return children
  }

  /**
   * @deprecated - Keeping for reference, now using marked.js
   * Convert markdown to Lexical JSON format with proper node structures
   */
  private markdownToLexicalOld(markdown: string): any {
    const lines = markdown.split('\n')
    const children: any[] = []

    let currentParagraph: string[] = []
    let currentList: { type: string; items: any[] } | null = null

    const flushParagraph = () => {
      if (currentParagraph.length > 0) {
        const text = currentParagraph.join(' ').trim()
        if (text) {
          children.push({
            type: 'paragraph',
            direction: 'ltr',
            format: '',
            indent: 0,
            version: 1,
            children: [
              {
                type: 'text',
                text,
                detail: 0,
                format: 0,
                mode: 'normal',
                style: '',
                version: 1,
              },
            ],
          })
        }
        currentParagraph = []
      }
    }

    const flushList = () => {
      if (currentList && currentList.items.length > 0) {
        children.push({
          type: 'list',
          listType: currentList.type === 'ul' ? 'bullet' : 'number',
          start: 1,
          tag: currentList.type,
          direction: 'ltr',
          format: '',
          indent: 0,
          version: 1,
          children: currentList.items,
        })
        currentList = null
      }
    }

    for (const line of lines) {
      const trimmed = line.trim()

      // Skip empty lines (they separate paragraphs and lists)
      if (!trimmed) {
        flushParagraph()
        flushList()
        continue
      }

      // Handle headings (Note: H1 is converted to H2 since Hero has the page H1)
      if (trimmed.startsWith('# ')) {
        flushParagraph()
        flushList()
        children.push({
          type: 'heading',
          tag: 'h2', // Convert H1 to H2 for prose content
          direction: 'ltr',
          format: '',
          indent: 0,
          version: 1,
          children: [
            {
              type: 'text',
              text: trimmed.slice(2),
              detail: 0,
              format: 0,
              mode: 'normal',
              style: '',
              version: 1,
            },
          ],
        })
        continue
      }
      if (trimmed.startsWith('## ')) {
        flushParagraph()
        flushList()
        children.push({
          type: 'heading',
          tag: 'h2',
          direction: 'ltr',
          format: '',
          indent: 0,
          version: 1,
          children: [
            {
              type: 'text',
              text: trimmed.slice(3),
              detail: 0,
              format: 0,
              mode: 'normal',
              style: '',
              version: 1,
            },
          ],
        })
        continue
      }
      if (trimmed.startsWith('### ')) {
        flushParagraph()
        flushList()
        children.push({
          type: 'heading',
          tag: 'h3',
          direction: 'ltr',
          format: '',
          indent: 0,
          version: 1,
          children: [
            {
              type: 'text',
              text: trimmed.slice(4),
              detail: 0,
              format: 0,
              mode: 'normal',
              style: '',
              version: 1,
            },
          ],
        })
        continue
      }

      // Handle code blocks
      if (trimmed.startsWith('```')) {
        flushParagraph()
        flushList()
        continue
      }

      // Handle list items
      if (trimmed.startsWith('- ')) {
        flushParagraph()
        const text = trimmed.slice(2)
        if (!currentList || currentList.type !== 'ul') {
          flushList()
          currentList = { type: 'ul', items: [] }
        }
        currentList.items.push({
          type: 'listitem',
          value: currentList.items.length + 1,
          direction: 'ltr',
          format: '',
          indent: 0,
          version: 1,
          children: [
            {
              type: 'text',
              text,
              detail: 0,
              format: 0,
              mode: 'normal',
              style: '',
              version: 1,
            },
          ],
        })
        continue
      }
      if (/^\d+\.\s/.test(trimmed)) {
        flushParagraph()
        const text = trimmed.replace(/^\d+\.\s+/, '')
        if (!currentList || currentList.type !== 'ol') {
          flushList()
          currentList = { type: 'ol', items: [] }
        }
        currentList.items.push({
          type: 'listitem',
          value: currentList.items.length + 1,
          direction: 'ltr',
          format: '',
          indent: 0,
          version: 1,
          children: [
            {
              type: 'text',
              text,
              detail: 0,
              format: 0,
              mode: 'normal',
              style: '',
              version: 1,
            },
          ],
        })
        continue
      }

      // Regular paragraph text
      currentParagraph.push(trimmed)
    }

    // Flush any remaining content
    flushParagraph()
    flushList()

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
  async run() {
    // Get admin user ID
    const admin = await db.from('users').where('email', 'admin@example.com').first()
    if (!admin) {
      console.log('⚠️  Admin user not found. Run user_seeder first.')
      return
    }

    // Delete existing support posts to recreate them
    console.log('🗑️  Removing existing support posts...')
    const existingPosts = await db.from('posts').where('type', 'support').select('id')
    if (existingPosts.length > 0) {
      const postIds = existingPosts.map((p: any) => p.id)
      await db.from('post_modules').whereIn('post_id', postIds).delete()
      await db.from('module_instances').whereIn('post_id', postIds).delete()
      await db.from('posts').whereIn('id', postIds).delete()
      console.log(`   ✓ Deleted ${existingPosts.length} existing support posts\n`)
    }

    const docsPath = join(process.cwd(), 'docs', 'support')
    const files = await readdir(docsPath)
    const mdFiles = files.filter((f) => f.endsWith('.md')).sort()

    // Define hierarchical relationships (parent slug -> child slugs[])
    const hierarchy: Record<string, string[]> = {
      'content-management-overview': ['content-management', 'building-modules'],
    }

    // First pass: create all posts and store IDs by slug
    const postIdsBySlug: Record<string, string> = {}

    for (let i = 0; i < mdFiles.length; i++) {
      const file = mdFiles[i]
      const content = await readFile(join(docsPath, file), 'utf-8')

      // Extract order from filename (e.g., "00-index.md" -> 0)
      const orderMatch = file.match(/^(\d+)-/)
      const orderIndex = orderMatch ? parseInt(orderMatch[1], 10) : i

      // Extract title from first H1
      const titleMatch = content.match(/^#\s+(.+)$/m)
      const title = titleMatch ? titleMatch[1] : file.replace('.md', '')

      // Generate slug from filename
      const slug = file
        .replace(/^\d+-/, '') // Remove number prefix
        .replace('.md', '')

      // Extract subtitle from first paragraph after H1
      const subtitleMatch = content.match(/^#\s+.+\n\n(.+)$/m)
      const subtitle = subtitleMatch ? subtitleMatch[1] : null

      const now = new Date()
      const postId = randomUUID()
      const proseModuleId = randomUUID()

      // Store post ID for later parent-child linking
      postIdsBySlug[slug] = postId

      console.log(`✨ Creating support page: "${title}" (${slug})`)

      // Create post (parent_id will be set in second pass)
      await db.table('posts').insert({
        id: postId,
        title,
        slug,
        type: 'support',
        status: 'published',
        locale: 'en',
        order_index: orderIndex,
        parent_id: null, // Will be updated in second pass
        user_id: admin.id,
        author_id: admin.id,
        created_at: now,
        updated_at: now,
      })

      console.log(`   ✓ Post created with ID: ${postId}`)

      // Create Prose module with full markdown content converted to Lexical JSON
      // Note: Support pages don't use Hero module - title comes from the post itself
      const lexicalContent = await this.markdownToLexical(content)
      await db.table('module_instances').insert({
        id: proseModuleId,
        type: 'prose',
        scope: 'post',
        post_id: postId,
        props: JSON.stringify({
          content: lexicalContent, // Store as Lexical JSON for editing
          backgroundColor: 'bg-backdrop-low',
          maxWidth: '', // Remove max-width constraint for full-width documentation
        }),
        created_at: now,
        updated_at: now,
      })

      // Link prose module to post
      await db.table('post_modules').insert({
        id: randomUUID(),
        post_id: postId,
        module_id: proseModuleId,
        order_index: 0,
        overrides: JSON.stringify({}),
        created_at: now,
        updated_at: now,
      })

      console.log(`   ✓ Modules linked to post\n`)
    }

    // Second pass: set parent_id relationships
    console.log(`🔗 Setting up hierarchical relationships...`)
    for (const [parentSlug, childSlugs] of Object.entries(hierarchy)) {
      const parentId = postIdsBySlug[parentSlug]
      if (!parentId) {
        console.log(`   ⚠️  Parent '${parentSlug}' not found, skipping children`)
        continue
      }

      for (const childSlug of childSlugs) {
        const childId = postIdsBySlug[childSlug]
        if (!childId) {
          console.log(`   ⚠️  Child '${childSlug}' not found`)
          continue
        }

        await db
          .from('posts')
          .where('id', childId)
          .update({ parent_id: parentId })

        console.log(`   ✓ Set '${childSlug}' as child of '${parentSlug}'`)
      }
    }

    console.log(`\n✅ Support documentation setup complete!`)
  }
}
