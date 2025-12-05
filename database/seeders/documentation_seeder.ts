import { BaseSeeder } from '@adonisjs/lucid/seeders'
import db from '@adonisjs/lucid/services/db'
import CreatePost from '#actions/posts/create_post'
import AddModuleToPost from '#actions/posts/add_module_to_post'
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

    for (const token of tokens) {
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
      children = [
        {
          type: 'paragraph',
          direction: 'ltr',
          format: '',
          indent: 0,
          version: 1,
          children: this.inlineTokensToLexical(inlineTokens),
        },
      ]
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

  async run() {
    // Get admin user ID
    const admin = await db.from('users').where('email', 'admin@example.com').first()
    if (!admin) {
      console.log('⚠️  Admin user not found. Run user_seeder first.')
      return
    }

    // Delete existing documentation posts to recreate them
    console.log('🗑️  Removing existing documentation posts...')
    const existingPosts = await db.from('posts').where('type', 'documentation').select('id')
    if (existingPosts.length > 0) {
      const postIds = existingPosts.map((p: any) => p.id)
      await db.from('post_modules').whereIn('post_id', postIds).delete()
      await db.from('module_instances').whereIn('post_id', postIds).delete()
      await db.from('posts').whereIn('id', postIds).delete()
      console.log(`   ✓ Deleted ${existingPosts.length} existing documentation posts\n`)
    }

    // Collect markdown files from all documentation directories
    const docsPath = join(process.cwd(), 'docs')
    const allFiles: Array<{ file: string; path: string; dir: string }> = []

    // Read from docs/editors/
    try {
      const editorsPath = join(docsPath, 'editors')
      const editorFiles = await readdir(editorsPath)
      for (const file of editorFiles.filter((f) => f.endsWith('.md'))) {
        allFiles.push({ file, path: join(editorsPath, file), dir: 'editors' })
      }
    } catch { }

    // Read from docs/developers/
    try {
      const developersPath = join(docsPath, 'developers')
      const developerFiles = await readdir(developersPath)
      for (const file of developerFiles.filter((f) => f.endsWith('.md'))) {
        allFiles.push({ file, path: join(developersPath, file), dir: 'developers' })
      }
    } catch { }

    // Sort by directory (root first) then by filename
    allFiles.sort((a, b) => {
      const dirOrder = { root: 0, editors: 1, developers: 2 }
      const dirDiff = dirOrder[a.dir as keyof typeof dirOrder] - dirOrder[b.dir as keyof typeof dirOrder]
      if (dirDiff !== 0) return dirDiff
      return a.file.localeCompare(b.file)
    })

    // Define hierarchical relationships (parent slug -> child slugs[])
    const hierarchy: Record<string, string[]> = {
      // "Documentation" (overview) is standalone with no children
      // "For Editors" and "For Developers" are top-level with their own children
      
      // Group all editor guides under "For Editors"
      'quick-start': [
        'content-management',
        'modules-guide',
        'review-workflow',
        'media',
        'translations',
        'roles-permissions',
      ],
      // Group all developer guides under "For Developers"
      'getting-started': [
        'api-reference',
        'building-modules',
        'theming',
        'routing',
        'internationalization',
        'content-management-overview',
        'ai-agents',
        'deployment',
      ],
    }

    // First pass: create all posts and store IDs by slug
    const postIdsBySlug: Record<string, string> = {}

    // Create the "Documentation" overview post from README.md FIRST
    console.log('✨ Creating Documentation overview from README.md')
    const readmePath = join(process.cwd(), 'README.md')
    const readmeContent = await readFile(readmePath, 'utf-8')
    
    // Extract title and subtitle from README
    const readmeTitleMatch = readmeContent.match(/^#\s+(.+)$/m)
    const readmeTitle = readmeTitleMatch ? readmeTitleMatch[1] : 'Documentation'
    const readmeSubtitleMatch = readmeContent.match(/^#\s+.+\n\n(.+)$/m)
    const readmeSubtitle = readmeSubtitleMatch ? readmeSubtitleMatch[1] : null

    const overviewPost = await CreatePost.handle({
      type: 'documentation',
      locale: 'en',
      slug: 'overview',
      title: 'Documentation',
      status: 'published',
      excerpt: readmeSubtitle,
      userId: admin.id,
    })

    // Update order_index to 0 (top of list)
    await db.from('posts').where('id', overviewPost.id).update({ order_index: 0 })
    postIdsBySlug['overview'] = overviewPost.id

    console.log(`   ✓ Post created with ID: ${overviewPost.id}`)

    // Add Prose module with README content
    const readmeLexicalContent = await this.markdownToLexical(readmeContent)
    await AddModuleToPost.handle({
      postId: overviewPost.id,
      moduleType: 'prose',
      scope: 'local',
      props: {
        content: readmeLexicalContent,
        backgroundColor: 'bg-backdrop-low',
        maxWidth: '',
      },
      orderIndex: 0,
    })

    console.log(`   ✓ Module added with README content\n`)

    for (const [i, fileInfo] of allFiles.entries()) {
      const { file, path: filePath } = fileInfo
      const content = await readFile(filePath, 'utf-8')

      // Extract order from filename (e.g., "00-index.md" -> 0)
      const orderMatch = file.match(/^(\d+)-/)
      const orderIndex = orderMatch ? Number.parseInt(orderMatch[1], 10) : i

      // Extract title from first H1
      const titleMatch = content.match(/^#\s+(.+)$/m)
      const title = titleMatch ? titleMatch[1] : file.replace('.md', '')

      // Generate slug from filename (remove both numeric prefix and letter suffix)
      const slug = file
        .replace(/^\d+[a-z]?-/, '') // Remove number prefix (with optional letter like 03a-)
        .replace('.md', '')

      // Skip the index page - it's just a reference page, not needed in the CMS
      if (slug === 'index' || slug === 'overview') {
        console.log(`   ⏭️  Skipping ${slug} page (handled separately)\n`)
        continue
      }

      // Extract subtitle from first paragraph after H1
      const subtitleMatch = content.match(/^#\s+.+\n\n(.+)$/m)
      const subtitle = subtitleMatch ? subtitleMatch[1] : null

      // Rename pages for better navigation structure
      let displayTitle = title
      if (slug === 'quick-start') {
        displayTitle = 'For Editors'
      } else if (slug === 'getting-started') {
        displayTitle = 'For Developers'
      }

      console.log(`✨ Creating documentation page: "${displayTitle}" (${slug})`)

      // Create post using CreatePost action (parent_id will be set in second pass)
      const post = await CreatePost.handle({
        type: 'documentation',
        locale: 'en',
        slug,
        title: displayTitle,
        status: 'published',
        excerpt: subtitle,
        userId: admin.id,
      })

      // Update order_index (not handled by CreatePost)
      // Set specific order for top-level pages: Documentation (0), For Editors (1), For Developers (2)
      let finalOrderIndex = orderIndex
      if (slug === 'quick-start') {
        finalOrderIndex = 1
      } else if (slug === 'getting-started') {
        finalOrderIndex = 2
      }
      await db.from('posts').where('id', post.id).update({ order_index: finalOrderIndex })

      // Store post ID for later parent-child linking
      postIdsBySlug[slug] = post.id

      console.log(`   ✓ Post created with ID: ${post.id}`)

      // Add Prose module using AddModuleToPost action (same as API endpoint)
      // Note: Documentation pages don't use Hero module - title comes from the post itself
      const lexicalContent = await this.markdownToLexical(content)
      await AddModuleToPost.handle({
        postId: post.id,
        moduleType: 'prose',
        scope: 'local',
        props: {
          content: lexicalContent, // Store as Lexical JSON for editing
          backgroundColor: 'bg-backdrop-low',
          maxWidth: '', // Remove max-width constraint for full-width documentation
        },
        orderIndex: 0,
      })

      console.log(`   ✓ Module added via API action\n`)
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

        await db.from('posts').where('id', childId).update({ parent_id: parentId })

        console.log(`   ✓ Set '${childSlug}' as child of '${parentSlug}'`)
      }
    }

    // Third pass: ensure URL patterns exist, then regenerate canonical URLs now that hierarchy is established
    console.log(`\n🔗 Regenerating canonical URLs with hierarchical paths...`)
    const urlPatternService = (await import('#services/url_pattern_service')).default
    const localeService = (await import('#services/locale_service')).default
    
    // Ensure URL patterns are in the database before building paths
    const locales = await localeService.getSupportedLocales()
    await urlPatternService.ensureDefaultsForPostType('documentation', locales)
    
    const allPostIds = Object.values(postIdsBySlug)
    
    for (const postId of allPostIds) {
      try {
        const canonicalPath = await urlPatternService.buildPostPathForPost(postId)
        await db.from('posts').where('id', postId).update({ canonical_url: canonicalPath })
      } catch (error) {
        console.log(`   ⚠️  Failed to generate canonical URL for post ${postId}`)
      }
    }
    
    console.log(`   ✓ Regenerated ${allPostIds.length} canonical URLs`)

    console.log(`\n✅ Documentation setup complete!`)
  }
}
