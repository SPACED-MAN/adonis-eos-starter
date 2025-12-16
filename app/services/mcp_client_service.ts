import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js'
import env from '#start/env'
import CreatePost from '#actions/posts/create_post'
import { getUserIdForAgent } from '#services/agent_user_service'
import { markdownToLexical } from '#helpers/markdown_to_lexical'
import UpdatePostModule from '#actions/posts/update_post_module'
import RevisionService from '#services/revision_service'
import db from '@adonisjs/lucid/services/db'
import path from 'node:path'
import fs from 'node:fs/promises'
import crypto from 'node:crypto'
import storageService from '#services/storage_service'
import mediaService from '#services/media_service'

/**
 * MCP Client Service
 *
 * Provides a client interface for internal agents to use MCP tools.
 * This allows internal agents to leverage the same MCP tools that external agents use.
 */
class MCPClientService {
  private client: Client | null = null
  private transport: StdioClientTransport | null = null

  /**
   * Initialize MCP client connection
   * Note: For now, this uses stdio transport. In the future, could support SSE for remote connections.
   */
  async initialize(): Promise<void> {
    if (this.client) {
      return // Already initialized
    }

    // For internal agents, we can spawn the MCP server as a subprocess
    // or connect to an existing MCP server instance
    // For now, we'll use a simplified approach where agents can call MCP tools
    // through the existing MCP server infrastructure

    // TODO: Implement actual MCP client connection
    // This could spawn the MCP server command or connect via SSE
  }

  /**
   * List available MCP tools
   */
  async listTools(): Promise<Array<{ name: string; description: string }>> {
    // For now, return a list of known tools
    // In a full implementation, this would query the MCP server
    return [
      { name: 'list_post_types', description: 'List all registered post types' },
      { name: 'get_post_type_config', description: 'Get a post type config' },
      { name: 'list_modules', description: 'List all module configs' },
      { name: 'get_module_schema', description: 'Get a module schema' },
      { name: 'list_posts', description: 'List posts' },
      { name: 'get_post_context', description: 'Get full post context for editing' },
      { name: 'create_post_ai_review', description: 'Create a new post and stage into AI review' },
      { name: 'save_post_ai_review', description: 'Save AI edits for a post' },
      { name: 'add_module_to_post_ai_review', description: 'Add a module to a post' },
      { name: 'update_post_module_ai_review', description: 'Update a post module' },
      { name: 'remove_post_module_ai_review', description: 'Remove a post module' },
      { name: 'suggest_modules_for_layout', description: 'Suggest modules for a page layout' },
      {
        name: 'search_media',
        description:
          'Search for existing media in the library by alt text, description, filename, or category. Returns matching media items with their IDs, URLs, and metadata. Use this to find existing images before generating new ones.',
      },
      {
        name: 'generate_image',
        description:
          'Generate an image using DALL-E (OpenAI) and add it to the media library. Returns media ID and URL. Requires AI_PROVIDER_OPENAI_API_KEY. Only use this if the user explicitly asks to generate/create a new image, or if no suitable existing image is found via search_media.',
      },
    ]
  }

