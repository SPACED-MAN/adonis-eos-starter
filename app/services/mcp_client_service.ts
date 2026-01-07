import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js'
import env from '#start/env'
import CreatePost, { CreatePostException } from '#actions/posts/create_post'
import CreateTranslation from '#actions/translations/create_translation'
import { getUserIdForAgent } from '#services/agent_user_service'
import { markdownToLexical } from '#helpers/markdown_to_lexical'
import UpdatePostModule from '#actions/posts/update_post_module'
import AddModuleToPost from '#actions/posts/add_module_to_post'
import SaveReviewDraft from '#actions/posts/save_review_draft'
import PostSerializerService from '#services/post_serializer_service'
import postTypeConfigService from '#services/post_type_config_service'
import postTypeRegistry from '#services/post_type_registry'
import formRegistry from '#services/form_registry'
import webhookService from '#services/webhook_service'
import Post from '#models/post'
import RevisionService from '#services/revision_service'
import urlPatternService from '#services/url_pattern_service'
import moduleRegistry from '#services/module_registry'
import agentRegistry from '#services/agent_registry'
import db from '@adonisjs/lucid/services/db'
import path from 'node:path'
import fs from 'node:fs/promises'
import crypto from 'node:crypto'
import { promisify } from 'node:util'
import { exec } from 'node:child_process'
import storageService from '#services/storage_service'

