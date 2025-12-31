import { BaseSeeder } from '@adonisjs/lucid/seeders'
import db from '@adonisjs/lucid/services/db'
import CreatePost from '#actions/posts/create_post'
import AddModuleToPost from '#actions/posts/add_module_to_post'
import { readFile, readdir } from 'node:fs/promises'
import { join, dirname, resolve } from 'node:path'
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
      ; (this as any).currentFile = context.currentFile
        ; (this as any).allFiles = context.allFiles
        ; (this as any).postIdsBySlug = context.postIdsBySlug
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
    postIdsBySlug: Record<string, string>,
    baseSlugToDir?: Record<string, string>
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
          postIdsBySlug,
          baseSlugToDir
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
    postIdsBySlug: Record<string, string>,
    baseSlugToDir?: Record<string, string>
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

    // Handle paths starting with /docs/
    if (href.startsWith('/docs/')) {
      // Fix "for-developers" links to "developers"
      if (href.startsWith('/docs/for-developers')) {
        href = href.replace('/docs/for-developers', '/docs/developers')
      }
      if (href.startsWith('/docs/for-editors')) {
        href = href.replace('/docs/for-editors', '/docs/editors')
      }

      // Extract the path parts
      const pathMatch = href.match(/^\/docs\/(.+)$/)
      if (pathMatch) {
        const pathParts = pathMatch[1].split('/').filter(Boolean)

        // If it's a nested path (e.g., developers/theming)
        if (pathParts.length === 2) {
          const [parentSlug, childSlug] = pathParts
          // First, try to resolve the child slug directly (most accurate)
          if (slugToPath[childSlug]) {
            return slugToPath[childSlug]
          }
          // Fallback: construct the path manually if parent is valid
          if (parentSlug === 'developers' || parentSlug === 'editors') {
            return `/docs/${parentSlug}/${childSlug}`
          }
        }

        // If it's a single slug (e.g., /docs/theming or /docs/developers)
        if (pathParts.length === 1) {
          const slug = pathParts[0]

          // Skip if it's a top-level parent slug (developers/editors/overview)
          if (slug === 'developers' || slug === 'editors' || slug === 'overview') {
            return href
          }

          // Look up the hierarchical path for this slug
          if (slugToPath[slug]) {
            return slugToPath[slug]
          }

          // If not found, try to resolve using baseSlugToDir mapping
          // This helps when links use base slugs (e.g., /docs/theming) but
          // the actual slug might have a suffix due to collision (e.g., theming-developers)
          if (baseSlugToDir && baseSlugToDir[slug]) {
            const dir = baseSlugToDir[slug]
            // Try the slug with directory suffix first (most likely collision pattern)
            if (dir !== 'root') {
              const dirSuffix = dir === 'developers' ? 'developers' : 'editors'
              const candidateSlug = `${slug}-${dirSuffix}`
              if (slugToPath[candidateSlug]) {
                return slugToPath[candidateSlug]
              }
              // If not found with suffix, construct the hierarchical path directly
              // This ensures links like /docs/theming resolve to /docs/developers/theming
              return `/docs/${dir}/${slug}`
            }
          } else {
            // Try common suffixes (in case of slug collisions)
            // e.g., if slug is "theming" but stored as "theming-developers"
            const suffixes = ['developers', 'editors']
            for (const suffix of suffixes) {
              const candidateSlug = `${slug}-${suffix}`
              if (slugToPath[candidateSlug]) {
                return slugToPath[candidateSlug]
              }
            }
          }

          // If still not found, return as-is (might be invalid or handled elsewhere)
          return href
        }

        // If it's more than 2 parts, try to resolve the last part as a slug
        if (pathParts.length > 2) {
          const lastSlug = pathParts[pathParts.length - 1]
          if (slugToPath[lastSlug]) {
            return slugToPath[lastSlug]
          }
        }
      }

      // If we can't resolve it, return as-is (might be a valid path we don't know about)
      return href
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
      return href
    }

    // Handle relative markdown paths (e.g., ../developers/09-ai-agents.md or developers/09-ai-agents.md)
    if (href.endsWith('.md')) {
      const currentFileDir = dirname(currentFile.path)
      const targetPath = resolve(currentFileDir, href)

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
          targetFile.dir.startsWith('developers')
            ? 'developers'
            : targetFile.dir.startsWith('editors')
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

    // Collect markdown files from all documentation directories recursively
    const docsPath = join(process.cwd(), 'docs')
    const allFiles: Array<{ file: string; path: string; dir: string }> = []

    const scanDir = async (dir: string) => {
      const items = await readdir(dir, { withFileTypes: true })
      for (const item of items) {
        const fullPath = join(dir, item.name)
        if (item.isDirectory()) {
          await scanDir(fullPath)
        } else if (item.name.endsWith('.md')) {
          // Skip the index file as it's handled separately
          if (item.name === '00-index.md') continue

          // Determine the directory relative to docs root
          const relPath = fullPath.replace(docsPath, '').replace(/^[/\\]/, '')
          const parts = relPath.split(/[/\\]/)
          // dir should be the directory part of the relative path
          const fileDir = parts.length > 1 ? parts.slice(0, -1).join('/') : 'root'

          allFiles.push({ file: item.name, path: fullPath, dir: fileDir })
        }
      }
    }

    await scanDir(docsPath)

    // Sort by directory (root first) then by filename
    allFiles.sort((a, b) => {
      const dirOrder = { root: 0, editors: 1, developers: 2 }
      const aBase = a.dir.split('/')[0]
      const bBase = b.dir.split('/')[0]
      const aOrder = dirOrder[aBase as keyof typeof dirOrder] ?? 99
      const bOrder = dirOrder[bBase as keyof typeof dirOrder] ?? 99

      if (aOrder !== bOrder) return aOrder - bOrder
      if (a.dir !== b.dir) return a.dir.localeCompare(b.dir)
      return a.file.localeCompare(b.file)
    })

    // Define hierarchical relationships (parent slug -> child slugs[])
    const hierarchy: Record<string, string[]> = {
      editors: ['basics', 'collaboration', 'management'],
      basics: ['quick-start', 'content-management', 'modules-guide'],
      collaboration: ['review-workflow', 'feedback', 'roles-permissions'],
      management: ['media', 'translations', 'seo-and-ab-testing'],
      developers: [
        'getting-started',
        'architecture',
        'extending-the-cms',
        'automation-and-ai',
        'content-and-data',
        'operations-and-security',
      ],
      'getting-started': ['installation', 'project-structure', 'deployment', 'update-philosophy'],
      architecture: [
        'concepts',
        'content-management-overview',
        'api-reference',
        'services-and-actions',
      ],
      'extending-the-cms': ['theming', 'building-modules', 'global-modules', 'advanced-customization'],
      'automation-and-ai': ['workflows-and-webhooks', 'ai-agents', 'mcp'],
      'content-and-data': [
        'taxonomies',
        'menus',
        'custom-fields',
        'media-pipeline',
        'seo-and-routing',
        'internationalization',
        'user-interaction',
      ],
      'operations-and-security': [
        'cli-and-operations',
        'review-workflow-developers',
        'preview-system',
        'rbac-and-permissions',
        'analytics',
      ],
    }

    // First pass: create all posts and store IDs by slug
    const postIdsBySlug: Record<string, string> = {}
    // Track which directory each slug came from (base slug -> directory)
    const baseSlugToDir: Record<string, string> = {}
    // Track final slug -> base slug mapping (for collision resolution)
    const finalSlugToBaseSlug: Record<string, string> = {}

    // Create the "Documentation" overview post from docs/00-index.md FIRST
    console.log('✨ Creating Documentation overview from docs/00-index.md')
    const docsIndexPath = join(docsPath, '00-index.md')
    const indexContent = await readFile(docsIndexPath, 'utf-8')

    // Extract title and subtitle from docs index
    const indexTitleMatch = indexContent.match(/^#\s+(.+)$/m)
    const indexTitle = indexTitleMatch ? indexTitleMatch[1] : 'Documentation'
    const indexSubtitleMatch = indexContent.match(/^#\s+.+\n\n(.+)$/m)
    const indexSubtitle = indexSubtitleMatch ? indexSubtitleMatch[1] : null

    const now = new Date()
    const overviewPost = await CreatePost.handle({
      type: 'documentation',
      locale: 'en',
      slug: 'overview',
      title: indexTitle,
      status: 'published',
      excerpt: indexSubtitle,
      userId: admin.id,
    })

    // Update order_index to 0 (top of list) and set published_at
    await db
      .from('posts')
      .where('id', overviewPost.id)
      .update({ order_index: 0, published_at: now })
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
      const baseSlug = file
        .replace(/^\d+[a-z]?-/, '') // Remove number prefix (with optional letter like 03a-)
        .replace('.md', '')

      // Store base slug to directory mapping (before collision handling)
      baseSlugToDir[baseSlug] = dir

      // Skip reference-only pages (handled elsewhere or consolidated)
      if (baseSlug === 'index' || baseSlug === 'overview' || baseSlug === 'sitemap') {
        console.log(`   ⏭️  Skipping ${baseSlug} page (handled separately)\n`)
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
      const dirSuffix = dir.startsWith('developers')
        ? 'developers'
        : dir.startsWith('editors')
          ? 'editors'
          : 'root'
      let candidate = baseSlug
      if (postIdsBySlug[candidate]) {
        candidate = `${baseSlug}-${dirSuffix}`
      }
      if (postIdsBySlug[candidate]) {
        // last-resort: append counter
        let n = 2
        while (postIdsBySlug[`${candidate}-${n}`]) n++
        candidate = `${candidate}-${n}`
      }
      const slug = candidate

      // Store final slug -> base slug mapping (for link resolution)
      finalSlugToBaseSlug[slug] = baseSlug

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

      console.log(`✨ Creating documentation page: "${displayTitle}" (${slug}) from ${file}`)

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
      const now = new Date()
      await db
        .from('posts')
        .where('id', post.id)
        .update({ order_index: finalOrderIndex, published_at: now })

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
        // Get the post's prose module (join with module_instances to get props)
        const postModules = await db
          .from('post_modules')
          .join('module_instances', 'post_modules.module_id', 'module_instances.id')
          .where('post_modules.post_id', postId)
          .where('module_instances.type', 'prose')
          .select(
            'post_modules.id as postModuleId',
            'module_instances.id as moduleInstanceId',
            'module_instances.props'
          )
          .first()

        if (postModules && postModules.props) {
          const props = postModules.props as any
          if (props.content && props.content.root) {
            // Recursively update links in Lexical content
            const updatedContent = this.updateLinksInLexical(
              props.content,
              slugToPath,
              allFiles,
              postIdsBySlug,
              baseSlugToDir
            )

            // Update the module instance props (props are stored in module_instances, not post_modules)
            await db
              .from('module_instances')
              .where('id', postModules.moduleInstanceId)
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
        .join('module_instances', 'post_modules.module_id', 'module_instances.id')
        .where('post_modules.post_id', overviewPost.id)
        .where('module_instances.type', 'prose')
        .select(
          'post_modules.id as postModuleId',
          'module_instances.id as moduleInstanceId',
          'module_instances.props'
        )
        .first()

      if (overviewModules && overviewModules.props) {
        const props = overviewModules.props as any
        if (props.content && props.content.root) {
          const updatedContent = this.updateLinksInLexical(
            props.content,
            slugToPath,
            allFiles,
            postIdsBySlug,
            baseSlugToDir
          )

          // Update the module instance props (props are stored in module_instances, not post_modules)
          await db
            .from('module_instances')
            .where('id', overviewModules.moduleInstanceId)
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