  /**
   * Call an MCP tool
   * For internal agents, this directly calls the underlying actions/tools
   */
  async callTool(toolName: string, params: Record<string, any>, agentId?: string): Promise<any> {
    // For internal agents, we directly call the underlying actions
    // This avoids the overhead of HTTP/SSE communication

    switch (toolName) {
      case 'create_post_ai_review': {
        // Resolve actor user ID (for agent attribution)
        const actorUserId = await this.resolveActorUserId(agentId)
        if (!actorUserId) {
          throw new Error(
            'Missing MCP_SYSTEM_USER_ID (and no AI system user found). Seed users or set MCP_SYSTEM_USER_ID to a valid users.id.'
          )
        }

        const {
          type,
          locale = 'en',
          slug,
          title,
          excerpt,
          contentMarkdown,
          moduleGroupId,
          moduleGroupName,
          moduleEdits,
        } = params

        // Resolve module group ID if name provided
        let resolvedModuleGroupId: string | null = null
        if (moduleGroupName) {
          const db = (await import('@adonisjs/lucid/services/db')).default
          const row = await db.from('module_groups').where({ post_type: type, name: moduleGroupName }).first()
          if (row) resolvedModuleGroupId = String((row as any).id)
        } else if (moduleGroupId) {
          resolvedModuleGroupId = String(moduleGroupId)
        }

        // Create the post with ai-review seed mode (this will seed modules from module group)
        const post = await CreatePost.handle({
          type,
          locale,
          slug,
          title,
          status: 'draft' as any,
          excerpt: excerpt ?? null,
          metaTitle: null,
          metaDescription: null,
          moduleGroupId: resolvedModuleGroupId,
          seedMode: 'ai-review',
          userId: actorUserId,
        })

        // Update ai_review_draft on the post
        const savedBy = agentId ? `agent:${agentId}` : 'system'
        const draftPayload = {
          slug,
          title,
          status: 'draft',
          excerpt: excerpt ?? null,
          savedAt: new Date().toISOString(),
          savedBy,
        }

        await db
          .from('posts')
          .where('id', post.id)
          .update({ ai_review_draft: draftPayload } as any)

        await RevisionService.record({
          postId: post.id,
          mode: 'ai-review',
          snapshot: draftPayload,
          userId: actorUserId,
        })

        // Get seeded modules
        const seededModules = await db
          .from('post_modules as pm')
          .join('module_instances as mi', 'pm.module_id', 'mi.id')
          .where('pm.post_id', post.id)
          .orderBy('pm.order_index', 'asc')
          .orderBy('pm.created_at', 'asc')
          .orderBy('pm.id', 'asc')
          .select(
            'pm.id as postModuleId',
            'pm.order_index as orderIndex',
            'pm.locked as locked',
            'pm.ai_review_added as aiReviewAdded',
            'mi.id as moduleInstanceId',
            'mi.type as type',
            'mi.scope as scope',
            'mi.global_slug as globalSlug'
          )

        const appliedEdits: Array<{ ok: boolean; postModuleId?: string; error?: string }> = []
        const editsToApply: any[] = []

        // Add explicit module edits if provided
        if (Array.isArray(moduleEdits) && moduleEdits.length > 0) {
          editsToApply.push(...moduleEdits)
        }

        // Handle contentMarkdown - convert to Lexical and populate first prose module
        const mdTop = String(contentMarkdown || '').trim()
        if (mdTop) {
          // Check if there's already a prose content edit
          const hasProseContentEdit = (() => {
            for (const edit of editsToApply) {
              const hasContentMarkdown = String((edit as any)?.contentMarkdown || '').trim().length > 0
              const hasContentOverride =
                !!(edit as any)?.overrides &&
                typeof (edit as any).overrides === 'object' &&
                (edit as any).overrides.content !== undefined

              if (!hasContentMarkdown && !hasContentOverride) continue

              const explicitId = String((edit as any)?.postModuleId || '').trim()
              if (explicitId) {
                const m = (seededModules as any[]).find((x: any) => String(x.postModuleId) === explicitId)
                if (String(m?.type || '') === 'prose') return true
                continue
              }

              const t = String((edit as any)?.type || '').trim()
              if (t === 'prose') return true
            }
            return false
          })()

          if (!hasProseContentEdit) {
            // Find first prose module and add contentMarkdown edit
            const firstProse = (seededModules as any[]).find((m: any) => String(m.type) === 'prose')
            if (firstProse) {
              editsToApply.push({
                postModuleId: String((firstProse as any).postModuleId),
                contentMarkdown: mdTop,
              })
            } else {
              appliedEdits.push({
                ok: false,
                error: 'contentMarkdown was provided but no seeded prose module exists to populate.',
              })
            }
          }

          // Auto-populate hero and prose-with-media modules from markdown
          const mdH1 = this.extractMarkdownH1(mdTop)
          const mdParas = this.extractMarkdownParagraphs(mdTop)
          const mdH2s = this.extractMarkdownH2s(mdTop)

          const alreadyEditsModule = (postModuleId: string) =>
            editsToApply.some((e) => String((e as any)?.postModuleId || '').trim() === postModuleId)

          // Auto-populate hero module
          const firstHero = (seededModules as any[]).find((m: any) => String(m.type) === 'hero')
          if (firstHero && !alreadyEditsModule(String(firstHero.postModuleId))) {
            const heroTitle = String(title || '').trim() || mdH1 || ''
            const heroSubtitle = String(excerpt || '').trim() || (mdParas.length > 0 ? mdParas[0] : '')
            if (heroTitle || heroSubtitle) {
              editsToApply.push({
                postModuleId: String(firstHero.postModuleId),
                overrides: {
                  ...(heroTitle ? { title: heroTitle } : {}),
                  ...(heroSubtitle ? { subtitle: heroSubtitle } : {}),
                },
              })
            }
          }

          // Auto-populate prose-with-media module
          const firstProseWithMedia = (seededModules as any[]).find(
            (m: any) => String(m.type) === 'prose-with-media'
          )
          if (firstProseWithMedia && !alreadyEditsModule(String(firstProseWithMedia.postModuleId))) {
            const pwmTitle = (mdH2s[0] || '').trim()
            const pwmBody = (mdParas[0] || '').trim()
            if (pwmTitle || pwmBody) {
              editsToApply.push({
                postModuleId: String(firstProseWithMedia.postModuleId),
                overrides: {
                  ...(pwmTitle ? { title: pwmTitle } : {}),
                  ...(pwmBody ? { body: pwmBody } : {}),
                },
              })
            }
          }
        }

        // Apply all module edits
        if (editsToApply.length > 0) {
          for (const edit of editsToApply) {
            try {
              const explicitId = String((edit as any)?.postModuleId || '').trim()
              let targetId = explicitId || ''
              if (!targetId) {
                const t = String((edit as any)?.type || '').trim()
                const oi = (edit as any)?.orderIndex
                const candidates = (seededModules as any[]).filter((m: any) => {
                  if (!t) return false
                  if (String(m.type) !== t) return false
                  if (oi === undefined || oi === null) return true
                  return Number(m.orderIndex) === Number(oi)
                })
                if (candidates.length === 0) {
                  appliedEdits.push({
                    ok: false,
                    error: `No module found to edit (type=${t || 'n/a'} orderIndex=${oi ?? 'n/a'})`,
                  })
                  continue
                }
                targetId = String(candidates[0].postModuleId)
              }

              const targetMeta = (seededModules as any[]).find((m: any) => String(m.postModuleId) === targetId)
              const isProse = String(targetMeta?.type || (edit as any)?.type || '') === 'prose'

              let overrides =
                (edit as any)?.overrides === undefined ? undefined : ((edit as any)?.overrides as any)

              // Handle contentMarkdown for prose modules
              const md = String((edit as any)?.contentMarkdown || '').trim()
              if (md) {
                if (!isProse) {
                  appliedEdits.push({
                    ok: false,
                    postModuleId: targetId,
                    error: 'contentMarkdown is only supported for prose modules.',
                  })
                  continue
                }
                const lexical = markdownToLexical(md, { skipFirstH1: false })
                overrides = {
                  ...(overrides && typeof overrides === 'object' ? overrides : {}),
                  content: lexical,
                }
              }

              await UpdatePostModule.handle({
                postModuleId: targetId,
                overrides,
                mode: 'ai-review',
              })
              appliedEdits.push({ ok: true, postModuleId: targetId })
            } catch (e: any) {
              appliedEdits.push({
                ok: false,
                error: e?.message || 'Failed to apply module edit',
              })
            }
          }
        }

        return {
          success: true,
          postId: post.id,
          slug: post.slug,
          title: post.title,
          message: 'Post created successfully in AI review mode',
          appliedEdits,
        }
      }

      case 'search_media': {
        console.log('[search_media] Searching media library', { params })
        const { q, alt_text, description, category, limit } = params

        // Build search query
        let query = db.from('media_assets') as any

        // Search by query string (searches alt_text, description, and filename)
        if (q && typeof q === 'string' && q.trim()) {
          const searchTerm = `%${q.trim()}%`
          query = query.where((builder: any) => {
            builder
              .whereILike('alt_text', searchTerm)
              .orWhereILike('description', searchTerm)
              .orWhereILike('original_filename', searchTerm)
          })
        }

        // Search by specific alt text
        if (alt_text && typeof alt_text === 'string' && alt_text.trim()) {
          query = query.whereILike('alt_text', `%${alt_text.trim()}%`)
        }

        // Search by specific description
        if (description && typeof description === 'string' && description.trim()) {
          query = query.whereILike('description', `%${description.trim()}%`)
        }

        // Filter by category
        if (category && typeof category === 'string' && category.trim()) {
          query = query.whereRaw('? = ANY(categories)', [category.trim()])
        }

        // Limit results
        const resultLimit = Math.min(50, Math.max(1, Number(limit) || 10))
        const results = await query
          .orderBy('created_at', 'desc')
          .limit(resultLimit)
          .select('id', 'url', 'original_filename', 'alt_text', 'description', 'categories', 'mime_type')

        const mediaItems = results.map((r: any) => ({
          id: r.id,
          url: r.url,
          originalFilename: r.original_filename,
          altText: r.alt_text,
          description: r.description,
          categories: Array.isArray(r.categories) ? r.categories : [],
          mimeType: r.mime_type,
        }))

        console.log('[search_media] Found media items', { count: mediaItems.length })

        return {
          success: true,
          count: mediaItems.length,
          items: mediaItems,
        }
      }

      case 'generate_image': {
        console.log('[generate_image] Starting DALL-E image generation', { params })
        const { prompt, alt_text, description, model, size, quality } = params

        if (!prompt || typeof prompt !== 'string') {
          throw new Error('generate_image requires a "prompt" parameter (string)')
        }

        // Get OpenAI API key from environment
        const apiKey = process.env.AI_PROVIDER_OPENAI_API_KEY
        if (!apiKey) {
          throw new Error(
            'OpenAI API key not found. Set AI_PROVIDER_OPENAI_API_KEY environment variable.'
          )
        }

        console.log('[generate_image] OpenAI API key found', { hasKey: !!apiKey, keyLength: apiKey?.length })

        // DALL-E model options: dall-e-2 or dall-e-3 (default to dall-e-3)
        const dalleModel = model || 'dall-e-3'
        // Size options: 1024x1024, 1792x1024, 1024x1792 (dall-e-3) or 256x256, 512x512, 1024x1024 (dall-e-2)
        const imageSize = size || (dalleModel === 'dall-e-3' ? '1024x1024' : '1024x1024')
        // Quality: standard or hd (dall-e-3 only)
        const imageQuality = quality || 'standard'

        console.log('[generate_image] Generating with DALL-E', {
          model: dalleModel,
          size: imageSize,
          quality: imageQuality,
          promptLength: prompt.length,
        })

        // Call DALL-E API
        let imageUrl: string | null = null
        let revisedPrompt: string | null = null

        try {
          const dalleResponse = await fetch('https://api.openai.com/v1/images/generations', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
              model: dalleModel,
              prompt: prompt,
              n: 1, // Number of images
              size: imageSize,
              ...(dalleModel === 'dall-e-3' && { quality: imageQuality }),
            }),
          })

          if (!dalleResponse.ok) {
            const errorText = await dalleResponse.text()
            let errorJson: any = null
            try {
              errorJson = JSON.parse(errorText)
            } catch {
              // Not JSON
            }
            console.error('[generate_image] DALL-E API error', {
              status: dalleResponse.status,
              error: errorText.substring(0, 500),
              errorJson,
            })
            throw new Error(
              `DALL-E API error: ${dalleResponse.status} ${dalleResponse.statusText}. ${
                errorJson?.error?.message || errorText.substring(0, 200)
              }`
            )
          }

          const dalleData = await dalleResponse.json()
          imageUrl = dalleData.data?.[0]?.url
          revisedPrompt = dalleData.data?.[0]?.revised_prompt || null

          if (!imageUrl) {
            throw new Error('No image URL returned from DALL-E API')
          }

          console.log('[generate_image] DALL-E image generated successfully', {
            imageUrl: imageUrl.substring(0, 100),
            hasRevisedPrompt: !!revisedPrompt,
          })
        } catch (error: any) {
          console.error('[generate_image] DALL-E generation failed', { error: error.message })
          throw error
        }