const execAsync = promisify(exec)
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
      {
        name: 'list_registry_items',
        description:
          'Returns a structured list of everything registered in PostTypeRegistry, ModuleRegistry, and FormRegistry.',
      },
      { name: 'get_post_type_config', description: 'Get a post type config' },
      { name: 'list_modules', description: 'List all module configs' },
      { name: 'get_module_schema', description: 'Get a module schema' },
      {
        name: 'inspect_module_definition',
        description:
          'Returns the defaultProps, config, and the TS/Inertia component path for a specific module.',
      },
      { name: 'list_posts', description: 'List posts' },
      { name: 'get_post_context', description: 'Get full post context for editing' },
      {
        name: 'get_post_manifest',
        description:
          'A "Super-Getter" that returns the Post record + all associated Modules + all Overrides + all Custom Fields in one JSON tree, flattened for easy understanding.',
      },
      {
        name: 'create_post_ai_review',
        description:
          'Create a new post and stage into AI review. Params: { type, slug, title, excerpt, featuredMediaId, contentMarkdown, locale, moduleGroupName, moduleEdits }. IMPORTANT: When writing content for "Prose" modules, provide a substantial amount of copy (multiple paragraphs, headings, and lists) to ensure a high-quality user experience.',
      },
      {
        name: 'save_post_ai_review',
        description:
          'Save AI edits for a post. Params: { postId, patch: { title, slug, excerpt, featuredMediaId, metaTitle, metaDescription, socialTitle, socialDescription, socialImageId, noindex, nofollow, ... } }',
      },
      {
        name: 'add_module_to_post_ai_review',
        description:
          'Add a module to a post. Params: { postId, moduleType, scope, props, orderIndex }',
      },
      {
        name: 'update_post_module_ai_review',
        description:
          'Update a post module. Params: { postModuleId, overrides, contentMarkdown, locked, orderIndex }. IMPORTANT: When updating "Prose" modules, ALWAYS use "contentMarkdown" for text content to ensure high-quality rich text conversion.',
      },
      {
        name: 'remove_post_module_ai_review',
        description: 'Remove a post module. Params: { postModuleId }',
      },
      {
        name: 'create_translation_ai_review',
        description:
          'Create a translation post for a base post and initialize AI Review content (optionally cloning module structure). Params: { postId, locale, slug, title, featuredMediaId, ... }',
      },
      {
        name: 'create_translations_ai_review_bulk',
        description:
          'Create translation posts for multiple locales and initialize AI Review drafts (optionally cloning module structure).',
      },
      { name: 'list_agents', description: 'List all enabled agents' },
      {
        name: 'run_agent',
        description:
          'Run a named internal agent on a post or globally. Params: { agentId, postId, scope, context, openEndedContext }',
      },
      {
        name: 'run_field_agent',
        description:
          'Run an external agent for a single field (scope=field). Returns the agent response and can optionally stage changes into AI Review.',
      },
      { name: 'suggest_modules_for_layout', description: 'Suggest modules for a page layout' },
      {
        name: 'search_media',
        description:
          'Search for existing media in the library by alt text, description, filename, or category. Returns matching media items with their IDs, URLs, and metadata. Use this to find existing images before generating new ones.',
      },
      {
        name: 'generate_image',
        description:
          'Generate an image using AI and add it to the media library. Params: { prompt, alt_text, description, theme, variationOf }. "theme" can be "light" (default) or "dark". If "theme" is "dark", you MUST provide "variationOf" with the media ID of the light version to create a single media item with both versions.',
      },
      {
        name: 'check_media_integrity',
        description:
          'Verifies the DB record exists, the file exists on disk (or R2), and all variants/optimized versions listed in the metadata are actually present.',
      },
      {
        name: 'tail_activity_logs',
        description:
          'Returns the latest entries from the activity_logs table for debugging and auditing.',
      },
      {
        name: 'simulate_webhook_event',
        description:
          'Triggers the webhook_service dispatch logic with a mock payload to test integrations.',
      },
      {
        name: 'run_ace_command',
        description: 'Execute a node ace command (e.g. list:routes, migration:status).',
      },
      {
        name: 'test_local_route',
        description:
          'Make a request to a local URL to verify behavior, check status codes, and see response data.',
      },
      {
        name: 'read_server_logs',
        description: 'Read the last N lines of the application logs from the terminal output.',
      },
      {
        name: 'trace_url_resolution',
        description: 'Resolves a URL path to its corresponding Post or URL Pattern.',
      },
      {
        name: 'validate_mcp_payload',
        description: 'Dry run validation for module props against their schema without saving.',
      },
    ]
  }

  /**
   * Automatically convert string values in richtext fields to Lexical JSON
   * and flatten media objects to strings for ID-only media fields.
   */
  private async autoConvertFields(
    postModuleId: string,
    overrides: Record<string, any>
  ): Promise<void> {
    if (!overrides || typeof overrides !== 'object') return

    // Validate UUID format for postModuleId
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    if (!uuidRegex.test(postModuleId)) {
      console.warn(
        `[MCPClientService.autoConvertFields] Skipping auto-conversion: invalid UUID for postModuleId: "${postModuleId}"`
      )
      return
    }

    try {
      const pm = await db.from('post_modules').where('id', postModuleId).first()
      if (!pm) return
      const mi = await db.from('module_instances').where('id', pm.module_id).first()
      if (!mi || !moduleRegistry.has(mi.type)) return

      const schema = moduleRegistry.getSchema(mi.type)

      const processObject = (obj: any, currentSchema: any[]) => {
        if (!obj || typeof obj !== 'object') return

        for (const key of Object.keys(obj)) {
          const field = currentSchema.find((f) => f.slug === key)
          if (!field) continue

          // RichText handling
          if (field.type === 'richtext') {
            const val = obj[key]
            if (typeof val === 'string' && val.trim() !== '') {
              const trimmed = val.trim()
              const looksJson = trimmed.startsWith('{') || trimmed.startsWith('[')
              if (!looksJson) {
                obj[key] = markdownToLexical(val, { skipFirstH1: false })
              }
            }
          }

          // Media ID flattening
          if (field.type === 'media' && field.config?.storeAs === 'id') {
            const val = obj[key]
            if (val && typeof val === 'object' && val.id) {
              obj[key] = String(val.id)
            }
          }

          // Nested objects
          if (field.type === 'object' && field.fields) {
            processObject(obj[key], field.fields)
          }

          // Repeaters
          if (field.type === 'repeater' && field.item?.fields && Array.isArray(obj[key])) {
            obj[key].forEach((item: any) => processObject(item, field.item.fields))
          }
        }
      }

      processObject(overrides, schema.fieldSchema)
    } catch (error) {
      console.error('Failed to auto-convert fields:', error)
    }
  }

  /**
   * Call an MCP tool
   * For internal agents, this directly calls the underlying actions/tools
   */
  async callTool(toolName: string, params: Record<string, any>, agentId?: string, mode?: string): Promise<any> {
    // For internal agents, we directly call the underlying actions
    // This avoids the overhead of HTTP/SSE communication

    const targetMode = (mode || params.mode) as any
    if (!targetMode) {
      throw new Error('Mode parameter is required (source, review, or ai-review)')
    }
    switch (toolName) {
      case 'list_post_types': {
        const types = postTypeRegistry.list()
        return { success: true, postTypes: types }
      }

      case 'list_registry_items': {
        const postTypes = postTypeRegistry.list().map((t) => {
          const cfg = postTypeConfigService.getUiConfig(t)
          return {
            slug: t,
            name: cfg.label || t,
            hierarchical: !!cfg.hierarchyEnabled,
            permalinksEnabled: !!cfg.permalinksEnabled,
            moduleGroupsEnabled: !!cfg.moduleGroupsEnabled,
          }
        })

        const modules = moduleRegistry.getAll().map((m) => {
          const cfg = m.getConfig()
          return {
            type: cfg.type,
            name: cfg.name,
            description: cfg.description,
            allowedScopes: cfg.allowedScopes,
            layoutRoles: cfg.aiGuidance?.layoutRoles || [],
          }
        })

        const forms = formRegistry.list().map((f) => ({
          slug: f.slug,
          name: f.title,
          description: f.description,
        }))

        return {
          success: true,
          postTypes,
          modules,
          forms,
        }
      }

      case 'get_post_type_config': {
        const { postType } = params
        if (!postType) throw new Error('get_post_type_config requires "postType"')
        const config = postTypeConfigService.getUiConfig(postType)
        return { success: true, config }
      }

      case 'list_modules': {
        const { postType } = params
        const modules = postType
          ? moduleRegistry.getAllowedForPostType(postType)
          : moduleRegistry.getAll()

        return {
          success: true,
          modules: modules.map((m) => {
            const c = m.getConfig()
            return {
              type: c.type,
              name: c.name,
              description: c.description,
            }
          }),
        }
      }

      case 'get_module_schema': {
        const { type } = params
        if (!type) throw new Error('get_module_schema requires "type"')
        const schema = moduleRegistry.getSchema(type)
        return { success: true, schema }
      }

      case 'inspect_module_definition': {
        const { moduleSlug } = params
        if (!moduleSlug) throw new Error('inspect_module_definition requires "moduleSlug"')
        if (!moduleRegistry.has(moduleSlug)) {
          throw new Error(`Module "${moduleSlug}" not found`)
        }
        const m = moduleRegistry.get(moduleSlug)
        const cfg = m.getConfig()
        const schema = moduleRegistry.getSchema(moduleSlug)

        return {
          success: true,
          slug: moduleSlug,
          name: cfg.name,
          description: cfg.description,
          defaultProps: schema.defaultValues,
          config: cfg,
          componentName: m.getComponentName(),
        }
      }

      case 'list_posts': {
        const { type, status, q, locale, limit } = params
        let query = Post.query()

        if (type) query = query.where('type', type)
        if (status) query = query.where('status', status)
        if (locale) query = query.where('locale', locale)
        if (q) {
          query = query.where((b) => {
            b.whereILike('title', `%${q}%`).orWhereILike('slug', `%${q}%`)
          })
        }

        const posts = await query.orderBy('created_at', 'desc').limit(limit || 20)
        return {
          success: true,
          posts: posts.map((p) => ({
            id: p.id,
            title: p.title,
            slug: p.slug,
            type: p.type,
            status: p.status,
            locale: p.locale,
          })),
        }
      }

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
          featuredMediaId,
          contentMarkdown,
          moduleGroupId,
          moduleGroupName,
          moduleEdits,
        } = params

        if (!type || !slug || !title) {
          throw new Error('create_post_ai_review requires "type", "slug", and "title"')
        }

        // Resolve module group ID if name provided
        let resolvedModuleGroupId: string | null = null
        if (moduleGroupName) {
          const dbImport = (await import('@adonisjs/lucid/services/db')).default
          const row = await dbImport
            .from('module_groups')
            .where({ post_type: type, name: moduleGroupName })
            .first()
          if (row) resolvedModuleGroupId = String((row as any).id)
        } else if (moduleGroupId) {
          resolvedModuleGroupId = String(moduleGroupId)
        }

        // Create the post with ai-review seed mode (this will seed modules from module group)
        // Auto-retry with incremented slug if slug conflict occurs
        let post: any = null
        let finalSlug = slug
        let attempt = 1
        const maxAttempts = 10

        while (!post && attempt <= maxAttempts) {
          try {
            post = await CreatePost.handle({
              type,
              locale,
              slug: finalSlug,
              title,
              status: 'draft' as any,
              excerpt: null, // Don't set excerpt in approved fields when seeding into AI review
              metaTitle: null,
              metaDescription: null,
              moduleGroupId: resolvedModuleGroupId,
              seedMode: 'ai-review',
              userId: actorUserId,
            })
            // Success - break out of retry loop
            break
          } catch (error: any) {
            // Check if it's a slug conflict (409 status code)
            const isSlugConflict =
              error instanceof CreatePostException &&
              error.statusCode === 409 &&
              error.message?.includes('slug already exists')

            if (isSlugConflict) {
              // Increment slug and retry
              attempt++
              if (attempt > maxAttempts) {
                throw new Error(
                  `Failed to create post: unable to find available slug after ${maxAttempts} attempts. Last attempted slug: ${finalSlug}`
                )
              }
              // Append -2, -3, etc. to the slug
              finalSlug = `${slug}-${attempt}`
            } else {
              // Not a slug conflict - rethrow the error
              throw error
            }
          }
        }

        if (!post) {
          throw new Error(
            `Failed to create post: unable to find available slug after ${maxAttempts} attempts`
          )
        }

        // Update ai_review_draft on the post
        const savedBy = agentId ? `agent:${agentId}` : 'system'
        const draftPayload = {
          slug: finalSlug, // Use the final slug (may have been incremented)
          title,
          status: 'draft',
          excerpt: excerpt ?? null,
          featuredMediaId: featuredMediaId ?? null,
          savedAt: new Date().toISOString(),
          savedBy,
        }

        await db
          .from('posts')
          .where('id', post.id)
          .update({ ai_review_draft: draftPayload } as any)

        await RevisionService.record({
          postId: post.id,
          mode: targetMode,
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

        // Handle contentMarkdown - convert to Lexical and populate seeded modules intelligently
        const mdTop = String(contentMarkdown || '').trim()
        if (mdTop) {
          // Check if there's already a prose content edit
          const hasProseContentEdit = (() => {
            for (const edit of editsToApply) {
              const hasContentMarkdown =
                String((edit as any)?.contentMarkdown || '').trim().length > 0
              const hasContentOverride =
                !!(edit as any)?.overrides &&
                typeof (edit as any).overrides === 'object' &&
                ((edit as any).overrides.content !== undefined ||
                  (edit as any).overrides.body !== undefined)

              if (!hasContentMarkdown && !hasContentOverride) continue

              const explicitId = String((edit as any)?.postModuleId || '').trim()
              if (explicitId) {
                const m = (seededModules as any[]).find(
                  (x: any) => String(x.postModuleId) === explicitId
                )
                if (
                  String(m?.type || '') === 'prose' ||
                  String(m?.type || '') === 'prose-with-media'
                )
                  return true
                continue
              }

              const t = String((edit as any)?.type || '').trim()
              if (t === 'prose' || t === 'prose-with-media') return true
            }
            return false
          })()

          if (!hasProseContentEdit) {
            // Find first prose OR prose-with-media module and add contentMarkdown edit
            const firstContentModule = (seededModules as any[]).find(
              (m: any) => String(m.type) === 'prose' || String(m.type) === 'prose-with-media'
            )
            if (firstContentModule) {
              editsToApply.push({
                postModuleId: String((firstContentModule as any).postModuleId),
                contentMarkdown: mdTop,
              })
            } else {
              appliedEdits.push({
                ok: false,
                error:
                  'contentMarkdown was provided but no seeded content module exists to populate.',
              })
            }
          }

          // Auto-populate hero module from metadata
          const mdH1 = this.extractMarkdownH1(mdTop)
          const mdParas = this.extractMarkdownParagraphs(mdTop)

          const alreadyEditsModule = (postModuleId: string) =>
            editsToApply.some((e) => String((e as any)?.postModuleId || '').trim() === postModuleId)

          // Auto-populate hero module
          const firstHero = (seededModules as any[]).find((m: any) =>
            String(m.type).toLowerCase().includes('hero')
          )
          if (firstHero && !alreadyEditsModule(String(firstHero.postModuleId))) {
            const heroTitle = String(title || '').trim() || mdH1 || ''
            const heroSubtitle =
              String(excerpt || '').trim() || (mdParas.length > 0 ? mdParas[0] : '')

            if (heroTitle || heroSubtitle) {
              const schema = moduleRegistry.getSchema(firstHero.type)
              const hasSubtitle = schema.fieldSchema.some(f => f.slug === 'subtitle')
              const hasBody = schema.fieldSchema.some(f => f.slug === 'body')

              editsToApply.push({
                postModuleId: String(firstHero.postModuleId),
                overrides: {
                  ...(heroTitle ? { title: heroTitle } : {}),
                  ...(heroSubtitle ? { [hasSubtitle ? 'subtitle' : (hasBody ? 'body' : 'subtitle')]: heroSubtitle } : {}),
                },
              })
            }
          }
        }

        // Pre-process edits to extract titles from markdown if necessary
        for (const edit of editsToApply) {
          const md = String((edit as any).contentMarkdown || '').trim()
          if (md) {
            const explicitId = String((edit as any).postModuleId || '').trim()
            if (explicitId) {
              const mMeta = (seededModules as any[]).find(x => String(x.postModuleId) === explicitId)
              if (mMeta && moduleRegistry.has(mMeta.type)) {
                const schema = moduleRegistry.getSchema(mMeta.type)
                const hasTitleField = schema.fieldSchema.some(f => f.slug === 'title')
                const alreadyHasTitle = (edit as any).overrides?.title !== undefined

                if (hasTitleField && !alreadyHasTitle) {
                  const extractedTitle = this.extractMarkdownH1(md) || this.extractMarkdownH2(md)
                  if (extractedTitle) {
                    edit.overrides = {
                      ...(edit.overrides || {}),
                      title: extractedTitle,
                    }
                  }
                }
              }
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

              const targetMeta = (seededModules as any[]).find(
                (m: any) => String(m.postModuleId) === targetId
              )
              if (!targetMeta) {
                appliedEdits.push({
                  ok: false,
                  postModuleId: targetId,
                  error: 'Target module meta not found',
                })
                continue
              }

              let overrides =
                (edit as any)?.overrides === undefined
                  ? undefined
                  : ((edit as any)?.overrides as any)

              // Handle contentMarkdown for ANY module with a richtext field
              const md = String((edit as any)?.contentMarkdown || '').trim()
              if (md) {
                if (moduleRegistry.has(targetMeta.type)) {
                  const schema = moduleRegistry.getSchema(targetMeta.type)
                  const firstRichText = schema.fieldSchema.find((f: any) => f.type === 'richtext')
                  if (!firstRichText) {
                    appliedEdits.push({
                      ok: false,
                      postModuleId: targetId,
                      error: `contentMarkdown is not supported for module type ${targetMeta.type} (no richtext field found).`,
                    })
                    continue
                  }
                  const lexical = markdownToLexical(md, { skipFirstH1: false })
                  overrides = {
                    ...(overrides && typeof overrides === 'object' ? overrides : {}),
                    [firstRichText.slug]: lexical,
                  }
                }
              }

              // Automatic Markdown-to-Lexical conversion for ANY other richtext overrides
              if (overrides && typeof overrides === 'object') {
                await this.autoConvertFields(targetId, overrides)
              }

              await UpdatePostModule.handle({
                postModuleId: targetId,
                overrides,
                mode: targetMode,
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

      case 'get_post_context': {
        const { postId } = params
        if (!postId) throw new Error('get_post_context requires a "postId" parameter')

        const post = await Post.find(postId)
        if (!post) throw new Error(`Post not found: ${postId}`)

        // Serialize post in the requested mode
        const context = await PostSerializerService.serialize(post.id, targetMode)
        return {
          success: true,
          ...context,
        }
      }

      case 'get_post_manifest': {
        const { postId, mode: manifestMode } = params
        if (!postId) throw new Error('get_post_manifest requires "postId"')
        const effectiveMode = manifestMode || targetMode
        const context = await PostSerializerService.serialize(postId, effectiveMode)
        return {
          success: true,
          ...context,
        }
      }

      case 'save_post_ai_review': {
        const { postId, patch } = params
        if (!postId || !patch) {
          throw new Error('save_post_ai_review requires "postId" and "patch" parameters')
        }

        const actorUserId = await this.resolveActorUserId(agentId)
        if (!actorUserId) throw new Error('Actor user not found')

        // Fetch current canonical state for the target mode to use as a base for merging
        // This ensures we don't wipe modules or other fields not present in the patch.
        const currentCanonical = await PostSerializerService.serialize(postId, targetMode)

        // Merge patch into the canonical post fields
        const mergedPayload: any = {
          ...currentCanonical.post,
          modules: currentCanonical.modules,
        }

        for (const key of Object.keys(patch)) {
          if (patch[key] !== undefined) {
            mergedPayload[key] = patch[key]
          }
        }

        await SaveReviewDraft.handle({
          postId,
          payload: mergedPayload,
          userId: actorUserId,
          userEmail: `agent:${agentId || 'system'}`,
          mode: targetMode,
        })

        return {
          success: true,
          message: `Suggestions saved to ${targetMode} draft`,
        }
      }

      case 'add_module_to_post_ai_review': {
        const { postId, moduleType, scope = 'local', orderIndex, globalSlug } = params
        let props = params.props || params.overrides || {} // Accept both props and overrides
        if (!postId || !moduleType) {
          throw new Error('add_module_to_post_ai_review requires "postId" and "moduleType"')
        }

        // Automatic conversion for richtext/media fields before adding
        if (props && typeof props === 'object' && Object.keys(props).length > 0) {
          if (moduleRegistry.has(moduleType)) {
            const schema = moduleRegistry.getSchema(moduleType)

            // Recursive helper to process fields at any depth
            const processObject = (obj: any, currentSchema: any[]) => {
              if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return

              for (const key of Object.keys(obj)) {
                const field = currentSchema.find((f) => f.slug === key)
                if (!field) continue

                const val = obj[key]

                // RichText handling (convert Markdown to Lexical)
                if (field.type === 'richtext') {
                  if (typeof val === 'string' && val.trim() !== '') {
                    const trimmed = val.trim()
                    const looksJson = trimmed.startsWith('{') || trimmed.startsWith('[')
                    if (!looksJson) {
                      obj[key] = markdownToLexical(val, { skipFirstH1: false })
                    }
                  }
                }

                // Media ID flattening: if agent provides { id: "uuid" } but field wants string
                if (field.type === 'media' && field.config?.storeAs === 'id') {
                  if (val && typeof val === 'object' && val.id) {
                    obj[key] = String(val.id)
                  }
                }

                // Recurse into nested objects
                if (field.type === 'object' && field.fields) {
                  processObject(obj[key], field.fields)
                }

                // Recurse into repeaters
                if (field.type === 'repeater' && field.item?.fields && Array.isArray(obj[key])) {
                  obj[key].forEach((item: any) => processObject(item, field.item.fields))
                }
              }
            }

            processObject(props, schema.fieldSchema)
          }
        }

        const result = await AddModuleToPost.handle({
          postId,
          moduleType,
          scope,
          props,
          orderIndex,
          globalSlug,
          mode: targetMode,
        })

        return {
          success: true,
          postModuleId: result.postModule.id,
          moduleInstanceId: result.moduleInstanceId,
          message: 'Module added to AI review draft',
        }
      }

      case 'update_post_module_ai_review': {
        let { postModuleId, locked, orderIndex, moduleInstanceId, postId, contentMarkdown } = params
        let overrides = params.overrides
        if (
          (overrides === undefined ||
            overrides === null ||
            (typeof overrides === 'object' && Object.keys(overrides).length === 0)) &&
          params.props
        ) {
          overrides = params.props
        }

        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

        // If postModuleId is missing or not a UUID, but we have postId and type, try to resolve it
        if ((!postModuleId || !uuidRegex.test(postModuleId)) && postId) {
          const type = params.moduleType || params.type || postModuleId // Use postModuleId as type if it's not a UUID
          if (type && uuidRegex.test(postId)) {
            const found = await db
              .from('post_modules')
              .join('module_instances', 'post_modules.module_id', 'module_instances.id')
              .where('post_modules.post_id', postId)
              .where('module_instances.type', type)
              .select('post_modules.id')
              .first()
            if (found) {
              postModuleId = String(found.id)
            }
          }
        }

        // If postModuleId is still missing but moduleInstanceId is provided, try to resolve it
        if (
          (!postModuleId || !uuidRegex.test(postModuleId)) &&
          moduleInstanceId &&
          uuidRegex.test(moduleInstanceId)
        ) {
          const pm = await db
            .from('post_modules')
            .where('module_id', moduleInstanceId)
            .select('id')
            .first()
          if (pm) postModuleId = String(pm.id)
        }

        if (!postModuleId || !uuidRegex.test(postModuleId)) {
          throw new Error(
            `update_post_module_ai_review requires a valid "postModuleId" (UUID). Received: "${postModuleId}"`
          )
        }

        // Handle contentMarkdown
        const md = String(contentMarkdown || '').trim()
        if (md) {
          const pm = await db.from('post_modules').where('id', postModuleId).first()
          if (!pm) throw new Error(`Post module not found: ${postModuleId}`)
          const mi = await db.from('module_instances').where('id', pm.module_id).first()
          if (!mi) throw new Error('Module instance not found')

          const schema = moduleRegistry.getSchema(mi.type)
          const firstRichText = schema.fieldSchema.find((f: any) => f.type === 'richtext')
          const firstTextArea = schema.fieldSchema.find((f: any) => f.type === 'textarea')

          if (firstRichText) {
            const lexical = markdownToLexical(md, { skipFirstH1: false })
            overrides = {
              ...(overrides && typeof overrides === 'object' ? overrides : {}),
              [firstRichText.slug]: lexical,
            }
          } else if (firstTextArea) {
            overrides = {
              ...(overrides && typeof overrides === 'object' ? overrides : {}),
              [firstTextArea.slug]: md,
            }
          } else {
            // Fallback for known types
            const targetField = String(mi.type).toLowerCase().includes('prose') ? (String(mi.type) === 'prose' ? 'content' : 'body') : 'body'
            const lexical = markdownToLexical(md, { skipFirstH1: false })
            overrides = {
              ...(overrides && typeof overrides === 'object' ? overrides : {}),
              [targetField]: lexical,
            }
          }
        }

        // Automatic Markdown-to-Lexical conversion for RichText fields in explicit overrides
        if (overrides && typeof overrides === 'object') {
          await this.autoConvertFields(postModuleId, overrides)
        }

        await UpdatePostModule.handle({
          postModuleId,
          overrides,
          locked,
          orderIndex,
          mode: targetMode,
        })

        return {
          success: true,
          message: 'Module updated in AI review draft',
        }
      }

      case 'remove_post_module_ai_review': {
        let { postModuleId, moduleInstanceId, postId, type } = params

        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

        // Resolve postModuleId from type/postId if needed
        if ((!postModuleId || !uuidRegex.test(postModuleId)) && postId && (type || postModuleId)) {
          const moduleType = type || postModuleId
          if (uuidRegex.test(postId)) {
            const pm = await db
              .from('post_modules')
              .join('module_instances', 'post_modules.module_id', 'module_instances.id')
              .where('post_modules.post_id', postId)
              .where('module_instances.type', moduleType)
              .select('post_modules.id')
              .first()
            if (pm) postModuleId = String(pm.id)
          }
        }

        // Resolve postModuleId from moduleInstanceId if needed
        if (
          (!postModuleId || !uuidRegex.test(postModuleId)) &&
          moduleInstanceId &&
          uuidRegex.test(moduleInstanceId)
        ) {
          const pm = await db
            .from('post_modules')
            .where('module_id', moduleInstanceId)
            .select('id')
            .first()
          if (pm) postModuleId = String(pm.id)
        }

        if (!postModuleId || !uuidRegex.test(postModuleId)) {
          throw new Error(
            `remove_post_module_ai_review requires a valid "postModuleId" (UUID). Received: "${postModuleId}"`
          )
        }

        await db.from('post_modules').where('id', postModuleId).update({ ai_review_deleted: true })

        return {
          success: true,
          message: 'Module marked as deleted in AI review draft',
        }
      }

      case 'create_translation_ai_review': {
        const {
          postId,
          locale,
          sourceMode = 'review',
          cloneModules = true,
          agentName,
          slug,
          title,
          featuredMediaId,
        } = params

        if (!postId || !locale) {
          throw new Error('create_translation_ai_review requires "postId" and "locale"')
        }

        const agentLabel = this.resolveAgentLabel(agentId, agentName)

        // Create the translation row (inherits type/module group and sets status=draft)
        const translation = await CreateTranslation.handle({
          postId,
          locale,
          slug,
          title,
          metaTitle: null, // Don't set in approved fields when seeding into AI review
          metaDescription: null, // Don't set in approved fields when seeding into AI review
        })

        // Load base post info for drafting context
        const base = await db.from('posts').where('id', postId).whereNull('deleted_at').first()
        const baseId = base?.translation_of_id || base?.id || postId
        const source = await db.from('posts').where('id', baseId).whereNull('deleted_at').first()

        // Base content for AI Review: use review draft when requested and present
        const sourceDraft =
          sourceMode === 'review' && source?.review_draft ? source.review_draft : null
        const basePayload = sourceDraft || {
          slug: source?.slug,
          title: source?.title,
          status: source?.status,
          excerpt: source?.excerpt ?? null,
          parentId: source?.parent_id ?? null,
          orderIndex: source?.order_index ?? 0,
          metaTitle: source?.meta_title ?? null,
          metaDescription: source?.meta_description ?? null,
          canonicalUrl: source?.canonical_url ?? null,
          robotsJson: source?.robots_json ?? null,
          jsonldOverrides: source?.jsonld_overrides ?? null,
          featuredMediaId: source?.featured_media_id ?? null,
        }

        const aiReviewDraft = {
          ...basePayload,
          slug: (translation as any).slug,
          title: (translation as any).title,
          status: (translation as any).status,
          featuredMediaId:
            featuredMediaId !== undefined ? (featuredMediaId ?? null) : basePayload.featuredMediaId,
          savedAt: new Date().toISOString(),
          savedBy: agentLabel,
          translation: {
            sourcePostId: baseId,
            sourceLocale: source?.locale || null,
            targetLocale: locale,
          },
        }

        await db
          .from('posts')
          .where('id', (translation as any).id)
          .update({
            ai_review_draft: aiReviewDraft,
            updated_at: new Date(),
          } as any)

        const actorUserId = await this.resolveActorUserId(agentId)

        await RevisionService.record({
          postId: (translation as any).id,
          mode: targetMode as any,
          snapshot: aiReviewDraft,
          userId: actorUserId,
        })

        // Optionally clone module structure into AI Review staging for the translation post
        if (cloneModules) {
          const modules = await db
            .from('post_modules as pm')
            .join('module_instances as mi', 'pm.module_id', 'mi.id')
            .where('pm.post_id', baseId)
            .orderBy('pm.order_index', 'asc')
            .select(
              'pm.id as postModuleId',
              'pm.order_index as orderIndex',
              'pm.locked',
              'pm.overrides',
              'pm.review_overrides as reviewOverrides',
              'pm.review_deleted as reviewDeleted',
              'mi.type',
              'mi.scope',
              'mi.props',
              'mi.review_props as reviewProps',
              'mi.global_slug as globalSlug'
            )

          const map: Array<{ sourcePostModuleId: string; newPostModuleId: string }> = []
          for (const m of modules as any[]) {
            if (sourceMode === 'review' && m.reviewDeleted) continue

            const effectiveProps =
              sourceMode === 'review' ? m.reviewProps || m.props || {} : m.props || {}
            const effectiveOverrides =
              sourceMode === 'review'
                ? (m.reviewOverrides ?? m.overrides ?? null)
                : (m.overrides ?? null)

            const isGlobal = m.scope === 'global'
            const added = await AddModuleToPost.handle({
              postId: (translation as any).id,
              moduleType: m.type,
              scope: isGlobal ? 'global' : 'local',
              props: effectiveProps,
              globalSlug: isGlobal ? m.globalSlug : null,
              orderIndex: Number(m.orderIndex ?? 0),
              locked: !!m.locked,
              mode: targetMode,
            })

            map.push({
              sourcePostModuleId: String(m.postModuleId),
              newPostModuleId: added.postModule.id,
            })

            // For global modules, stage overrides into ai_review_overrides
            if (isGlobal && effectiveOverrides) {
              await UpdatePostModule.handle({
                postModuleId: added.postModule.id,
                overrides: effectiveOverrides,
                mode: targetMode,
              })
            }
          }

          return {
            success: true,
            translationId: (translation as any).id,
            locale: (translation as any).locale,
            slug: (translation as any).slug,
            title: (translation as any).title,
            clonedModules: map,
          }
        }

        return {
          success: true,
          translationId: (translation as any).id,
          locale: (translation as any).locale,
          slug: (translation as any).slug,
          title: (translation as any).title,
        }
      }

      case 'create_translations_ai_review_bulk': {
        const { postId, locales, sourceMode = 'review', cloneModules = true, agentName } = params

        if (!postId || !Array.isArray(locales) || locales.length === 0) {
          throw new Error(
            'create_translations_ai_review_bulk requires "postId" and "locales" (array)'
          )
        }

        const results: any[] = []
        for (const locale of locales) {
          try {
            const res = await this.callTool(
              'create_translation_ai_review',
              {
                postId,
                locale,
                sourceMode,
                cloneModules,
                agentName,
              },
              agentId
            )
            results.push({ locale, success: true, ...res })
          } catch (e: any) {
            results.push({ locale, success: false, error: e?.message })
          }
        }

        return { success: true, results }
      }

      case 'list_agents': {
        const list = agentRegistry.listEnabled()
        return {
          success: true,
          agents: list.map((a) => ({
            id: a.id,
            name: a.name,
            description: a.description || '',
          })),
        }
      }

      case 'run_agent': {
        const { agentId: targetAgentId, postId, scope = 'dropdown', context = {}, openEndedContext } = params
        const agent = agentRegistry.get(targetAgentId)
        if (!agent) throw new Error('Agent not found')

        const actorUserId = await this.resolveActorUserId(targetAgentId)

        const executionContext: any = {
          agent,
          scope,
          userId: actorUserId,
          data: {
            postId,
            ...context,
          },
        }

        let payload: any = {
          context: {
            ...context,
            ...(openEndedContext ? { openEndedContext } : {}),
          },
        }

        if (postId) {
          const viewMode = context.viewMode || 'source'
          const canonical = await PostSerializerService.serialize(postId, viewMode)
          payload.post = canonical
          executionContext.data.post = canonical
        }

        const agentExecutor = (await import('#services/agent_executor')).default
        const result = await agentExecutor.execute(agent as any, executionContext, payload)

        return {
          success: result.success,
          agentId: targetAgentId,
          postId,
          response: result.data,
          summary: (result as any).summary,
          applied: (result as any).applied || [],
          error: result.error,
        }
      }

      case 'run_field_agent': {
        const {
          agentId: fieldAgentId,
          postId,
          fieldKey,
          currentValue,
          postModuleId,
          moduleInstanceId,
          applyToAiReview,
          context,
          openEndedContext,
        } = params
        const agent = agentRegistry.get(fieldAgentId)
        if (!agent) throw new Error('Agent not found')

        const actorUserId = await this.resolveActorUserId(fieldAgentId)
        const agentExecutor = (await import('#services/agent_executor')).default

        const executionContext: any = {
          agent,
          scope: 'field',
          userId: actorUserId,
          data: {
            postId,
            fieldKey,
            currentValue,
            postModuleId,
            moduleInstanceId,
            context,
          },
        }

        const canonical = await PostSerializerService.serialize(postId, 'source')
        const payload = {
          post: canonical,
          field: {
            key: fieldKey,
            currentValue: currentValue,
          },
          context: {
            ...(context || {}),
            ...(openEndedContext ? { openEndedContext } : {}),
          },
        }

        const result = await agentExecutor.execute(agent as any, executionContext, payload as any)

        if (applyToAiReview && result.success) {
          // Simplistic staging logic for internal call
          // In a real scenario, this would call UpdatePostModule or SaveReviewDraft
          // For now, we return the result and let the caller handle staging if needed
        }

        return {
          success: result.success,
          response: result.data,
          error: result.error,
        }
      }

      case 'suggest_modules_for_layout': {
        const { desiredLayoutRoles, postType, excludeModuleTypes } = params

        // Get all allowed modules for this post type
        const allModules = postType
          ? moduleRegistry.getAllowedForPostType(postType)
          : moduleRegistry.getAll()

        const suggestions: any[] = []
        const missingRoles: string[] = []

        // If specific roles desired, find modules matching those roles
        if (desiredLayoutRoles && Array.isArray(desiredLayoutRoles)) {
          for (const role of desiredLayoutRoles) {
            const matches = allModules.filter((m) => {
              const config = m.getConfig()
              if (excludeModuleTypes?.includes(config.type)) return false
              return config.aiGuidance?.layoutRoles?.includes(role)
            })

            if (matches.length > 0) {
              // Pick the best match (or first)
              const best = matches[0].getConfig()
              suggestions.push({
                role,
                moduleType: best.type,
                name: best.name,
                reason: `Matches desired role: ${role}`,
              })
            } else {
              missingRoles.push(role)
            }
          }
        }

        return {
          success: true,
          suggestions,
          missingRoles,
          allAvailableModules: allModules.map((m) => {
            const c = m.getConfig()
            return {
              type: c.type,
              name: c.name,
              roles: c.aiGuidance?.layoutRoles || [],
            }
          }),
        }
      }

      case 'search_media': {
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
          .select(
            'id',
            'url',
            'original_filename',
            'alt_text',
            'description',
            'categories',
            'mime_type'
          )

        const mediaItems = results.map((r: any) => ({
          id: r.id,
          url: r.url,
          originalFilename: r.original_filename,
          altText: r.alt_text,
          description: r.description,
          categories: Array.isArray(r.categories) ? r.categories : [],
          mimeType: r.mime_type,
        }))

        return {
          success: true,
          count: mediaItems.length,
          items: mediaItems,
        }
      }

      case 'generate_image': {
        const { prompt, alt_text, description, model, size, quality, theme = 'light', variationOf } = params

        if (!prompt || typeof prompt !== 'string') {
          throw new Error('generate_image requires a "prompt" parameter (string)')
        }

        // Determine provider and model from agent config if available
        let providerMedia: any = undefined
        let modelMedia: string | undefined = model
        let apiKey: string | undefined
        let baseUrl: string | undefined

        if (agentId) {
          const agentDef = agentRegistry.get(agentId)
          if (agentDef?.llmConfig) {
            providerMedia = agentDef.llmConfig.providerMedia || agentDef.llmConfig.provider
            modelMedia = modelMedia || agentDef.llmConfig.modelMedia || agentDef.llmConfig.model
            apiKey = agentDef.llmConfig.apiKey
            baseUrl = agentDef.llmConfig.baseUrl
          }
        }

        // Fallback to global defaults if not in agent config
        if (!providerMedia || !modelMedia) {
          const { default: aiSettingsService } = await import('#services/ai_settings_service')
          const globalSettings = await aiSettingsService.get()
          providerMedia = providerMedia || (globalSettings.defaultMediaProvider as any)
          modelMedia = modelMedia || globalSettings.defaultMediaModel || undefined
        }

        // Default fallbacks if still undefined
        providerMedia = providerMedia || 'openai'
        modelMedia =
          modelMedia || (providerMedia === 'openai' ? 'dall-e-3' : 'imagen-4.0-generate-001')

        if (!apiKey) {
          const envKey = `AI_PROVIDER_${providerMedia.toUpperCase()}_API_KEY`
          apiKey = (process.env[envKey] as string | undefined) || undefined
        }

        if (!apiKey) {
          throw new Error(
            `API key not found for provider ${providerMedia}. Set AI_PROVIDER_${providerMedia.toUpperCase()}_API_KEY environment variable.`
          )
        }

        const aiProviderService = (await import('#services/ai_provider_service')).default

        // Call AI Provider Service to generate image
        let imageUrl: string
        let revisedPrompt: string | undefined

        try {
          const result = await aiProviderService.generateImage(
            prompt,
            { size, quality },
            {
              provider: providerMedia,
              apiKey,
              model: modelMedia,
              baseUrl,
            }
          )
          imageUrl = result.imageUrl
          revisedPrompt = result.revisedPrompt
        } catch (error: any) {
          console.error(`[generate_image] ${providerMedia} generation failed`, {
            error: error.message,
          })
          throw error
        }

        // Download the generated image
        let imageBuffer: Buffer
        let mimeType: string

        try {
          if (imageUrl.startsWith('data:')) {
            const matches = imageUrl.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/)
            if (!matches || matches.length !== 3) {
              throw new Error('Invalid data URI returned from AI provider')
            }
            mimeType = matches[1]
            imageBuffer = Buffer.from(matches[2], 'base64')
          } else {
            const imageResponse = await fetch(imageUrl)
            if (!imageResponse.ok) {
              throw new Error(`Failed to download generated image: ${imageResponse.statusText}`)
            }
            imageBuffer = Buffer.from(await imageResponse.arrayBuffer())
            mimeType = imageResponse.headers.get('content-type') || 'image/png'
          }
        } catch (error: any) {
          console.error('[generate_image] Failed to get image data', { error: error.message })
          throw new Error(`Failed to get generated image: ${error.message}`)
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

        const filename = `${crypto.randomUUID()}${theme === 'dark' ? '-dark' : ''}${ext}`
        const destPath = path.join(uploadsDir, filename)
        await fs.writeFile(destPath, imageBuffer)

        const url = `/uploads/${filename}`

        // Publish to storage
        try {
          await storageService.publishFile(destPath, url, mimeType)
        } catch {
          /* ignore publish errors; local file remains */
        }

        if (theme === 'dark' && variationOf) {
          // Update existing media asset
          const parentMedia = await db.from('media_assets').where('id', variationOf).first()
          if (!parentMedia) throw new Error(`Media asset to vary not found: ${variationOf}`)

          // Generate dark variants
          let metadata = parentMedia.metadata || {}
          try {
            const darkVariants = await mediaService.generateVariants(
              destPath,
              url,
              null,
              null,
              null,
              'dark'
            )
            metadata = {
              ...metadata,
              darkSourceUrl: url,
              variants: [...(metadata.variants || []), ...darkVariants],
            }
          } catch {
            // ignore variant generation errors
          }

          await db.from('media_assets').where('id', variationOf).update({
            metadata: metadata as any,
            updated_at: new Date(),
          })

          return {
            success: true,
            mediaId: variationOf,
            url, // RETURN THE NEWLY GENERATED (DARK) URL HERE
            darkUrl: url, // UI Compatibility
            altText: parentMedia.alt_text,
            description: parentMedia.description,
            generatedMediaUrls: {
              light: parentMedia.url,
              dark: url,
            },
            message: 'Dark version added to existing media asset',
          }
        }

        // Standard new media creation
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
          original_filename: filename,
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
              provider: providerMedia,
              model: modelMedia,
              size,
              quality,
              revisedPrompt,
              generated: true,
            },
          })
        } catch {
          // ignore activity log errors
        }

        return {
          success: true,
          mediaId,
          altText: alt_text || prompt.slice(0, 200),
          description: description || null,
          url,
          generatedMediaUrls: {
            light: url
          }
        }
      }

      case 'generate_video': {
        const { prompt, description, model, aspect_ratio, duration } = params

        if (!prompt || typeof prompt !== 'string') {
          throw new Error('generate_video requires a "prompt" parameter (string)')
        }

        // Determine provider and model from agent config if available
        let providerVideo: any = undefined
        let modelVideo: string | undefined = model
        let apiKey: string | undefined
        let baseUrl: string | undefined

        if (agentId) {
          const agentDef = agentRegistry.get(agentId)
          if (agentDef?.llmConfig) {
            providerVideo = agentDef.llmConfig.providerVideo || agentDef.llmConfig.provider
            modelVideo = modelVideo || agentDef.llmConfig.modelVideo || agentDef.llmConfig.model
            apiKey = agentDef.llmConfig.apiKey
            baseUrl = agentDef.llmConfig.baseUrl
          }
        }

        // Fallback to global defaults if not in agent config
        if (!providerVideo || !modelVideo) {
          const { default: aiSettingsService } = await import('#services/ai_settings_service')
          const globalSettings = await aiSettingsService.get()
          providerVideo = providerVideo || (globalSettings.defaultVideoProvider as any)
          modelVideo = modelVideo || globalSettings.defaultVideoModel || undefined
        }

        // Default fallbacks if still undefined
        providerVideo = providerVideo || 'google'
        modelVideo = modelVideo || 'veo-2'

        if (!apiKey) {
          const envKey = `AI_PROVIDER_${providerVideo.toUpperCase()}_API_KEY`
          apiKey = (process.env[envKey] as string | undefined) || undefined
        }

        if (!apiKey) {
          throw new Error(
            `API key not found for provider ${providerVideo}. Set AI_PROVIDER_${providerVideo.toUpperCase()}_API_KEY environment variable.`
          )
        }

        const aiProviderService = (await import('#services/ai_provider_service')).default

        // Call AI Provider Service to generate video
        let videoUrl: string

        try {
          // We'll need to implement generateVideo in AIProviderService
          const res = await (aiProviderService as any).generateVideo(
            prompt,
            { aspect_ratio, duration },
            {
              provider: providerVideo,
              apiKey,
              model: modelVideo,
              baseUrl,
            }
          )
          videoUrl = res.videoUrl
        } catch (error: any) {
          console.error(`[generate_video] ${providerVideo} generation failed`, {
            error: error.message,
          })
          throw error
        }

        // Download the generated video
        let videoBuffer: Buffer
        let mimeType: string

        try {
          const videoResponse = await fetch(videoUrl)
          if (!videoResponse.ok) {
            throw new Error(`Failed to download generated video: ${videoResponse.statusText}`)
          }
          videoBuffer = Buffer.from(await videoResponse.arrayBuffer())
          mimeType = videoResponse.headers.get('content-type') || 'video/mp4'
        } catch (error: any) {
          console.error('[generate_video] Failed to get video data', { error: error.message })
          throw new Error(`Failed to get generated video: ${error.message}`)
        }

        // Determine file extension from mime type
        let ext = '.mp4'
        if (mimeType.includes('webm')) {
          ext = '.webm'
        }

        // Save to uploads directory
        const uploadsDir = path.join(process.cwd(), 'public', 'uploads')
        await fs.mkdir(uploadsDir, { recursive: true })

        const filename = `${crypto.randomUUID()}${ext}`
        const destPath = path.join(uploadsDir, filename)
        await fs.writeFile(destPath, videoBuffer)

        const url = `/uploads/${filename}`

        // Publish to storage
        try {
          await storageService.publishFile(destPath, url, mimeType)
        } catch {
          /* ignore publish errors; local file remains */
        }

        // Insert into media_assets table
        const mediaId = crypto.randomUUID()
        const now = new Date()

        await db.table('media_assets').insert({
          id: mediaId,
          url,
          original_filename: filename,
          mime_type: mimeType,
          size: videoBuffer.length,
          alt_text: prompt.slice(0, 200),
          caption: null,
          description: description || null,
          categories: db.raw('ARRAY[]::text[]') as any,
          metadata: { prompt, provider: providerVideo, model: modelVideo } as any,
          created_at: now,
          updated_at: now,
        })

        // Log activity
        try {
          const activityLogServiceImport = (await import('#services/activity_log_service')).default
          const actorUserId = await this.resolveActorUserId(agentId)
          await activityLogServiceImport.log({
            action: 'media.generate_video',
            userId: actorUserId,
            entityType: 'media',
            entityId: mediaId,
            metadata: {
              prompt,
              provider: providerVideo,
              model: modelVideo,
            },
          })
        } catch {
          // ignore activity logging errors
        }

        return {
          success: true,
          mediaId,
          url,
          mimeType,
        }
      }

      case 'check_media_integrity': {
        const { mediaId } = params
        if (!mediaId) throw new Error('check_media_integrity requires "mediaId"')
        const row = await db.from('media_assets').where('id', mediaId).first()
        if (!row) throw new Error(`Media not found: ${mediaId}`)

        const results: any = {
          database: true,
          original: { url: row.url, exists: false },
          variants: [],
          optimized: row.optimized_url ? { url: row.optimized_url, exists: false } : null,
        }

        const checkExists = async (u: string) => {
          if (u.startsWith('http')) return true
          const absPath = path.join(process.cwd(), 'public', u.replace(/^\//, ''))
          try {
            await fs.access(absPath)
            return true
          } catch {
            return false
          }
        }

        results.original.exists = await checkExists(row.url)
        if (row.optimized_url) {
          results.optimized.exists = await checkExists(row.optimized_url)
        }

        const meta = (row.metadata || {}) as any
        if (Array.isArray(meta.variants)) {
          for (const v of meta.variants) {
            results.variants.push({
              name: v.name,
              url: v.url,
              exists: await checkExists(v.url),
            })
          }
        }

        return { success: true, ...results }
      }

      case 'tail_activity_logs': {
        const { limit = 20, entityId, action } = params
        let query = db.from('activity_logs')
        if (entityId) query = query.where('entity_id', entityId)
        if (action) query = query.where('action', action)

        const logs = await query.orderBy('created_at', 'desc').limit(limit)
        return { success: true, logs }
      }

      case 'simulate_webhook_event': {
        const { event, payload } = params
        if (!event || !payload) throw new Error('simulate_webhook_event requires "event" and "payload"')
        await webhookService.dispatch(event as any, payload)
        return { success: true, message: `Dispatched ${event}` }
      }

      case 'run_ace_command': {
        const { command, args = [] } = params
        if (!command) throw new Error('run_ace_command requires "command"')
        const fullCmd = `node ace ${command} ${args.join(' ')}`
        const { stdout, stderr } = await execAsync(fullCmd)
        return { success: true, stdout, stderr }
      }

      case 'test_local_route': {
        const { url, method = 'GET', body } = params
        if (!url) throw new Error('test_local_route requires "url"')
        const appPort = process.env.PORT || 3333
        const fullUrl = `http://localhost:${appPort}${url.startsWith('/') ? '' : '/'}${url}`

        const response = await fetch(fullUrl, {
          method,
          headers: body ? { 'Content-Type': 'application/json' } : {},
          body: body ? JSON.stringify(body) : undefined,
        })

        const data = await response.json().catch(() => null)
        const text = !data ? await response.text().catch(() => '') : null

        return {
          success: true,
          status: response.status,
          statusText: response.statusText,
          data,
          text,
        }
      }

      case 'read_server_logs': {
        const { lines = 50 } = params
        const terminalDir = path.join(process.cwd(), '.cursor/projects', 'home-spaced-man-Dev-applications-adonis-eos', 'terminals')

        let logContent = ''
        try {
          const files = await fs.readdir(terminalDir)
          const stats = await Promise.all(
            files.map(async (f) => ({
              name: f,
              stat: await fs.stat(path.join(terminalDir, f)),
            }))
          )
          const latest = stats
            .filter((s) => s.name.endsWith('.txt'))
            .sort((a, b) => b.stat.mtimeMs - a.stat.mtimeMs)[0]

          if (latest) {
            const content = await fs.readFile(path.join(terminalDir, latest.name), 'utf-8')
            const allLines = content.split('\n')
            logContent = allLines.slice(-lines).join('\n')
          } else {
            throw new Error('No terminal log files found')
          }
        } catch (e: any) {
          throw new Error(`Failed to read server logs: ${e.message}`)
        }

        return { success: true, logs: logContent }
      }

      case 'diff_post_versions': {
        const { postId, baseMode = 'source', targetMode = 'ai-review' } = params
        if (!postId) throw new Error('diff_post_versions requires "postId"')

        const [base, target] = await Promise.all([
          PostSerializerService.serialize(postId, baseMode as any),
          PostSerializerService.serialize(postId, targetMode as any)
        ])

        const fieldDiff: Record<string, any> = {}
        const postFields = ['slug', 'title', 'excerpt', 'metaTitle', 'metaDescription', 'featuredMediaId']
        postFields.forEach(field => {
          const bVal = (base.post as any)[field]
          const tVal = (target.post as any)[field]
          fieldDiff[field] = {
            base: bVal,
            target: tVal,
            changed: JSON.stringify(bVal) !== JSON.stringify(tVal)
          }
        })

        return {
          success: true,
          diff: fieldDiff,
          baseModules: base.modules?.length || 0,
          targetModules: target.modules?.length || 0
        }
      }

      case 'query_db_summary': {
        const [posts, media] = await Promise.all([
          db.from('posts').select('type').count('* as count').groupBy('type'),
          db.from('media_assets').count('* as count').first(),
        ])
        return {
          success: true,
          posts,
          mediaCount: Number(media?.count || 0)
        }
      }

      case 'trace_url_resolution': {
        const { path: urlPath } = params
        if (!urlPath) throw new Error('trace_url_resolution requires "path"')
        const match = await urlPatternService.matchPath(urlPath)
        if (!match) {
          return { success: true, matched: false, message: 'No pattern matched this URL' }
        }

        const post = await Post.query()
          .where({
            type: match.postType,
            locale: match.locale,
            slug: match.slug,
          })
          .whereNull('deleted_at')
          .first()

        return {
          success: true,
          matched: true,
          matchInfo: match,
          post: post
            ? {
              id: post.id,
              title: post.title,
              status: post.status,
            }
            : null,
        }
      }

      case 'validate_mcp_payload': {
        const { type, props } = params
        if (!type || !props) throw new Error('validate_mcp_payload requires "type" and "props"')
        if (!moduleRegistry.has(type)) {
          throw new Error(`Module type "${type}" not found`)
        }
        const module = moduleRegistry.get(type)
        try {
          module.validate(props)
          return { success: true, valid: true }
        } catch (err: any) {
          return { success: true, valid: false, error: err.message }
        }
      }

      default:
        throw new Error(`MCP tool '${toolName}' not yet implemented in internal agent executor`)
    }
  }

  /**
   * Resolve a label for an agent (name or ID)
   */
  private resolveAgentLabel(agentId?: string, agentName?: string): string {
    const id = (agentId || '').trim()
    if (id) {
      const def = agentRegistry.get(id)
      if (def?.name) return def.name
    }
    const name = (agentName || '').trim()
    return name || 'AI Agent'
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
   * Extract first H2 from markdown
   */
  private extractMarkdownH2(md: string): string | null {
    const s = String(md || '')
    const m = s.match(/^\s*##\s+(.+?)\s*$/m)
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
