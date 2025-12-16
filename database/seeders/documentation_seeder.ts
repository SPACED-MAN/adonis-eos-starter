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
   * Optionally transforms links if context is provided
   */
  private async markdownToLexical(
    markdown: string,
    context?: {
      currentFile?: { file: string; path: string; dir: string }
      allFiles?: Array<{ file: string; path: string; dir: string }>
      postIdsBySlug?: Record<string, string>
    }
  ): Promise<any> {
    // Store context for link transformation
    if (context) {
      ;(this as any).currentFile = context.currentFile
      ;(this as any).allFiles = context.allFiles
      ;(this as any).postIdsBySlug = context.postIdsBySlug
    }

    // Parse markdown tokens
    const tokens = marked.lexer(markdown)

    // Skip first H1 if present
    let startIndex = 0
    if (tokens.length > 0 && tokens[0].type === 'heading' && tokens[0].depth === 1) {
      startIndex = 1
    }

    // Convert tokens to Lexical nodes
    const children = tokens
      .slice(startIndex)
      .map((token) => this.tokenToLexicalNode(token))
      .filter(Boolean)

    return {
      root: {
        children,
        direction: 'ltr',
        format: '',
        indent: 0,
        type: 'root',
        version: 1,
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
          // Parse inline tokens from text
          const inlineMarkdown = marked.lexer(token.text)
          headingTokens = inlineMarkdown.flatMap((t: any) => t.tokens || [t])
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
          // Parse inline tokens from text
          const inlineMarkdown = marked.lexer(token.text)
          inlineTokens = inlineMarkdown.flatMap((t: any) => t.tokens || [t])
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
      // Parse inline tokens from text
      const inlineMarkdown = marked.lexer(item.text)
      const inlineTokens = inlineMarkdown.flatMap((t: any) => t.tokens || [t])
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
          // Transform link URL if transformLinkUrl is available (passed via context)
          const originalHref = token.href
          const transformedHref = (this as any).transformLinkUrl
            ? (this as any).transformLinkUrl(
                originalHref,
                (this as any).currentFile,
                (this as any).allFiles,
                (this as any).postIdsBySlug
              )
            : originalHref

          children.push({
            type: 'link',
            url: transformedHref,
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
   * Update links in Lexical content to use hierarchical paths
   */
  private updateLinksInLexical(
    lexicalContent: any,
    slugToPath: Record<string, string>,
    allFiles: Array<{ file: string; path: string; dir: string }>,
    postIdsBySlug: Record<string, string>
  ): any {
    if (!lexicalContent || !lexicalContent.root) return lexicalContent

    const updateNode = (node: any): any => {
      if (!node) return node

      // Update link URLs
      if (node.type === 'link' && node.url) {
        const updatedUrl = this.transformLinkUrlToHierarchical(
          node.url,
          slugToPath,
          allFiles,
          postIdsBySlug
        )
        return {
          ...node,
          url: updatedUrl,
          children: node.children ? node.children.map(updateNode) : [],
        }
      }

      // Recursively update children
      if (node.children && Array.isArray(node.children)) {
        return {
          ...node,
          children: node.children.map(updateNode),
        }
      }

      return node
    }

    return {
      ...lexicalContent,
      root: {
        ...lexicalContent.root,
        children: lexicalContent.root.children ? lexicalContent.root.children.map(updateNode) : [],
      },
    }
  }

  /**
   * Transform link URL to hierarchical CMS path
   * This is called after hierarchy is established and canonical paths are generated
   */
  private transformLinkUrlToHierarchical(
    href: string,
    slugToPath: Record<string, string>,
    allFiles: Array<{ file: string; path: string; dir: string }>,
    postIdsBySlug: Record<string, string>
  ): string {
    // Skip external links, anchors, and mailto: links
    if (
      href.startsWith('http://') ||
      href.startsWith('https://') ||
      href.startsWith('mailto:') ||
      href.startsWith('#')
    ) {
      return href
    }

    // Fix legacy "for-developers" links to "developers"
    if (href.startsWith('/docs/for-developers')) {
      href = href.replace('/docs/for-developers', '/docs/developers')
    }

    // Handle hierarchical paths like /docs/developers/theming
    if (href.startsWith('/docs/')) {
      // Extract the path parts
      const pathMatch = href.match(/^\/docs\/(.+)$/)
      if (pathMatch) {
        const pathParts = pathMatch[1].split('/')
        
        // If it's a nested path (e.g., developers/theming), try to resolve the child slug
        if (pathParts.length === 2) {
          const [parentSlug, childSlug] = pathParts
          // Check if we have a hierarchical path for this child
          if (slugToPath[childSlug]) {
            return slugToPath[childSlug]
          }
          // Fallback: construct the path manually
          if (parentSlug === 'developers' || parentSlug === 'editors') {
            return `/docs/${parentSlug}/${childSlug}`
          }
        }
        
        // If it's a single slug (e.g., /docs/developers), look it up
        if (pathParts.length === 1) {
          const slug = pathParts[0]
          if (slugToPath[slug]) {
            return slugToPath[slug]
          }
        }
      }
      
      // If we can't resolve it hierarchically, return as-is (might be a valid path)
      return href
    }

    // Try to resolve from slug-to-path mapping
    // Extract slug from simple /docs/{slug} format
    const slugMatch = href.match(/^\/docs\/([^/]+)$/)
    if (slugMatch) {
      const slug = slugMatch[1]
      if (slugToPath[slug]) {
        return slugToPath[slug]
      }
    }

    // Handle relative markdown paths (should have been transformed already, but handle just in case)
    if (href.endsWith('.md')) {
      const currentFile = (this as any).currentFile
      if (currentFile) {
        const transformed = this.transformLinkUrl(href, currentFile, allFiles, postIdsBySlug)
        // If transformation resulted in /docs/{slug}, look up hierarchical path
        const slugMatch2 = transformed.match(/^\/docs\/([^/]+)$/)
        if (slugMatch2 && slugToPath[slugMatch2[1]]) {
          return slugToPath[slugMatch2[1]]
        }
        return transformed
      }
    }

    // Return as-is if we can't resolve it
    return href
  }

  /**
   * Transform markdown link URLs to CMS URLs
   * Handles both relative markdown paths (for GitHub) and absolute paths (for CMS)
   * This is called during initial markdown parsing (before hierarchy is established)
   */
  private transformLinkUrl(
    href: string,
    currentFile: { file: string; path: string; dir: string },
    allFiles: Array<{ file: string; path: string; dir: string }>,
    postIdsBySlug: Record<string, string>
  ): string {
    // Skip external links, anchors, and mailto: links
    if (
      href.startsWith('http://') ||
      href.startsWith('https://') ||
      href.startsWith('mailto:') ||
      href.startsWith('#')
    ) {
      return href
    }

    // Handle absolute paths that already point to docs (e.g., /docs/developers/ai-agents)
    if (href.startsWith('/docs/')) {
      // Fix legacy "for-developers" links to "developers"
      if (href.startsWith('/docs/for-developers')) {
        return href.replace('/docs/for-developers', '/docs/developers')
      }
      return href
    }

    // Handle relative markdown paths (e.g., ../developers/09-ai-agents.md or developers/09-ai-agents.md)
    if (href.endsWith('.md')) {
      // Resolve relative path
      const currentDirPath = currentFile.dir === 'root' ? '' : currentFile.dir

      let targetPath: string
      if (href.startsWith('../')) {
        // Parent directory (e.g., ../developers/09-ai-agents.md from editors/)
        const parts = href.replace('../', '').split('/')
        targetPath = join(process.cwd(), 'docs', ...parts)
      } else if (href.startsWith('./')) {
        // Same directory (e.g., ./09-ai-agents.md)
        targetPath = join(process.cwd(), 'docs', currentDirPath, href.replace('./', ''))
      } else {
        // Relative to docs root or same directory
        if (href.includes('/')) {
          // Has directory (e.g., developers/09-ai-agents.md)
          targetPath = join(process.cwd(), 'docs', href)
        } else {
          // Same directory (e.g., 09-ai-agents.md)
          targetPath = join(process.cwd(), 'docs', currentDirPath, href)
        }
      }

      // Find the target file in allFiles
      const targetFile = allFiles.find((f) => {
        const normalized = f.path.replace(/\\/g, '/')
        const normalizedTarget = targetPath.replace(/\\/g, '/')
        return normalized === normalizedTarget
      })

      if (targetFile) {
        // Generate slug from target file (same logic as in run())
        let targetSlug = targetFile.file.replace(/^\d+[a-z]?-/, '').replace('.md', '')

        // Apply same remapping as in run()
        if (targetSlug === 'quick-start') {
          targetSlug = 'editors'
        } else if (targetSlug === 'getting-started') {
          targetSlug = 'developers'
        }

        // Check for slug collision and apply same logic
        const dirSuffix =
          targetFile.dir === 'developers'
            ? 'developers'
            : targetFile.dir === 'editors'
              ? 'editors'
              : 'root'
        let candidate = targetSlug
        if (
          postIdsBySlug[candidate] &&
          candidate !== 'editors' &&
          candidate !== 'developers' &&
          candidate !== 'overview'
        ) {
          candidate = `${targetSlug}-${dirSuffix}`
        }
        if (
          postIdsBySlug[candidate] &&
          candidate !== 'editors' &&
          candidate !== 'developers' &&
          candidate !== 'overview'
        ) {
          let n = 2
          while (postIdsBySlug[`${candidate}-${n}`]) n++
          candidate = `${candidate}-${n}`
        }

        // Build CMS URL using hierarchical path
        // For now, use simple slug-based URL - will be updated after hierarchy is set
        return `/docs/${candidate}`
      }
    }

    // Handle paths that look like CMS paths but without /docs prefix
    if (href.startsWith('/editors/') || href.startsWith('/developers/')) {
      return `/docs${href}`
    }

    // Return as-is if we can't resolve it
    return href
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
    } catch {}

    // Read from docs/developers/
    try {
      const developersPath = join(docsPath, 'developers')
      const developerFiles = await readdir(developersPath)
      for (const file of developerFiles.filter((f) => f.endsWith('.md'))) {
        allFiles.push({ file, path: join(developersPath, file), dir: 'developers' })
      }
    } catch {}

    // Sort by directory (root first) then by filename
    allFiles.sort((a, b) => {
      const dirOrder = { root: 0, editors: 1, developers: 2 }
      const dirDiff =
        dirOrder[a.dir as keyof typeof dirOrder] - dirOrder[b.dir as keyof typeof dirOrder]
      if (dirDiff !== 0) return dirDiff
      return a.file.localeCompare(b.file)
    })

    // Define hierarchical relationships (parent slug -> child slugs[])
    const hierarchy: Record<string, string[]> = {
      // "Documentation" (overview) is standalone with no children
      // "Editors" and "Developers" are top-level with their own children

      // Group all editor guides under "Editors"
      editors: [
        'content-management',
        'review-workflow',
        'modules-guide',
        'media',
        'translations',
        'roles-permissions',
      ],
      // Group all developer guides under "Developers" (ordered)
      developers: [
        'content-management-overview',
        'theming',
        'building-modules',
        'api-reference',
        'webhooks',
        'seo-and-routing',
        'internationalization',
        'taxonomies',
        'ai-agents',
        'mcp',
        'export-import',
        'review-workflow-developers',
        'media-pipeline',
        'preview-system',
        'menus',
        'custom-fields',
        'rbac-and-permissions',
        'deployment',
        'update-philosophy',
        'cli-commands',
      ],
    }

    // First pass: create all posts and store IDs by slug
    const postIdsBySlug: Record<string, string> = {}

    // Create the "Documentation" overview post from docs/00-index.md FIRST
    console.log('✨ Creating Documentation overview from docs/00-index.md')
    const docsIndexPath = join(docsPath, '00-index.md')
    const indexContent = await readFile(docsIndexPath, 'utf-8')

    // Extract title and subtitle from docs index
    const indexTitleMatch = indexContent.match(/^#\s+(.+)$/m)
    const indexTitle = indexTitleMatch ? indexTitleMatch[1] : 'Documentation'
    const indexSubtitleMatch = indexContent.match(/^#\s+.+\n\n(.+)$/m)
    const indexSubtitle = indexSubtitleMatch ? indexSubtitleMatch[1] : null

    const overviewPost = await CreatePost.handle({
      type: 'documentation',
      locale: 'en',
      slug: 'overview',
      title: indexTitle,
      status: 'published',
      excerpt: indexSubtitle,
      userId: admin.id,
    })

    // Update order_index to 0 (top of list)
    await db.from('posts').where('id', overviewPost.id).update({ order_index: 0 })
    postIdsBySlug['overview'] = overviewPost.id

    console.log(`   ✓ Post created with ID: ${overviewPost.id}`)

    // Add Prose module with docs index content (after template modules: reading-progress=0, breadcrumb=1)
    // Note: Index file links will be transformed in second pass after all posts are created
    const indexLexicalContent = await this.markdownToLexical(indexContent, {
      currentFile: { file: '00-index.md', path: docsIndexPath, dir: 'root' },
      allFiles: [],
      postIdsBySlug: {},
    })
    await AddModuleToPost.handle({
      postId: overviewPost.id,
      moduleType: 'prose',
      scope: 'local',
      props: {
        content: indexLexicalContent,
        backgroundColor: 'bg-backdrop-low',
        maxWidth: '',
      },
      orderIndex: 2,
    })

    console.log(`   ✓ Module added with docs index content\n`)

    for (const [i, fileInfo] of allFiles.entries()) {
      const { file, path: filePath, dir } = fileInfo
      const content = await readFile(filePath, 'utf-8')

      // Extract order from filename (e.g., "00-index.md" -> 0)
      const orderMatch = file.match(/^(\d+)-/)
      const orderIndex = orderMatch ? Number.parseInt(orderMatch[1], 10) : i

      // Extract title from first H1
      const titleMatch = content.match(/^#\s+(.+)$/m)
      const title = titleMatch ? titleMatch[1] : file.replace('.md', '')

      // Generate slug from filename (remove both numeric prefix and letter suffix)
      let slug = file
        .replace(/^\d+[a-z]?-/, '') // Remove number prefix (with optional letter like 03a-)
        .replace('.md', '')

      // Remap key landing pages to friendly slugs for top-level docs navigation
      if (slug === 'quick-start') {
        slug = 'editors'
      } else if (slug === 'getting-started') {
        slug = 'developers'
      }

      // Skip reference-only pages (handled elsewhere or consolidated)
      if (slug === 'index' || slug === 'overview' || slug === 'sitemap') {
        console.log(`   ⏭️  Skipping ${slug} page (handled separately)\n`)
        continue
      }

      /**
       * Slug collision handling
       *
       * Editors + Developers can legitimately have similarly named pages
       * (e.g. both may have "review-workflow"). Since slugs are unique per locale,
       * ensure we generate a deterministic unique slug for docs pages.
       *
       * Policy:
       * - Prefer the "plain" slug when available.
       * - If it collides, suffix with "-developers" or "-editors" based on the source dir.
       */
      const dirSuffix = dir === 'developers' ? 'developers' : dir === 'editors' ? 'editors' : 'root'
      const baseSlug = slug
      let candidate = slug
      if (postIdsBySlug[candidate]) {
        candidate = `${baseSlug}-${dirSuffix}`
      }
      if (postIdsBySlug[candidate]) {
        // last-resort: append counter
        let n = 2
        while (postIdsBySlug[`${candidate}-${n}`]) n++
        candidate = `${candidate}-${n}`
      }
      slug = candidate

      // Extract subtitle from first paragraph after H1
      const subtitleMatch = content.match(/^#\s+.+\n\n(.+)$/m)
      const subtitle = subtitleMatch ? subtitleMatch[1] : null

      // Rename pages for better navigation structure
      let displayTitle = title
      if (slug === 'editors') {
        displayTitle = 'For Editors'
      } else if (slug === 'developers') {
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
      // Set specific order for top-level pages: Documentation (0), Editors (1), Developers (2)
      let finalOrderIndex = orderIndex
      if (slug === 'editors') {
        finalOrderIndex = 1
      } else if (slug === 'developers') {
        finalOrderIndex = 2
      }
      await db.from('posts').where('id', post.id).update({ order_index: finalOrderIndex })

      // Store post ID for later parent-child linking
      postIdsBySlug[slug] = post.id

      console.log(`   ✓ Post created with ID: ${post.id}`)

      // Add Prose module using AddModuleToPost action (same as API endpoint)
      // Note: Documentation pages don't use Hero module - title comes from the post itself
      // Template modules: reading-progress=0, breadcrumb=1, so prose starts at 2
      // Transform links to CMS URLs during conversion
      const lexicalContent = await this.markdownToLexical(content, {
        currentFile: fileInfo,
        allFiles,
        postIdsBySlug,
      })
      await AddModuleToPost.handle({
        postId: post.id,
        moduleType: 'prose',
        scope: 'local',
        props: {
          content: lexicalContent, // Store as Lexical JSON for editing
          backgroundColor: 'bg-backdrop-low',
          maxWidth: '', // Remove max-width constraint for full-width documentation
        },
        orderIndex: 2,
      })

      console.log(`   ✓ Module added via API action\n`)
    }

    // Second pass: set parent_id relationships (and ordering where defined)
    console.log(`🔗 Setting up hierarchical relationships...`)
    for (const [parentSlug, childSlugs] of Object.entries(hierarchy)) {
      const parentId = postIdsBySlug[parentSlug]
      if (!parentId) {
        console.log(`   ⚠️  Parent '${parentSlug}' not found, skipping children`)
        continue
      }

      for (const [idx, childSlug] of childSlugs.entries()) {
        const childId = postIdsBySlug[childSlug]
        if (!childId) {
          console.log(`   ⚠️  Child '${childSlug}' not found`)
          continue
        }

        await db
          .from('posts')
          .where('id', childId)
          .update({ parent_id: parentId, order_index: idx + 1 })

        console.log(`   ✓ Set '${childSlug}' as child of '${parentSlug}'`)
      }
    }

    // Third pass: ensure URL patterns exist, then regenerate canonical URLs now that hierarchy is established
    console.log(`\n🔗 Regenerating canonical URLs with hierarchical paths...`)
    const urlPatternServiceModule = await import('#services/url_pattern_service')
    const localeServiceModule = await import('#services/locale_service')
    const urlPatternService = urlPatternServiceModule.default
    const localeService = localeServiceModule.default

    // Ensure URL patterns are in the database before building paths
    const locales = await localeService.getSupportedLocales()
    await urlPatternService.ensureDefaultsForPostType('documentation', locales)

    // Build slug-to-canonical-path mapping for link transformation
    const slugToPath: Record<string, string> = {}

    const allPostIds = Object.values(postIdsBySlug)

    for (const [slug, postId] of Object.entries(postIdsBySlug)) {
      try {
        const canonicalPath = await urlPatternService.buildPostPathForPost(postId)
        await db.from('posts').where('id', postId).update({ canonical_url: canonicalPath })
        slugToPath[slug] = canonicalPath
      } catch (error) {
        console.log(`   ⚠️  Failed to generate canonical URL for post ${postId}`)
      }
    }

    console.log(`   ✓ Regenerated ${allPostIds.length} canonical URLs`)

    // Fourth pass: update links in all posts to use hierarchical paths
    console.log(`\n🔗 Updating links to use hierarchical paths...`)
    for (const [slug, postId] of Object.entries(postIdsBySlug)) {
      try {
        // Get the post's prose module
        const postModules = await db
          .from('post_modules')
          .where('post_id', postId)
          .where('type', 'prose')
          .select('id', 'props')
          .first()

        if (postModules && postModules.props) {
          const props = postModules.props as any
          if (props.content && props.content.root) {
            // Recursively update links in Lexical content
            const updatedContent = this.updateLinksInLexical(
              props.content,
              slugToPath,
              allFiles,
              postIdsBySlug
            )

            // Update the module props
            await db
              .from('post_modules')
              .where('id', postModules.id)
              .update({ props: { ...props, content: updatedContent } })
          }
        }
      } catch (error) {
        console.log(`   ⚠️  Failed to update links for post ${slug}: ${error}`)
      }
    }

    // Also update the overview post (index file)
    try {
      const overviewModules = await db
        .from('post_modules')
        .where('post_id', overviewPost.id)
        .where('type', 'prose')
        .select('id', 'props')
        .first()

      if (overviewModules && overviewModules.props) {
        const props = overviewModules.props as any
        if (props.content && props.content.root) {
          const updatedContent = this.updateLinksInLexical(
            props.content,
            slugToPath,
            allFiles,
            postIdsBySlug
          )

          await db
            .from('post_modules')
            .where('id', (overviewModules as any).id)
            .update({ props: { ...props, content: updatedContent } })
        }
      }
    } catch (error) {
      console.log(`   ⚠️  Failed to update links for overview post: ${error}`)
    }

    console.log(`   ✓ Updated links in all posts`)

    console.log(`\n✅ Documentation setup complete!`)
  }
}