        // Download the generated image
        let imageBuffer: Buffer
        let mimeType: string

        try {
          const imageResponse = await fetch(imageUrl)
          if (!imageResponse.ok) {
            throw new Error(`Failed to download generated image: ${imageResponse.statusText}`)
          }
          imageBuffer = Buffer.from(await imageResponse.arrayBuffer())
          mimeType = imageResponse.headers.get('content-type') || 'image/png'
          console.log('[generate_image] Downloaded image from DALL-E', {
            mimeType,
            size: imageBuffer.length,
          })
        } catch (error: any) {
          console.error('[generate_image] Failed to download image', { error: error.message })
          throw new Error(`Failed to download generated image: ${error.message}`)
        }

        // Determine file extension from mime type
        let ext = '.png'
        if (mimeType.includes('jpeg') || mimeType.includes('jpg')) {
          ext = '.jpg'
        } else if (mimeType.includes('webp')) {
          ext = '.webp'
        }

        // Save to uploads directory
        const uploadsDir = path.join(process.cwd(), 'public', 'uploads')
        await fs.mkdir(uploadsDir, { recursive: true })

        const filename = `${crypto.randomUUID()}${ext}`
        const destPath = path.join(uploadsDir, filename)
        await fs.writeFile(destPath, imageBuffer)

        const url = `/uploads/${filename}`

        // Publish to storage
        try {
          await storageService.publishFile(destPath, url, mimeType)
        } catch {
          /* ignore publish errors; local file remains */
        }

        // Generate variants for the image
        let metadata: any = null
        try {
          const variants = await mediaService.generateVariants(
            destPath,
            url,
            null,
            null,
            null,
            'light'
          )
          metadata = { variants }
        } catch {
          // ignore variant generation errors
        }

        // Insert into media_assets table
        const mediaId = crypto.randomUUID()
        const now = new Date()

        await db.table('media_assets').insert({
          id: mediaId,
          url,
          original_filename: `generated-${prompt.slice(0, 50).replace(/[^a-z0-9]/gi, '-')}${ext}`,
          mime_type: mimeType,
          size: imageBuffer.length,
          alt_text: alt_text || prompt.slice(0, 200),
          caption: null,
          description: description || null,
          categories: db.raw('ARRAY[]::text[]') as any,
          metadata: metadata as any,
          created_at: now,
          updated_at: now,
        })

        // Log activity
        try {
          const activityLogService = (await import('#services/activity_log_service')).default
          const actorUserId = await this.resolveActorUserId(agentId)
          await activityLogService.log({
            action: 'media.generate',
            userId: actorUserId,
            entityType: 'media',
            entityId: mediaId,
            metadata: {
              prompt,
              model: dalleModel,
              size: imageSize,
              quality: imageQuality,
              revisedPrompt,
              generated: true,
            },
          })
        } catch {
          // ignore activity log errors
        }

        const result = {
          success: true,
          mediaId,
          url,
          altText: alt_text || prompt.slice(0, 200),
          description: description || null,
        }

        console.log('[generate_image] Image saved to media library', {
          mediaId,
          url,
          hasAltText: !!result.altText,
        })

        return result
      }

      default:
        throw new Error(`MCP tool '${toolName}' not yet implemented in internal agent executor`)
    }
  }

  /**
   * Resolve actor user ID for agent attribution
   */
  private async resolveActorUserId(agentId?: string): Promise<number | null> {
    // Check for system user ID from env
    if (env.get('MCP_SYSTEM_USER_ID')) {
      const id = Number(env.get('MCP_SYSTEM_USER_ID'))
      if (Number.isFinite(id) && id > 0) {
        return id
      }
    }

    // If agentId provided, try to get the agent's user account
    if (agentId) {
      const userId = await getUserIdForAgent(agentId)
      if (userId) {
        return userId
      }
    }

    // Fallback: try to find an AI agent user
    const User = (await import('#models/user')).default
    const aiUser = await User.query()
      .where('role', 'ai_agent')
      .where('email', 'like', '%@agents.local')
      .first()

    return aiUser ? aiUser.id : null
  }

  /**
   * Extract H1 from markdown
   */
  private extractMarkdownH1(md: string): string | null {
    const s = String(md || '')
    const m = s.match(/^\s*#\s+(.+?)\s*$/m)
    if (m?.[1]) return this.stripMarkdownInline(m[1])
    return null
  }

  /**
   * Extract paragraphs from markdown
   */
  private extractMarkdownParagraphs(md: string): string[] {
    const s = String(md || '')
    const blocks = s.split(/\n\s*\n+/g).map((b) => b.trim())
    const paras: string[] = []
    for (const b of blocks) {
      if (!b) continue
      if (/^\s*#{1,6}\s+/.test(b)) continue
      if (/^\s*```/.test(b)) continue
      if (/^\s*[-*]\s+/.test(b) || /^\s*\d+\.\s+/.test(b)) continue
      const oneLine = this.stripMarkdownInline(b.replace(/\s+/g, ' '))
      if (oneLine.length >= 20) paras.push(oneLine)
      if (paras.length >= 5) break
    }
    return paras
  }

  /**
   * Extract H2s from markdown
   */
  private extractMarkdownH2s(md: string): string[] {
    const s = String(md || '')
    const matches = [...s.matchAll(/^\s*##\s+(.+?)\s*$/gm)]
    return matches.map((m) => this.stripMarkdownInline(m[1] || '')).filter(Boolean)
  }

  /**
   * Strip inline markdown formatting
   */
  private stripMarkdownInline(text: string): string {
    return String(text || '')
      .replace(/\*\*(.+?)\*\*/g, '$1')
      .replace(/\*(.+?)\*/g, '$1')
      .replace(/`(.+?)`/g, '$1')
      .replace(/\[(.+?)\]\(.+?\)/g, '$1')
      .trim()
  }

  /**
   * Check if a tool is available
   */
  async isToolAvailable(toolName: string): Promise<boolean> {
    const tools = await this.listTools()
    return tools.some((t) => t.name === toolName)
  }

  /**
   * Close the MCP client connection
   */
  async close(): Promise<void> {
    if (this.transport) {
      await this.transport.close()
      this.transport = null
    }
    this.client = null
  }
}

const mcpClientService = new MCPClientService()
export default mcpClientService

