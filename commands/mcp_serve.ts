import { BaseCommand, flags } from '@adonisjs/core/ace'
import type { CommandOptions } from '@adonisjs/core/types/ace'
import moduleRegistry from '#services/module_registry'
import moduleScopeService from '#services/module_scope_service'
import postTypeRegistry from '#services/post_type_registry'
import postTypeConfigService from '#services/post_type_config_service'
import agentRegistry from '#services/agent_registry'
import formRegistry from '#services/form_registry'
import webhookService from '#services/webhook_service'
import db from '@adonisjs/lucid/services/db'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { z } from 'zod'
import http from 'node:http'
import { URL } from 'node:url'
import CreatePost from '#actions/posts/create_post'
import AddModuleToPost from '#actions/posts/add_module_to_post'
import UpdatePostModule from '#actions/posts/update_post_module'
import RevisionService from '#services/revision_service'
import storageService from '#services/storage_service'
import PostSerializerService from '#services/post_serializer_service'
import CreateTranslation from '#actions/translations/create_translation'
import previewService from '#services/preview_service'
import taxonomyService from '#services/taxonomy_service'
import urlPatternService from '#services/url_pattern_service'
import Post from '#models/post'
import { getUserIdForAgent } from '#services/agent_user_service'
import { markdownToLexical } from '#helpers/markdown_to_lexical'
import { mcpLayoutConfig } from '../app/mcp/layout_config.js'
import { promisify } from 'node:util'
import { exec } from 'node:child_process'
import path from 'node:path'
import fs from 'node:fs/promises'

const execAsync = promisify(exec)

type JsonTextResult = {
  content: Array<{ type: 'text'; text: string }>
  isError?: boolean
}

function jsonResult(data: unknown): JsonTextResult {
  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(data, null, 2),
      },
    ],
  }
}

function errorResult(message: string, meta?: Record<string, unknown>): JsonTextResult {
  return {
    isError: true,
    content: [
      {
        type: 'text',
        text: JSON.stringify({ error: message, ...(meta ? { meta } : {}) }, null, 2),
      },
    ],
  }
}

function resolveAgentLabel(input?: { agentId?: string; agentName?: string }): string {
  const agentId = (input?.agentId || '').trim()
  if (agentId) {
    const def = agentRegistry.get(agentId)
    if (def?.name) return def.name
  }
  const agentName = (input?.agentName || '').trim()
  return agentName || 'AI Agent'
}

function stripMarkdownInline(s: string): string {
  return String(s || '')
    .replace(/`{1,3}([^`]+)`{1,3}/g, '$1')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/_([^_]+)_/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, '$1')
    .trim()
}

function extractMarkdownH1(md: string): string | null {
  const s = String(md || '')
  // Prefer the first ATX h1
  const m = s.match(/^\s*#\s+(.+?)\s*$/m)
  if (m?.[1]) return stripMarkdownInline(m[1])
  return null
}

function extractMarkdownParagraphs(md: string): string[] {
  const s = String(md || '')
  // Very lightweight: split on blank lines, ignore headings/code blocks.
  const blocks = s.split(/\n\s*\n+/g).map((b) => b.trim())
  const paras: string[] = []
  for (const b of blocks) {
    if (!b) continue
    if (/^\s*#{1,6}\s+/.test(b)) continue
    if (/^\s*```/.test(b)) continue
    // skip lists; we only want short descriptive paragraphs
    if (/^\s*[-*]\s+/.test(b) || /^\s*\d+\.\s+/.test(b)) continue
    const oneLine = stripMarkdownInline(b.replace(/\s+/g, ' '))
    if (oneLine.length >= 20) paras.push(oneLine)
    if (paras.length >= 5) break
  }
  return paras
}

function extractMarkdownH2s(md: string): string[] {
  const s = String(md || '')
  const matches = [...s.matchAll(/^\s*##\s+(.+?)\s*$/gm)]
  return matches.map((m) => stripMarkdownInline(m[1] || '')).filter(Boolean)
}

const moduleEditSchema = z.object({
  /**
   * Preferred targeting: explicit postModuleId.
   */
  postModuleId: z.string().optional().describe('Target postModuleId (recommended if known).'),
  /**
   * Convenience targeting when creating a post: match the seeded template module.
   */
  type: z
    .string()
    .optional()
    .describe('Module type selector (used when postModuleId is not provided).'),
  orderIndex: z
    .number()
    .int()
    .optional()
    .describe('Order index selector (used with type when postModuleId is not provided).'),
  /**
   * Props/overrides to apply in AI Review.
   * Note: for local modules these are merged into ai_review_props; for global modules into ai_review_overrides.
   */
  overrides: z.record(z.any()).nullable().optional(),
  /**
   * Convenience for prose modules: provide markdown and the server will convert it to Lexical JSON
   * and apply it as overrides.content.
   */
  contentMarkdown: z.string().optional(),
})

function getSystemUserId(): number | null {
  const raw = String(process.env.MCP_SYSTEM_USER_ID || '').trim()
  if (!raw) return null
  const n = Number(raw)
  if (!Number.isFinite(n) || n <= 0) return null
  return Math.floor(n)
}

let cachedSystemUserId: number | null | undefined
async function resolveSystemUserId(): Promise<number | null> {
  if (cachedSystemUserId !== undefined) return cachedSystemUserId

  const envId = getSystemUserId()
  if (envId) {
    cachedSystemUserId = envId
    return envId
  }

  // Fallback to a dedicated seeded AI user (or any user with ai_agent role)
  try {
    const byEmail = await db.from('users').select('id').where('email', 'ai@agents.local').first()
    if (byEmail?.id) {
      cachedSystemUserId = Number(byEmail.id)
      return cachedSystemUserId
    }
    const byRole = await db
      .from('users')
      .select('id')
      .where('role', 'ai_agent')
      .orderBy('id', 'asc')
      .first()
    if (byRole?.id) {
      cachedSystemUserId = Number(byRole.id)
      return cachedSystemUserId
    }
  } catch {
    // ignore DB errors; MCP tools will surface a helpful error when needed
  }

  cachedSystemUserId = null
  return null
}

async function resolveActorUserId(input?: { agentId?: string }): Promise<number | null> {
  const agentId = (input?.agentId || '').trim()
  if (agentId) {
    const id = await getUserIdForAgent(agentId)
    if (typeof id === 'number' && id > 0) return id
  }
  return await resolveSystemUserId()
}

function getHeader(req: http.IncomingMessage, name: string): string | undefined {
  const raw = req.headers[name.toLowerCase()]
  if (Array.isArray(raw)) return raw[0]
  return raw ? String(raw) : undefined
}

function isAuthorized(req: http.IncomingMessage): boolean {
  const bearer = process.env.MCP_AUTH_TOKEN
  const headerName = process.env.MCP_AUTH_HEADER_NAME
  const headerValue = process.env.MCP_AUTH_HEADER_VALUE

  if (!bearer && !(headerName && headerValue)) {
    return true
  }

  if (bearer) {
    const auth = getHeader(req, 'authorization') || ''
    if (auth === `Bearer ${bearer}`) return true
  }

  if (headerName && headerValue) {
    const v = getHeader(req, headerName) || ''
    if (v === headerValue) return true
  }

  return false
}

function sendUnauthorized(res: http.ServerResponse) {
  res.writeHead(401, { 'content-type': 'application/json' })
  res.end(JSON.stringify({ error: 'Unauthorized' }))
}

function createServerInstance() {
  const server = new McpServer(
    {
      name: 'adonis-eos',
      version: process.env.npm_package_version || '0.0.0',
    },
    { capabilities: { logging: {} } }
  )

  // Post Types
  server.tool('list_post_types', 'List all registered post types', async () => {
    return jsonResult({ data: postTypeRegistry.list() })
  })

  server.tool(
    'list_registry_items',
    'Returns a structured list of everything registered in PostTypeRegistry, ModuleRegistry, and FormRegistry.',
    async () => {
      try {
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

        return jsonResult({
          data: {
            postTypes,
            modules,
            forms,
          },
        })
      } catch (e: any) {
        return errorResult('Failed to list registry items', { message: e?.message })
      }
    }
  )

  server.tool(
    'get_post_type_config',
    'Get a post type config as used by the admin/editor UI (normalized defaults)',
    {
      postType: z.string().min(1).describe('Post type slug (e.g. "page", "blog")'),
    },
    async ({ postType }) => {
      try {
        const cfg = postTypeConfigService.getUiConfig(postType)
        // Enrich with module group context from DB (editor parity)
        const moduleGroups = cfg.moduleGroupsEnabled
          ? await db
            .from('module_groups')
            .where('post_type', postType)
            .orderBy('updated_at', 'desc')
            .select('id', 'name', 'description', 'locked', 'post_type')
          : []

        const defaultName = cfg.moduleGroup?.name
        const defaultModuleGroup = cfg.moduleGroupsEnabled
          ? moduleGroups.find((g: any) => defaultName && String(g.name) === String(defaultName)) ||
          (moduleGroups.length === 1 ? moduleGroups[0] : null)
          : null

        return jsonResult({
          data: {
            ...cfg,
            moduleGroups,
            defaultModuleGroup,
          },
        })
      } catch (e: any) {
        return errorResult('Failed to load post type config', { message: e?.message })
      }
    }
  )

  // Module Groups (DB-backed templates for module layouts)
  server.tool(
    'list_module_groups',
    'List module groups (layout templates) from the database (optionally filtered by post type)',
    {
      postType: z.string().optional().describe('Optional post type slug (e.g. "page", "blog")'),
      q: z.string().optional().describe('Optional substring match for module group name'),
      limit: z.number().int().min(1).max(500).optional().describe('Max rows (default 200)'),
    },
    async ({ postType, q, limit }) => {
      try {
        const max = typeof limit === 'number' ? limit : 200
        const query = db.from('module_groups')
        if (postType) query.where('post_type', postType)
        if (q) query.andWhereILike('name', `%${q}%`)
        const rows = await query.orderBy('updated_at', 'desc').limit(max)
        return jsonResult({ data: rows })
      } catch (e: any) {
        return errorResult('Failed to list module groups', { message: e?.message })
      }
    }
  )

  server.tool(
    'get_module_group',
    'Get a single module group and its ordered module list',
    {
      moduleGroupId: z.string().min(1),
    },
    async ({ moduleGroupId }) => {
      try {
        const group = await db.from('module_groups').where('id', moduleGroupId).first()
        if (!group) return errorResult('Module group not found', { moduleGroupId })

        const modules = await db
          .from('module_group_modules')
          .where('module_group_id', moduleGroupId)
          .orderBy('order_index', 'asc')

        return jsonResult({ data: { ...group, modules } })
      } catch (e: any) {
        return errorResult('Failed to load module group', { message: e?.message })
      }
    }
  )

  // Modules (schemas + defaults)
  server.tool(
    'list_modules',
    'List all module configs (optionally filtered to modules allowed for a post type)',
    {
      postType: z
        .string()
        .optional()
        .describe('Optional post type slug. When provided, returns only allowed modules.'),
    },
    async ({ postType }) => {
      try {
        if (postType) {
          const allowed = await moduleScopeService.getAllowedModuleConfigsForPostType(postType)
          return jsonResult({ data: allowed })
        }
        return jsonResult({ data: moduleRegistry.getAllConfigs() })
      } catch (e: any) {
        return errorResult('Failed to list modules', { message: e?.message })
      }
    }
  )

  server.tool(
    'get_module_schema',
    'Get a module schema (propsSchema + defaultProps + usage constraints)',
    {
      type: z.string().min(1).describe('Module type (e.g. "hero", "prose")'),
    },
    async ({ type }) => {
      try {
        return jsonResult({ data: moduleRegistry.getSchema(type) })
      } catch (e: any) {
        return errorResult('Failed to load module schema', { message: e?.message })
      }
    }
  )

  server.tool(
    'inspect_module_definition',
    'Returns the defaultProps, config, and the TS/Inertia component path for a specific module.',
    {
      moduleSlug: z.string().min(1).describe('Module type/slug (e.g. "hero", "prose")'),
    },
    async ({ moduleSlug }) => {
      try {
        if (!moduleRegistry.has(moduleSlug)) {
          return errorResult(`Module "${moduleSlug}" not found`)
        }
        const m = moduleRegistry.get(moduleSlug)
        const cfg = m.getConfig()
        const schema = moduleRegistry.getSchema(moduleSlug)

        return jsonResult({
          data: {
            slug: moduleSlug,
            name: cfg.name,
            description: cfg.description,
            defaultProps: schema.defaultValues,
            config: cfg,
            // Component path is often derived from type in our system
            componentName: m.getComponentName(),
          },
        })
      } catch (e: any) {
        return errorResult('Failed to inspect module definition', { message: e?.message })
      }
    }
  )

  server.tool(
    'get_allowed_modules_for_post_type',
    'Get module configs allowed for a post type (applies both config-level and DB module_scopes restrictions)',
    {
      postType: z.string().min(1).describe('Post type slug (e.g. "page", "blog")'),
    },
    async ({ postType }) => {
      try {
        const allowed = await moduleScopeService.getAllowedModuleConfigsForPostType(postType)
        return jsonResult({ data: allowed })
      } catch (e: any) {
        return errorResult('Failed to load allowed modules', { message: e?.message })
      }
    }
  )

  // Global modules (DB-backed)
  server.tool(
    'list_global_modules',
    'List global modules from the database (optionally filtered by slug substring and/or type)',
    {
      q: z.string().optional().describe('Optional substring to match globalSlug'),
      type: z.string().optional().describe('Optional module type filter'),
      limit: z.number().int().min(1).max(500).optional().describe('Max rows (default 200)'),
    },
    async ({ q, type, limit }) => {
      try {
        const max = typeof limit === 'number' ? limit : 200
        const query = db.from('module_instances').where('scope', 'global')
        if (q) query.andWhereILike('global_slug', `%${q}%`)
        if (type) query.andWhere('type', type)
        const rows = await query.orderBy('updated_at', 'desc').limit(max)

        // usage counts in one shot
        const ids = rows.map((r: any) => r.id)
        let usageMap = new Map<string, number>()
        if (ids.length > 0) {
          const usageRows = await db
            .from('post_modules')
            .whereIn('module_id', ids)
            .groupBy('module_id')
            .select('module_id')
            .count('* as cnt')
          usageMap = new Map(usageRows.map((r: any) => [String(r.module_id), Number(r.cnt || 0)]))
        }

        return jsonResult({
          data: rows.map((r: any) => ({
            id: r.id,
            scope: r.scope,
            type: r.type,
            globalSlug: r.global_slug || null,
            label: (r as any).global_label || null,
            props: r.props || {},
            updatedAt: r.updated_at,
            usageCount: usageMap.get(String(r.id)) || 0,
          })),
        })
      } catch (e: any) {
        return errorResult('Failed to list global modules', { message: e?.message })
      }
    }
  )

  server.tool(
    'get_global_module',
    'Get one global module instance by globalSlug, including its module schema',
    {
      globalSlug: z.string().min(1).describe('Global module slug'),
    },
    async ({ globalSlug }) => {
      try {
        const row = await db
          .from('module_instances')
          .where('scope', 'global')
          .where('global_slug', globalSlug)
          .first()
        if (!row) return errorResult('Global module not found', { globalSlug })

        let schema: any = null
        try {
          schema = moduleRegistry.getSchema(String(row.type))
        } catch {
          schema = null
        }

        // usage count
        const usage = await db.from('post_modules').where('module_id', row.id).count('* as cnt')
        const usageCount = Number((usage?.[0] as any)?.cnt || 0)

        return jsonResult({
          data: {
            id: row.id,
            scope: row.scope,
            type: row.type,
            globalSlug: row.global_slug || null,
            label: (row as any).global_label || null,
            props: row.props || {},
            updatedAt: row.updated_at,
            usageCount,
            schema,
          },
        })
      } catch (e: any) {
        return errorResult('Failed to load global module', { message: e?.message })
      }
    }
  )

  /**
   * POSTS (AI-safe workflow)
   *
   * Guiding rules:
   * - MCP tools never mutate the "approved/live" post fields directly.
   * - All edits go into `posts.ai_review_draft` and module-level ai_review_* fields.
   * - Agents should consider `review_draft` as the base if it exists.
   */

  server.tool(
    'list_posts',
    'List posts (lightweight). Intended for agent discovery before reading full context.',
    {
      q: z.string().optional().describe('Search substring (slug/title)'),
      type: z.string().optional().describe('Post type filter'),
      locale: z.string().optional().describe('Locale filter'),
      status: z.string().optional().describe('Status filter (draft/review/published/...)'),
      limit: z.number().int().min(1).max(200).optional().describe('Max rows (default 50)'),
    },
    async ({ q, type, locale, status, limit }) => {
      try {
        const max = typeof limit === 'number' ? limit : 50
        const query = db.from('posts').whereNull('deleted_at')
        if (type) query.andWhere('type', type)
        if (locale) query.andWhere('locale', locale)
        if (status) query.andWhere('status', status)
        if (q) {
          query.andWhere((qb) => {
            qb.whereILike('slug', `%${q}%`).orWhereILike('title', `%${q}%`)
          })
        }
        const rows = await query
          .orderBy('updated_at', 'desc')
          .limit(max)
          .select('id', 'type', 'locale', 'slug', 'title', 'status', 'updated_at')

        return jsonResult({
          data: rows.map((r: any) => ({
            id: r.id,
            type: r.type,
            locale: r.locale,
            slug: r.slug,
            title: r.title,
            status: r.status,
            updatedAt: r.updated_at,
          })),
        })
      } catch (e: any) {
        return errorResult('Failed to list posts', { message: e?.message })
      }
    }
  )

  server.tool(
    'get_post_context',
    'Get full post context for editing: approved fields, review draft, AI review draft, and modules (including review/ai-review props/overrides).',
    {
      postId: z.string().min(1),
    },
    async ({ postId }) => {
      try {
        const post = await db.from('posts').where('id', postId).whereNull('deleted_at').first()
        if (!post) return errorResult('Post not found', { postId })

        const modules = await db
          .from('post_modules as pm')
          .join('module_instances as mi', 'pm.module_id', 'mi.id')
          .where('pm.post_id', postId)
          .orderBy('pm.order_index', 'asc')
          .orderBy('pm.created_at', 'asc')
          .orderBy('pm.id', 'asc')
          .select(
            'pm.id as postModuleId',
            'pm.order_index as orderIndex',
            'pm.locked',
            'pm.overrides',
            'pm.review_overrides as reviewOverrides',
            'pm.ai_review_overrides as aiReviewOverrides',
            'pm.review_added as reviewAdded',
            'pm.review_deleted as reviewDeleted',
            'pm.ai_review_added as aiReviewAdded',
            'pm.ai_review_deleted as aiReviewDeleted',
            'mi.id as moduleInstanceId',
            'mi.type',
            'mi.scope',
            'mi.props',
            'mi.review_props as reviewProps',
            'mi.ai_review_props as aiReviewProps',
            'mi.global_slug as globalSlug',
            'mi.global_label as globalLabel'
          )

        const customFields = await db
          .from('post_custom_field_values')
          .where('post_id', postId)
          .select('field_slug as slug', 'value')

        return jsonResult({
          data: {
            post: {
              id: post.id,
              type: post.type,
              locale: post.locale,
              slug: post.slug,
              title: post.title,
              excerpt: post.excerpt ?? null,
              status: post.status,
              parentId: post.parent_id ?? null,
              orderIndex: post.order_index ?? 0,
              metaTitle: post.meta_title ?? null,
              metaDescription: post.meta_description ?? null,
              canonicalUrl: post.canonical_url ?? null,
              robotsJson: post.robots_json ?? null,
              jsonldOverrides: post.jsonld_overrides ?? null,
              featuredMediaId: post.featured_media_id ?? null,
              reviewDraft: post.review_draft ?? null,
              aiReviewDraft: post.ai_review_draft ?? null,
            },
            customFields: (customFields || []).map((r: any) => ({ slug: r.slug, value: r.value })),
            modules: modules.map((m: any) => ({
              id: m.postmoduleid ?? m.postModuleId,
              postModuleId: m.postmoduleid ?? m.postModuleId,
              moduleInstanceId: m.moduleinstanceid ?? m.moduleInstanceId,
              type: m.type,
              scope: m.scope === 'post' ? 'local' : m.scope,
              props: m.props || {},
              reviewProps: m.reviewProps || null,
              aiReviewProps: m.aiReviewProps || null,
              overrides: m.overrides || null,
              reviewOverrides: m.reviewOverrides || null,
              aiReviewOverrides: m.aiReviewOverrides || null,
              reviewAdded: !!m.reviewAdded,
              reviewDeleted: !!m.reviewDeleted,
              aiReviewAdded: !!m.aiReviewAdded,
              aiReviewDeleted: !!m.aiReviewDeleted,
              locked: !!m.locked,
              orderIndex: Number(m.orderIndex ?? 0),
              globalSlug: m.globalSlug || null,
              globalLabel: m.globalLabel || null,
            })),
          },
        })
      } catch (e: any) {
        return errorResult('Failed to load post context', { message: e?.message })
      }
    }
  )

  server.tool(
    'get_post_manifest',
    'A "Super-Getter" that returns the Post record + all associated Modules + all Overrides + all Custom Fields in one JSON tree, flattened for easy understanding.',
    {
      postId: z.string().min(1),
      mode: z.enum(['source', 'review', 'ai-review']).optional().default('ai-review'),
    },
    async ({ postId, mode }) => {
      try {
        const context = await PostSerializerService.serialize(postId, mode as any)
        return jsonResult({ data: context })
      } catch (e: any) {
        return errorResult('Failed to get post manifest', { message: e?.message })
      }
    }
  )

  server.tool(
    'create_post_ai_review',
    'Create a new post and stage its first content into ai_review_draft. Use this tool for articles, blog posts, and pages. High-quality content is expected.',
    {
      type: z.string().min(1).describe('Post type slug (e.g. "blog", "page")'),
      locale: z.string().min(1).default('en'),
      slug: z.string().min(1).describe('URL-friendly slug'),
      title: z.string().min(1).describe('Professional title'),
      excerpt: z.string().optional().describe('Short summary for listing pages'),
      contentMarkdown: z
        .string()
        .optional()
        .describe(
          'Provide high-quality, substantial markdown for the body content. Use at least 3-4 paragraphs for prose modules.'
        ),
      moduleGroupId: z
        .string()
        .optional()
        .describe(
          'Optional module group id to seed modules from.'
        ),
      moduleGroupName: z
        .string()
        .optional()
        .describe(
          'Optional module group name to seed modules from.'
        ),
      moduleEdits: z
        .array(moduleEditSchema)
        .optional()
        .describe(
          'Optional module edits to apply immediately after creation.'
        ),
      agentId: z.string().optional(),
      agentName: z.string().optional(),
    },
    async ({
      type,
      locale,
      slug,
      title,
      excerpt,
      contentMarkdown,
      moduleGroupId,
      moduleGroupName,
      moduleEdits,
      agentId,
      agentName,
    }) => {
      const actorUserId = await resolveActorUserId({ agentId })
      if (!actorUserId) {
        return errorResult(
          'Missing MCP_SYSTEM_USER_ID (and no AI system user found). Seed users or set MCP_SYSTEM_USER_ID to a valid users.id.',
          {
            hint: 'Run `node ace db:seed --files database/seeders/user_seeder.ts` (creates a system ai_agent user) then set MCP_SYSTEM_USER_ID=<that id>.',
          }
        )
      }
      const savedBy = resolveAgentLabel({ agentId, agentName })
      try {
        const resolvedModuleGroupId = await (async () => {
          const name = String(moduleGroupName || '').trim()
          if (name) {
            const row = await db.from('module_groups').where({ post_type: type, name }).first()
            if (row) return String((row as any).id)
          }
          const id = String(moduleGroupId || '').trim()
          return id || null
        })()

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

        if (Array.isArray(moduleEdits) && moduleEdits.length > 0) {
          editsToApply.push(...moduleEdits)
        }

        // Convenience: if contentMarkdown is provided, ensure at least one seeded `prose` module
        // receives rich text content (unless the caller already provided a prose content edit).
        const mdTop = String(contentMarkdown || '').trim()
        if (mdTop) {
          const hasProseContentEdit = (() => {
            for (const edit of editsToApply) {
              const hasContentMarkdown =
                String((edit as any)?.contentMarkdown || '').trim().length > 0
              const hasContentOverride =
                !!(edit as any)?.overrides &&
                typeof (edit as any).overrides === 'object' &&
                (edit as any).overrides.content !== undefined

              if (!hasContentMarkdown && !hasContentOverride) continue

              const explicitId = String((edit as any)?.postModuleId || '').trim()
              if (explicitId) {
                const m = (seededModules as any[]).find(
                  (x: any) => String(x.postModuleId) === explicitId
                )
                if (String(m?.type || '') === 'prose') return true
                continue
              }

              const t = String((edit as any)?.type || '').trim()
              if (t === 'prose') return true
            }
            return false
          })()

          if (!hasProseContentEdit) {
            // Prefer explicitly targeting the first seeded prose module to avoid ambiguity.
            const firstProse = (seededModules as any[]).find((m: any) => String(m.type) === 'prose')
            if (firstProse) {
              editsToApply.push({
                postModuleId: String((firstProse as any).postModuleId),
                contentMarkdown: mdTop,
              })
            } else {
              appliedEdits.push({
                ok: false,
                error:
                  'contentMarkdown was provided but no seeded prose module exists to populate.',
              })
            }
          }

          // Also auto-populate other common template modules when a post is newly created from a module group:
          // - hero: title/subtitle from post title/excerpt (or markdown h1/first paragraph)
          // - prose-with-media: title/body from markdown h2 + first paragraph
          //
          // These are best-effort convenience fills; callers can override by providing explicit moduleEdits.
          const mdH1 = extractMarkdownH1(mdTop)
          const mdParas = extractMarkdownParagraphs(mdTop)
          const mdH2s = extractMarkdownH2s(mdTop)

          const alreadyEditsModule = (postModuleId: string) =>
            editsToApply.some((e) => String((e as any)?.postModuleId || '').trim() === postModuleId)

          const seedContext = {
            title: title || '',
            excerpt: excerpt || '',
            h1: mdH1,
            h2s: mdH2s,
            paras: mdParas,
          }

          for (const mapping of mcpLayoutConfig.seedMapping) {
            const firstOfType = (seededModules as any[]).find(
              (m: any) => String(m.type) === mapping.type
            )
            if (firstOfType && !alreadyEditsModule(String(firstOfType.postModuleId))) {
              const overrides = (mapping as any).map(seedContext)
              if (Object.values(overrides).some((v) => !!v)) {
                editsToApply.push({
                  postModuleId: String(firstOfType.postModuleId),
                  overrides,
                })
              }
            }
          }
        }

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
                // If ambiguous, pick the first (lowest orderIndex due to query ordering)
                targetId = String(candidates[0].postModuleId)
              }

              const targetMeta = (seededModules as any[]).find(
                (m: any) => String(m.postModuleId) === targetId
              )
              const isProse = String(targetMeta?.type || (edit as any)?.type || '') === 'prose'

              let overrides =
                (edit as any)?.overrides === undefined
                  ? undefined
                  : ((edit as any)?.overrides as any)

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

        return jsonResult({
          data: { id: post.id, type: post.type, locale: post.locale, slug: post.slug },
          seededModules: (seededModules as any[]).map((m: any) => ({
            postModuleId: m.postModuleId,
            moduleInstanceId: m.moduleInstanceId,
            type: m.type,
            scope: m.scope === 'post' ? 'local' : m.scope,
            orderIndex: Number(m.orderIndex ?? 0),
            globalSlug: m.globalSlug ?? null,
            locked: !!m.locked,
            aiReviewAdded: !!m.aiReviewAdded,
          })),
          appliedModuleEdits: appliedEdits,
        })
      } catch (e: any) {
        return errorResult('Failed to create post', { message: e?.message })
      }
    }
  )

  server.tool(
    'save_post_ai_review',
    'Save AI edits for a post into ai_review_draft (base = review_draft if present). Does NOT modify approved/live post fields.',
    {
      postId: z.string().min(1),
      patch: z
        .record(z.any())
        .describe(
          'Partial post fields: slug/title/excerpt/metaTitle/metaDescription/canonicalUrl/robotsJson/jsonldOverrides/featuredMediaId/customFields/...'
        ),
      agentId: z.string().optional(),
      agentName: z.string().optional(),
    },
    async ({ postId, patch, agentId, agentName }) => {
      const savedBy = resolveAgentLabel({ agentId, agentName })
      try {
        const post = await db.from('posts').where('id', postId).whereNull('deleted_at').first()
        if (!post) return errorResult('Post not found', { postId })

        // Base = review_draft if present, otherwise approved fields snapshot
        const baseDraft = (post.review_draft as any) || {
          slug: post.slug,
          title: post.title,
          status: post.status,
          excerpt: post.excerpt ?? null,
          parentId: post.parent_id ?? null,
          orderIndex: post.order_index ?? 0,
          metaTitle: post.meta_title ?? null,
          metaDescription: post.meta_description ?? null,
          canonicalUrl: post.canonical_url ?? null,
          robotsJson: post.robots_json ?? null,
          jsonldOverrides: post.jsonld_overrides ?? null,
          featuredMediaId: post.featured_media_id ?? null,
        }

        // Carry forward customFields from base draft or current DB values
        let customFields = Array.isArray(baseDraft.customFields) ? baseDraft.customFields : null
        if (!customFields) {
          const cfRows = await db
            .from('post_custom_field_values')
            .where('post_id', postId)
            .select('field_slug as slug', 'value')
          customFields = (cfRows || []).map((r: any) => ({ slug: r.slug, value: r.value }))
        }

        const merged = {
          ...baseDraft,
          ...patch,
          customFields: patch?.customFields !== undefined ? patch.customFields : customFields,
          savedAt: new Date().toISOString(),
          savedBy,
        }

        await db
          .from('posts')
          .where('id', postId)
          .update({ ai_review_draft: merged, updated_at: new Date() } as any)
        await RevisionService.record({ postId, mode: 'ai-review', snapshot: merged, userId: null })

        return jsonResult({ message: 'Saved for AI review', data: { postId } })
      } catch (e: any) {
        return errorResult('Failed to save AI review draft', { message: e?.message })
      }
    }
  )

  server.tool(
    'submit_ai_review_to_review',
    'Move ai_review_draft + ai-review module changes into Review (review_draft + review module staging). Does NOT publish.',
    {
      postId: z.string().min(1),
    },
    async ({ postId }) => {
      try {
        const post = await db.from('posts').where('id', postId).whereNull('deleted_at').first()
        if (!post) return errorResult('Post not found', { postId })
        const ard = post.ai_review_draft
        if (!ard) return errorResult('No AI review draft to submit', { postId })

        // Promote AI-review module changes to review staging (same as controller logic)
        await db
          .from('module_instances')
          .where('scope', 'post')
          .andWhereIn('id', db.from('post_modules').where('post_id', postId).select('module_id'))
          .update({
            review_props: db.raw('COALESCE(ai_review_props, review_props, props)'),
            ai_review_props: null,
            updated_at: new Date(),
          })

        await db
          .from('post_modules')
          .where('post_id', postId)
          .update({
            review_overrides: db.raw('COALESCE(ai_review_overrides, review_overrides, overrides)'),
            ai_review_overrides: null,
            updated_at: new Date(),
          })

        await db
          .from('post_modules')
          .where('post_id', postId)
          .andWhere('ai_review_added', true)
          .update({ review_added: true, ai_review_added: false, updated_at: new Date() })

        await db
          .from('post_modules')
          .where('post_id', postId)
          .andWhere('ai_review_deleted', true)
          .update({ review_deleted: true, ai_review_deleted: false, updated_at: new Date() })

        const reviewPayload = {
          ...(post.review_draft || {}),
          ...(ard as any),
          savedAt: new Date().toISOString(),
        }

        await db
          .from('posts')
          .where('id', postId)
          .update({
            review_draft: reviewPayload,
            ai_review_draft: null,
            updated_at: new Date(),
          } as any)

        await RevisionService.record({
          postId,
          mode: 'review',
          snapshot: reviewPayload,
          userId: null,
        })

        return jsonResult({ message: 'AI review submitted to Review', data: { postId } })
      } catch (e: any) {
        return errorResult('Failed to submit AI review', { message: e?.message })
      }
    }
  )

  server.tool(
    'add_module_to_post_ai_review',
    'Add a module to a post as an AI Review change (staged; does not touch approved modules).',
    {
      postId: z.string().min(1),
      moduleType: z.string().min(1),
      scope: z.enum(['local', 'global']).default('local'),
      props: z.record(z.any()).optional(),
      globalSlug: z.string().optional(),
      orderIndex: z.number().int().optional(),
      locked: z.boolean().optional(),
    },
    async ({ postId, moduleType, scope, props, globalSlug, orderIndex, locked }) => {
      try {
        const result = await AddModuleToPost.handle({
          postId,
          moduleType,
          scope,
          props: props || {},
          globalSlug: globalSlug ?? null,
          orderIndex,
          locked: !!locked,
          mode: 'ai-review',
        })
        return jsonResult({
          data: {
            postModuleId: result.postModule.id,
            moduleInstanceId: result.moduleInstanceId,
            orderIndex: result.postModule.order_index,
          },
        })
      } catch (e: any) {
        return errorResult('Failed to add module (AI review)', { message: e?.message })
      }
    }
  )

  const processObject = (obj: any, currentSchema: any[]) => {
    if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return

    for (const key of Object.keys(obj)) {
      const field = currentSchema.find((f: any) => f.slug === key)
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

      // Media ID flattening
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

  server.tool(
    'update_post_module_ai_review',
    'Update a post module\'s content. For global modules, this only adds overrides for the current post and does NOT modify the global component for other posts.',
    {
      postModuleId: z.string().min(1).describe('The post module instance ID'),
      overrides: z.record(z.any()).nullable().optional().describe('Content updates (title, body, image, etc.)'),
      contentMarkdown: z.string().optional().describe('Convenience for prose modules: provide markdown and it will be converted to Lexical JSON and applied to the main content field.'),
      locked: z.boolean().optional(),
      orderIndex: z.number().int().optional(),
      mode: z.enum(['source', 'review', 'ai-review']).optional().default('ai-review').describe('Target mode: source (live), review, or ai-review'),
    },
    async ({ postModuleId, overrides, contentMarkdown, locked, orderIndex, mode }) => {
      try {
        // Safety: Prevent modification of global properties that shouldn't be touched by AI
        if (overrides) {
          const restrictedFields = ['globalSlug', 'global_slug', 'scope', 'type']
          for (const field of restrictedFields) {
            if (field in overrides) {
              return errorResult(`Cannot modify '${field}' via update_post_module_ai_review.`, {
                postModuleId,
                hint: 'Restricted field modification attempted.',
              })
            }
          }
        }

        // Locked modules are structural constraints from module groups and should not be changed by agents.
        // If an agent could unlock a module, it could then remove it, defeating the "locked modules must stay" contract.
        if (locked !== undefined) {
          return errorResult('Cannot change locked state via MCP (AI Review)', {
            postModuleId,
            hint: 'Locked modules must remain locked. Populate content via `overrides` (or use `contentMarkdown` for prose).',
          })
        }

        let finalOverrides = overrides === undefined ? undefined : overrides

        const md = String(contentMarkdown || '').trim()
        if (md) {
          // Identify the module type to determine the correct field for markdown
          const row = await db
            .from('post_modules as pm')
            .join('module_instances as mi', 'pm.module_id', 'mi.id')
            .where('pm.id', postModuleId)
            .select('mi.type')
            .first()

          if (!row) return errorResult('Post module not found', { postModuleId })

          const schema = moduleRegistry.getSchema(String(row.type))
          const firstRichText = schema.fieldSchema.find((f: any) => f.type === 'richtext')
          const firstTextArea = schema.fieldSchema.find((f: any) => f.type === 'textarea')

          if (firstRichText) {
            const lexical = markdownToLexical(md, { skipFirstH1: false })
            finalOverrides = {
              ...(finalOverrides || {}),
              [firstRichText.slug]: lexical,
            }
          } else if (firstTextArea) {
            finalOverrides = {
              ...(finalOverrides || {}),
              [firstTextArea.slug]: md,
            }
          } else {
            // Fallback for known types if schema doesn't clearly identify a text field
            const targetField = String(row.type).toLowerCase().includes('prose') ? (String(row.type) === 'prose' ? 'content' : 'body') : 'body'
            const lexical = markdownToLexical(md, { skipFirstH1: false })
            finalOverrides = {
              ...(finalOverrides || {}),
              [targetField]: lexical,
            }
          }
        }

        // Automatic conversion for ANY overrides (handles nested repeaters)
        if (finalOverrides && typeof finalOverrides === 'object') {
          const row = await db
            .from('post_modules as pm')
            .join('module_instances as mi', 'pm.module_id', 'mi.id')
            .where('pm.id', postModuleId)
            .select('mi.type')
            .first()

          if (row && moduleRegistry.has(String(row.type))) {
            const schema = moduleRegistry.getSchema(String(row.type))
            processObject(finalOverrides, schema.fieldSchema)
          }
        }

        const updated = await UpdatePostModule.handle({
          postModuleId,
          overrides: finalOverrides,
          orderIndex,
          mode: mode as any,
        })
        return jsonResult({ data: { id: updated.id, updatedAt: updated.updatedAt } })
      } catch (e: any) {
        return errorResult('Failed to update post module (AI review)', { message: e?.message })
      }
    }
  )

  server.tool(
    'remove_post_module_ai_review',
    'Stage removal of a module in AI Review (sets ai_review_deleted=true).',
    {
      postModuleId: z.string().min(1),
    },
    async ({ postModuleId }) => {
      try {
        const row = await db.from('post_modules').where('id', postModuleId).first()
        if (!row) return errorResult('Post module not found', { postModuleId })
        if ((row as any).locked)
          return errorResult('Cannot remove a locked module', { postModuleId })
        await db
          .from('post_modules')
          .where('id', postModuleId)
          .update({ ai_review_deleted: true, updated_at: new Date() } as any)
        return jsonResult({
          message: 'Module staged for removal (AI review)',
          data: { postModuleId },
        })
      } catch (e: any) {
        return errorResult('Failed to stage module removal', { message: e?.message })
      }
    }
  )

  // ---- Revisions (read-only; useful for editor-parity context) ----
  server.tool(
    'list_post_revisions',
    'List recent revisions for a post (approved/review/ai-review).',
    {
      postId: z.string().min(1),
      limit: z.number().int().min(1).max(50).optional().default(20),
    },
    async ({ postId, limit }) => {
      try {
        const rows = await db
          .from('post_revisions')
          .leftJoin('users', 'post_revisions.user_id', 'users.id')
          .where('post_revisions.post_id', postId)
          .orderBy('post_revisions.created_at', 'desc')
          .limit(limit ?? 20)
          .select(
            'post_revisions.id',
            'post_revisions.mode',
            'post_revisions.created_at as createdAt',
            'post_revisions.user_id as userId',
            'users.email as userEmail'
          )

        return jsonResult({
          data: rows.map((r: any) => ({
            id: r.id,
            mode: r.mode,
            createdAt: r.createdat || r.createdAt,
            user: r.useremail ? { email: r.useremail, id: r.userid } : null,
          })),
        })
      } catch (e: any) {
        return errorResult('Failed to list revisions', { message: e?.message })
      }
    }
  )

  server.tool(
    'get_post_revision',
    'Get a specific revision snapshot for a post.',
    {
      postId: z.string().min(1),
      revisionId: z.string().min(1),
    },
    async ({ postId, revisionId }) => {
      try {
        const rev = await db
          .from('post_revisions')
          .leftJoin('users', 'post_revisions.user_id', 'users.id')
          .where('post_revisions.id', revisionId)
          .andWhere('post_revisions.post_id', postId)
          .select('post_revisions.*', 'users.email as userEmail')
          .first()
        if (!rev) return errorResult('Revision not found', { postId, revisionId })
        return jsonResult({
          data: {
            id: rev.id,
            mode: rev.mode,
            snapshot: rev.snapshot,
            createdAt: rev.created_at,
            user: rev.userEmail ? { email: rev.userEmail, id: rev.user_id } : null,
          },
        })
      } catch (e: any) {
        return errorResult('Failed to load revision', { message: e?.message })
      }
    }
  )

  // ---- Post export (read-only) ----
  server.tool(
    'export_post_canonical_json',
    'Export a post (approved/live) as canonical JSON (versioned).',
    {
      postId: z.string().min(1),
    },
    async ({ postId }) => {
      try {
        const data = await PostSerializerService.serialize(postId)
        return jsonResult({ data })
      } catch (e: any) {
        return errorResult('Failed to export canonical JSON', { message: e?.message })
      }
    }
  )

  // ---- Translations ----
  server.tool(
    'list_post_translations',
    'List all translations for a post (including original).',
    {
      postId: z.string().min(1),
    },
    async ({ postId }) => {
      try {
        const post = await db.from('posts').where('id', postId).whereNull('deleted_at').first()
        if (!post) return errorResult('Post not found', { postId })
        const baseId = post.translation_of_id || post.id
        const rows = await db
          .from('posts')
          .whereNull('deleted_at')
          .andWhere((q) => q.where('translation_of_id', baseId).orWhere('id', baseId))
          .select(
            'id',
            'locale',
            'slug',
            'title',
            'status',
            'translation_of_id',
            'created_at',
            'updated_at'
          )
          .orderBy('locale', 'asc')

        return jsonResult({
          data: rows.map((t: any) => ({
            id: t.id,
            locale: t.locale,
            slug: t.slug,
            title: t.title,
            status: t.status,
            isOriginal: !t.translation_of_id,
            translationOfId: t.translation_of_id || null,
            createdAt: t.created_at,
            updatedAt: t.updated_at,
          })),
        })
      } catch (e: any) {
        return errorResult('Failed to list translations', { message: e?.message })
      }
    }
  )

  server.tool(
    'create_translation_ai_review',
    'Create a translation post for a base post and initialize AI Review content (optionally cloning module structure).',
    {
      postId: z.string().min(1).describe('Base post id (or any translation id in the family)'),
      locale: z.string().min(1).describe('Target locale (e.g. "es")'),
      sourceMode: z
        .enum(['review', 'approved'])
        .optional()
        .default('review')
        .describe('Prefer review draft/module staging when available'),
      cloneModules: z.boolean().optional().default(true),
      agentId: z.string().optional(),
      agentName: z.string().optional(),
      slug: z.string().optional().describe('Optional translation slug override'),
      title: z.string().optional().describe('Optional translation title override'),
      metaTitle: z.string().nullable().optional(),
      metaDescription: z.string().nullable().optional(),
    },
    async ({
      postId,
      locale,
      sourceMode,
      cloneModules,
      agentId,
      agentName,
      slug,
      title,
      metaTitle,
      metaDescription,
    }) => {
      try {
        const savedBy = resolveAgentLabel({ agentId, agentName })

        // Create the translation row (inherits type/module group and sets status=draft)
        const translation = await CreateTranslation.handle({
          postId,
          locale,
          slug,
          title,
          metaTitle: metaTitle ?? null,
          metaDescription: metaDescription ?? null,
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
          // start from base payload, but ensure the translation slug/title are present
          ...basePayload,
          slug: (translation as any).slug,
          title: (translation as any).title,
          status: (translation as any).status,
          savedAt: new Date().toISOString(),
          savedBy,
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
        await RevisionService.record({
          postId: (translation as any).id,
          mode: 'ai-review' as any,
          snapshot: aiReviewDraft,
          userId: null,
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
              mode: 'ai-review',
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
                mode: 'ai-review',
              })
            }
          }

          return jsonResult({
            data: {
              translationId: (translation as any).id,
              locale: (translation as any).locale,
              slug: (translation as any).slug,
              title: (translation as any).title,
              clonedModules: map,
            },
          })
        }

        return jsonResult({
          data: {
            translationId: (translation as any).id,
            locale: (translation as any).locale,
            slug: (translation as any).slug,
            title: (translation as any).title,
          },
        })
      } catch (e: any) {
        return errorResult('Failed to create translation (AI review)', { message: e?.message })
      }
    }
  )

  server.tool(
    'create_translations_ai_review_bulk',
    'Create translation posts for multiple locales and initialize AI Review drafts (optionally cloning module structure).',
    {
      postId: z.string().min(1),
      locales: z.array(z.string().min(1)).min(1),
      sourceMode: z.enum(['review', 'approved']).optional().default('review'),
      cloneModules: z.boolean().optional().default(true),
      agentId: z.string().optional(),
      agentName: z.string().optional(),
    },
    async ({ postId, locales, sourceMode, cloneModules, agentId, agentName }) => {
      const uniq: string[] = Array.from(
        new Set((locales as string[]).map((l: string) => String(l).trim()).filter(Boolean))
      )
      const results: Array<{ locale: string; ok: boolean; data?: any; error?: any }> = []
      for (const locale of uniq) {
        try {
          // Reuse the same internal logic by calling the tool handler implementation directly.
          // (We duplicate minimal logic here to keep behavior stable.)
          const savedBy = resolveAgentLabel({ agentId, agentName })

          const translation = await CreateTranslation.handle({
            postId,
            locale,
          })

          const base = await db.from('posts').where('id', postId).whereNull('deleted_at').first()
          const baseId = base?.translation_of_id || base?.id || postId
          const source = await db.from('posts').where('id', baseId).whereNull('deleted_at').first()
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
            savedAt: new Date().toISOString(),
            savedBy,
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
          await RevisionService.record({
            postId: (translation as any).id,
            mode: 'ai-review' as any,
            snapshot: aiReviewDraft,
            userId: null,
          })

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
                mode: 'ai-review',
              })

              if (isGlobal && effectiveOverrides) {
                await UpdatePostModule.handle({
                  postModuleId: added.postModule.id,
                  overrides: effectiveOverrides,
                  mode: 'ai-review',
                })
              }
            }
          }

          results.push({
            locale,
            ok: true,
            data: { translationId: (translation as any).id, slug: (translation as any).slug },
          })
        } catch (e: any) {
          results.push({ locale, ok: false, error: { message: e?.message || String(e) } })
        }
      }
      return jsonResult({ data: results })
    }
  )

  // ---- Agents (discovery) ----
  server.tool(
    'list_agents',
    'List enabled agents (optionally filtered by scope and fieldKey/formSlug).',
    {
      scope: z
        .string()
        .optional()
        .describe('Optional scope filter (e.g. dropdown, field, post.publish, form.submit)'),
      formSlug: z.string().optional().describe('Optional form slug filter when scope=form.submit'),
      fieldKey: z
        .string()
        .optional()
        .describe('Optional field key filter when scope=field (e.g. module.hero.title)'),
    },
    async ({ scope, formSlug, fieldKey }) => {
      try {
        const list = scope
          ? agentRegistry.listByScope(scope as any, formSlug, fieldKey)
          : agentRegistry.listEnabled()
        return jsonResult({
          data: list.map((a) => ({
            id: a.id,
            name: a.name,
            description: a.description || '',
            type: (a as any).type,
            openEndedContext: a.openEndedContext?.enabled
              ? {
                enabled: true,
                label: a.openEndedContext.label,
                placeholder: a.openEndedContext.placeholder,
                maxChars: a.openEndedContext.maxChars,
              }
              : { enabled: false },
            scopes: (a.scopes || []).map((s: any) => ({
              scope: s.scope,
              enabled: s.enabled !== false,
              order: s.order ?? 100,
              formSlugs: s.formSlugs || undefined,
              fieldKeys: s.fieldKeys || undefined,
            })),
          })),
        })
      } catch (e: any) {
        return errorResult('Failed to list agents', { message: e?.message })
      }
    }
  )

  // ---- Field-scoped agent execution (per-field AI buttons) ----
  server.tool(
    'run_field_agent',
    'Run an external agent for a single field (scope=field). Returns the agent response and can optionally stage changes into AI Review.',
    {
      agentId: z.string().min(1).describe('Agent id (must be enabled for scope=field)'),
      postId: z.string().min(1).describe('Post id to provide context for'),
      fieldKey: z
        .string()
        .min(1)
        .describe(
          'Field key (e.g. post.title, post.metaTitle, module.hero.title, module.prose.content)'
        ),
      /**
       * If omitted, we attempt to derive it from the post context based on fieldKey.
       * For module fields, provide postModuleId or moduleInstanceId for disambiguation.
       */
      currentValue: z.any().optional(),
      // For module.* fieldKeys, disambiguate which module instance is being edited
      postModuleId: z.string().optional(),
      moduleInstanceId: z.string().optional(),
      // When true, apply a best-effort staging of returned suggestions into AI review draft.
      applyToAiReview: z.boolean().optional().default(false),
      // Optional extra context for the agent (e.g. image generation parameters)
      context: z.record(z.any()).optional(),
      openEndedContext: z
        .string()
        .optional()
        .describe('Optional freeform instructions from a human (only if the agent supports it)'),
      // Agent attribution for savedBy when applyToAiReview is true
      agentName: z.string().optional(),
    },
    async ({
      agentId,
      postId,
      fieldKey,
      currentValue,
      postModuleId,
      moduleInstanceId,
      applyToAiReview,
      context,
      openEndedContext,
      agentName,
    }) => {
      // Validate agent availability
      const agent = agentRegistry.get(agentId)
      if (!agent) return errorResult('Agent not found', { agentId })
      if (!agentRegistry.isAvailableInScope(agentId, 'field')) {
        return errorResult('Agent not available for field scope', { agentId })
      }

      // Server-side enforcement: only allow openEndedContext if the agent explicitly opts in
      if (openEndedContext && String(openEndedContext).trim()) {
        const enabled = agent.openEndedContext?.enabled === true
        if (!enabled) {
          return errorResult('This agent does not accept open-ended context', { agentId })
        }
        const max = agent.openEndedContext?.maxChars
        if (
          typeof max === 'number' &&
          Number.isFinite(max) &&
          max > 0 &&
          String(openEndedContext).trim().length > max
        ) {
          return errorResult('Open-ended context exceeds maxChars', { agentId, maxChars: max })
        }
      }

      // Load post context (includes review/ai-review drafts and modules)
      const post = await db.from('posts').where('id', postId).whereNull('deleted_at').first()
      if (!post) return errorResult('Post not found', { postId })

      // Base = review draft if present, otherwise approved fields
      const baseDraft = (post.review_draft as any) || {
        slug: post.slug,
        title: post.title,
        status: post.status,
        excerpt: post.excerpt ?? null,
        parentId: post.parent_id ?? null,
        orderIndex: post.order_index ?? 0,
        metaTitle: post.meta_title ?? null,
        metaDescription: post.meta_description ?? null,
        canonicalUrl: post.canonical_url ?? null,
        robotsJson: post.robots_json ?? null,
        jsonldOverrides: post.jsonld_overrides ?? null,
        featuredMediaId: post.featured_media_id ?? null,
        taxonomyTermIds: undefined,
      }

      // Get module rows when needed
      let moduleRow: any | null = null
      if (fieldKey.startsWith('module.')) {
        const rows = await db
          .from('post_modules as pm')
          .join('module_instances as mi', 'pm.module_id', 'mi.id')
          .where('pm.post_id', postId)
          .select(
            'pm.id as postModuleId',
            'pm.overrides',
            'pm.review_overrides as reviewOverrides',
            'pm.ai_review_overrides as aiReviewOverrides',
            'mi.id as moduleInstanceId',
            'mi.type',
            'mi.scope',
            'mi.props',
            'mi.review_props as reviewProps',
            'mi.ai_review_props as aiReviewProps',
            'mi.global_slug as globalSlug'
          )
        const candidates = rows.filter((r: any) => {
          if (postModuleId && String(r.postModuleId) === String(postModuleId)) return true
          if (moduleInstanceId && String(r.moduleInstanceId) === String(moduleInstanceId))
            return true
          return false
        })
        if (candidates.length === 1) moduleRow = candidates[0]
        if (!moduleRow && (postModuleId || moduleInstanceId)) {
          return errorResult('Module not found for post/identifier', {
            postId,
            postModuleId,
            moduleInstanceId,
          })
        }
        if (!moduleRow && rows.length === 1) moduleRow = rows[0]
        if (!moduleRow) {
          return errorResult('Ambiguous module field; provide postModuleId or moduleInstanceId', {
            postId,
            fieldKey,
            modulesCount: rows.length,
          })
        }
      }

      const effectiveCurrentValue = (() => {
        if (currentValue !== undefined) return currentValue
        if (fieldKey.startsWith('post.')) {
          const k = fieldKey.slice('post.'.length)
          return (baseDraft as any)[k]
        }
        if (fieldKey.startsWith('module.') && moduleRow) {
          // Prefer ai-review props if present, then review, then base props
          const parts = fieldKey.split('.')
          const propKey = parts.slice(2).join('.') // module.<type>.<propPath>
          const props = moduleRow.aiReviewProps || moduleRow.reviewProps || moduleRow.props || {}
          return propKey ? props[propKey] : props
        }
        return undefined
      })()

      // Execute internal agent
      let agentResponse: any = null
      try {
        // Build execution context
        const executionContext: any = {
          agent,
          scope: 'field',
          userId: await resolveSystemUserId(),
          data: {
            postId,
            fieldKey,
            currentValue: effectiveCurrentValue,
            postModuleId,
            moduleInstanceId,
            context,
          },
        }

        // We need to import the agent executor dynamically
        const { default: agentExecutor } = await import('#services/agent_executor')

        // Create a payload for the agent
        const canonical = await PostSerializerService.serialize(postId, 'source')
        const payload = {
          post: canonical,
          field: {
            key: fieldKey,
            currentValue: effectiveCurrentValue,
          },
          context: {
            ...(context || {}),
            ...(openEndedContext ? { openEndedContext } : {}),
          },
        }

        const result = await agentExecutor.execute(
          agent as any,
          executionContext,
          payload as any
        )

        if (!result.success) {
          return errorResult('Agent execution failed', { message: result.error?.message })
        }

        agentResponse = result.data
      } catch (e: any) {
        return errorResult('Agent execution error', { message: e?.message || String(e) })
      }

      // Optionally stage response into AI review draft (best-effort, by convention)
      let staged: any = null
      if (applyToAiReview) {
        const savedBy = resolveAgentLabel({ agentId, agentName })

        // Convention: agent can return { value } for a field, OR { post: {..} } patch, OR { module: { overrides|props } }
        const value = agentResponse?.value
        const postPatch = agentResponse?.post
        const modulePatch = agentResponse?.module

        if (fieldKey.startsWith('post.') && (value !== undefined || postPatch)) {
          const k = fieldKey.slice('post.'.length)
          const merged = {
            ...(post.ai_review_draft || baseDraft),
            ...(postPatch || {}),
            ...(value !== undefined ? { [k]: value } : {}),
            savedAt: new Date().toISOString(),
            savedBy,
          }
          await db
            .from('posts')
            .where('id', postId)
            .update({ ai_review_draft: merged, updated_at: new Date() } as any)
          await RevisionService.record({
            postId,
            mode: 'ai-review',
            snapshot: merged,
            userId: null,
          })
          staged = { type: 'post', postId }
        } else if (
          fieldKey.startsWith('module.') &&
          moduleRow &&
          (value !== undefined || modulePatch)
        ) {
          // For module props, stage via update_post_module_ai_review using overrides merged into props
          const parts = fieldKey.split('.')
          const propKey = parts.slice(2).join('.')
          const patchObj =
            modulePatch?.overrides || modulePatch?.props
              ? modulePatch.overrides || modulePatch.props
              : propKey
                ? { [propKey]: value }
                : value

          await UpdatePostModule.handle({
            postModuleId: String(moduleRow.postModuleId),
            overrides: patchObj ?? null,
            mode: 'ai-review',
          })
          staged = { type: 'module', postModuleId: String(moduleRow.postModuleId) }
        }
      }

      return jsonResult({ data: { agentId, fieldKey, response: agentResponse, staged } })
    }
  )

  // ---- Named agent execution (run a named agent on a post or globally) ----
  server.tool(
    'run_agent',
    'Run a named internal agent on a post or globally. This is the recommended way to trigger EOS agents from external systems like n8n.',
    {
      agentId: z.string().min(1).describe('Agent id to run (e.g. "general_assistant", "translator")'),
      postId: z.string().optional().describe('Optional post id to provide context for'),
      scope: z
        .enum(['dropdown', 'global', 'field', 'posts.bulk'])
        .optional()
        .default('dropdown')
        .describe('The scope in which to run the agent'),
      context: z.record(z.any()).optional().describe('Optional extra context for the agent'),
      openEndedContext: z
        .string()
        .optional()
        .describe('Optional freeform instructions from a human (only if the agent supports it)'),
    },
    async ({ agentId, postId, scope, context, openEndedContext }) => {
      try {
        const agent = agentRegistry.get(agentId)
        if (!agent) return errorResult('Agent not found', { agentId })

        // 1. Verify scope availability
        const formSlug = context?.formSlug
        if (!agentRegistry.isAvailableInScope(agentId, scope as any, formSlug)) {
          return errorResult(`Agent not available for ${scope} scope`, { agentId, scope })
        }

        // 2. Resolve system user for attribution
        const actorUserId = await resolveActorUserId({ agentId })

        // 3. Import necessary services
        const { default: agentExecutor } = await import('#services/agent_executor')

        // 4. Build execution context & payload
        const executionContext: any = {
          agent,
          scope,
          userId: actorUserId,
          data: {
            postId,
            ...(context || {}),
          },
        }

        let payload: any = {
          context: {
            ...(context || {}),
            ...(openEndedContext ? { openEndedContext } : {}),
          },
        }

        if (postId) {
          const post = await db.from('posts').where('id', postId).whereNull('deleted_at').first()
          if (!post) return errorResult('Post not found', { postId })

          // Default viewMode is 'source' unless overridden in context
          const viewMode = context?.viewMode || 'source'
          const canonical = await PostSerializerService.serialize(postId, viewMode)

          payload = {
            ...payload,
            post: canonical,
          }
          executionContext.data.post = canonical
        }

        // 5. Execute
        const result = await agentExecutor.execute(agent as any, executionContext, payload)

        if (!result.success) {
          return errorResult('Agent execution failed', { message: result.error?.message })
        }

        // 6. Return standard response
        return jsonResult({
          success: true,
          agentId,
          postId,
          response: result.data,
          summary: (result as any).summary,
          applied: (result as any).applied || [],
        })
      } catch (e: any) {
        return errorResult('Agent execution error', { message: e?.message || String(e) })
      }
    }
  )

  // ---- Preview links ----
  server.tool(
    'create_post_preview_link',
    'Create a signed preview link for a post (useful for human review).',
    {
      postId: z.string().min(1),
      expirationHours: z.number().int().min(1).max(720).optional(),
      createdByUserId: z
        .number()
        .int()
        .optional()
        .describe('Optional users.id; defaults to MCP_SYSTEM_USER_ID or null'),
    },
    async ({ postId, expirationHours, createdByUserId }) => {
      try {
        const post = await db.from('posts').where('id', postId).whereNull('deleted_at').first()
        if (!post) return errorResult('Post not found', { postId })
        const fallbackUserId = await resolveSystemUserId()
        const createdBy =
          typeof createdByUserId === 'number' ? createdByUserId : (fallbackUserId ?? undefined)
        const data = await previewService.createPreviewLink(postId, createdBy, expirationHours)
        return jsonResult({ data })
      } catch (e: any) {
        return errorResult('Failed to create preview link', { message: e?.message })
      }
    }
  )

  server.tool(
    'list_post_preview_links',
    'List active preview links for a post.',
    {
      postId: z.string().min(1),
    },
    async ({ postId }) => {
      try {
        const links = await previewService.listTokensForPost(postId)
        return jsonResult({
          data: links.map((l) => ({
            id: l.id,
            token: l.token,
            expiresAt: l.expiresAt,
            createdBy: l.createdBy,
            createdAt: l.createdAt,
            url: `/preview/${postId}?token=${l.token}`,
          })),
        })
      } catch (e: any) {
        return errorResult('Failed to list preview links', { message: e?.message })
      }
    }
  )

  server.tool(
    'revoke_post_preview_link',
    'Revoke a preview link token for a post.',
    {
      postId: z.string().min(1),
      token: z.string().min(1),
    },
    async ({ postId, token }) => {
      try {
        const ok = await previewService.revokeToken(postId, token)
        if (!ok) return errorResult('Preview link not found', { postId, token })
        return jsonResult({ message: 'Revoked', data: { postId, token } })
      } catch (e: any) {
        return errorResult('Failed to revoke preview link', { message: e?.message })
      }
    }
  )

  // ---- Media (read-only discovery) ----
  server.tool(
    'list_media',
    'List media assets (searchable).',
    {
      q: z.string().optional().describe('Search by filename/url/alt_text'),
      mime: z.string().optional().describe('Filter by mime_type exact match'),
      category: z.string().optional().describe('Filter by category (in categories[])'),
      limit: z.number().int().min(1).max(200).optional().default(50),
      offset: z.number().int().min(0).optional().default(0),
    },
    async ({ q, mime, category, limit, offset }) => {
      try {
        const query = db.from('media_assets')
        if (mime) query.andWhere('mime_type', mime)
        if (category) query.andWhereRaw('? = ANY(categories)', [category])
        if (q) {
          const like = `%${q}%`
          query.andWhere((qb) => {
            qb.whereILike('original_filename', like)
              .orWhereILike('url', like)
              .orWhereILike('alt_text', like)
          })
        }
        const rows = await query
          .orderBy('created_at', 'desc')
          .limit(limit ?? 50)
          .offset(offset ?? 0)
          .select(
            'id',
            'url',
            'original_filename as originalFilename',
            'mime_type as mimeType',
            'size',
            'alt_text as altText',
            'caption',
            'description',
            'categories',
            'metadata',
            'optimized_url as optimizedUrl',
            'optimized_at as optimizedAt',
            'created_at as createdAt',
            'updated_at as updatedAt'
          )
        return jsonResult({ data: rows })
      } catch (e: any) {
        return errorResult('Failed to list media', { message: e?.message })
      }
    }
  )

  server.tool(
    'get_media',
    'Get a single media asset by id.',
    {
      id: z.string().min(1),
    },
    async ({ id }) => {
      try {
        const row = await db
          .from('media_assets')
          .where('id', id)
          .select(
            'id',
            'url',
            'original_filename as originalFilename',
            'mime_type as mimeType',
            'size',
            'alt_text as altText',
            'caption',
            'description',
            'categories',
            'metadata',
            'optimized_url as optimizedUrl',
            'optimized_at as optimizedAt',
            'created_at as createdAt',
            'updated_at as updatedAt'
          )
          .first()
        if (!row) return errorResult('Media not found', { id })
        return jsonResult({ data: row })
      } catch (e: any) {
        return errorResult('Failed to load media', { message: e?.message })
      }
    }
  )

  server.tool(
    'check_media_integrity',
    'Verifies the DB record exists, the file exists on disk (or R2), and all variants/optimized versions listed in the metadata are actually present.',
    {
      mediaId: z.string().min(1),
    },
    async ({ mediaId }) => {
      try {
        const row = await db.from('media_assets').where('id', mediaId).first()
        if (!row) return errorResult('Media not found in database', { mediaId })

        const results: any = {
          database: true,
          original: { url: row.url, exists: false },
          variants: [],
          optimized: row.optimized_url ? { url: row.optimized_url, exists: false } : null,
        }

        const checkExists = async (u: string) => {
          if (u.startsWith('http')) {
            return true
          }
          const absPath = storageService.getLocalPath(u)
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

        return jsonResult({ data: results })
      } catch (e: any) {
        return errorResult('Failed to check media integrity', { message: e?.message })
      }
    }
  )

  server.tool('list_media_categories', 'List all media categories in use.', async () => {
    try {
      const result: any = await db.raw(
        `SELECT DISTINCT unnest(categories) AS category FROM media_assets`
      )
      const rows: any[] = Array.isArray(result) ? result : result?.rows || []
      const categories = rows
        .map((r: any) => String(r.category || ''))
        .filter(Boolean)
        .sort()
      return jsonResult({ data: categories })
    } catch (e: any) {
      return errorResult('Failed to list media categories', { message: e?.message })
    }
  })

  server.tool(
    'media_where_used',
    'Find module/post references that contain this media URL (searches props + review/ai-review props + overrides).',
    {
      id: z.string().min(1),
    },
    async ({ id }) => {
      try {
        const row = await db.from('media_assets').where('id', id).first()
        if (!row) return errorResult('Media not found', { id })
        const url = String((row as any).url || '')
        if (!url) return jsonResult({ data: { inModules: [], inOverrides: [] } })

        const likeUrl = `%${url}%`
        const likeId = `%${id}%`

        // 1. Modules
        const inModules = await db
          .from('module_instances')
          .leftJoin('post_modules', 'module_instances.id', 'post_modules.module_id')
          .leftJoin('posts', 'post_modules.post_id', 'posts.id')
          .where((query) => {
            query
              .where((q) => {
                q.whereRaw(`module_instances.props::text ILIKE ?`, [likeUrl])
                  .orWhereRaw(`COALESCE(module_instances.review_props::text, '') ILIKE ?`, [
                    likeUrl,
                  ])
                  .orWhereRaw(`COALESCE(module_instances.ai_review_props::text, '') ILIKE ?`, [
                    likeUrl,
                  ])
              })
              .orWhere((q) => {
                q.whereRaw(`module_instances.props::text ILIKE ?`, [likeId])
                  .orWhereRaw(`COALESCE(module_instances.review_props::text, '') ILIKE ?`, [likeId])
                  .orWhereRaw(`COALESCE(module_instances.ai_review_props::text, '') ILIKE ?`, [
                    likeId,
                  ])
              })
          })
          .select(
            'module_instances.id',
            'module_instances.type',
            'module_instances.scope',
            'module_instances.global_slug as globalSlug',
            'posts.id as postId',
            'posts.title as postTitle'
          )

        // 2. Post Module Overrides
        const inOverrides = await db
          .from('post_modules')
          .join('posts', 'post_modules.post_id', 'posts.id')
          .where((query) => {
            query
              .where((q) => {
                q.whereRaw(`post_modules.overrides::text ILIKE ?`, [likeUrl])
                  .orWhereRaw(`COALESCE(post_modules.review_overrides::text, '') ILIKE ?`, [
                    likeUrl,
                  ])
                  .orWhereRaw(`COALESCE(post_modules.ai_review_overrides::text, '') ILIKE ?`, [
                    likeUrl,
                  ])
              })
              .orWhere((q) => {
                q.whereRaw(`post_modules.overrides::text ILIKE ?`, [likeId])
                  .orWhereRaw(`COALESCE(post_modules.review_overrides::text, '') ILIKE ?`, [likeId])
                  .orWhereRaw(`COALESCE(post_modules.ai_review_overrides::text, '') ILIKE ?`, [
                    likeId,
                  ])
              })
          })
          .select('post_modules.id', 'posts.id as postId', 'posts.title as postTitle')

        // 3. Post Fields
        const inPosts = await db
          .from('posts')
          .where('featured_media_id', id)
          .orWhereRaw(`COALESCE(review_draft::text, '') ILIKE ?`, [likeUrl])
          .orWhereRaw(`COALESCE(ai_review_draft::text, '') ILIKE ?`, [likeUrl])
          .orWhereRaw(`COALESCE(review_draft::text, '') ILIKE ?`, [likeId])
          .orWhereRaw(`COALESCE(ai_review_draft::text, '') ILIKE ?`, [likeId])
          .select('id', 'title', 'type')

        // 4. Site Settings
        const inSettings = await db
          .from('site_settings')
          .where('logo_media_id', id)
          .orWhere('favicon_media_id', id)
          .orWhere('default_og_media_id', id)
          .select('id')

        return jsonResult({
          data: {
            inModules: inModules.map((m: any) => ({
              id: m.id,
              type: m.type,
              scope: m.scope,
              globalSlug: m.globalSlug,
              postId: m.postId,
              postTitle: m.postTitle,
            })),
            inOverrides: inOverrides.map((o: any) => ({
              id: o.id,
              postId: o.postId,
              postTitle: o.postTitle,
            })),
            inPosts: inPosts.map((p: any) => ({ id: p.id, title: p.title, type: p.type })),
            inSettings: inSettings.length > 0,
          },
        })
      } catch (e: any) {
        return errorResult('Failed to compute where-used', { message: e?.message })
      }
    }
  )

  // ---- Taxonomies (editor parity) ----
  server.tool('list_taxonomies', 'List all taxonomies with config metadata.', async () => {
    try {
      const rows = await taxonomyService.listTaxonomies()
      return jsonResult({ data: rows })
    } catch (e: any) {
      return errorResult('Failed to list taxonomies', { message: e?.message })
    }
  })

  server.tool(
    'list_taxonomy_terms',
    'Get the taxonomy terms tree for a taxonomy slug.',
    {
      slug: z.string().min(1),
    },
    async ({ slug }) => {
      try {
        const tree = await taxonomyService.getTermsTreeBySlug(String(slug))
        return jsonResult({ data: tree })
      } catch (e: any) {
        return errorResult('Failed to list taxonomy terms', { message: e?.message })
      }
    }
  )

  server.tool(
    'get_post_taxonomy_term_ids',
    'Get currently assigned taxonomy term ids for a post (approved/live assignments).',
    {
      postId: z.string().min(1),
    },
    async ({ postId }) => {
      try {
        const rows = await db
          .from('post_taxonomy_terms')
          .where('post_id', postId)
          .select('taxonomy_term_id as id')
        return jsonResult({ data: rows.map((r: any) => String(r.id || r.taxonomy_term_id)) })
      } catch (e: any) {
        return errorResult('Failed to load taxonomy assignments', { message: e?.message })
      }
    }
  )

  server.tool(
    'set_post_taxonomy_terms_ai_review',
    'Stage taxonomy assignments into ai_review_draft.taxonomyTermIds (does not change live assignments).',
    {
      postId: z.string().min(1),
      taxonomyTermIds: z
        .array(z.string())
        .describe('Full desired set of taxonomy term ids for this post'),
      agentId: z.string().optional(),
      agentName: z.string().optional(),
    },
    async ({ postId, taxonomyTermIds, agentId, agentName }) => {
      const savedBy = resolveAgentLabel({ agentId, agentName })
      try {
        const post = await db.from('posts').where('id', postId).whereNull('deleted_at').first()
        if (!post) return errorResult('Post not found', { postId })

        const baseDraft = (post.review_draft as any) || {
          slug: post.slug,
          title: post.title,
          status: post.status,
          excerpt: post.excerpt ?? null,
          parentId: post.parent_id ?? null,
          orderIndex: post.order_index ?? 0,
          metaTitle: post.meta_title ?? null,
          metaDescription: post.meta_description ?? null,
          canonicalUrl: post.canonical_url ?? null,
          robotsJson: post.robots_json ?? null,
          jsonldOverrides: post.jsonld_overrides ?? null,
          featuredMediaId: post.featured_media_id ?? null,
        }

        const merged = {
          ...baseDraft,
          taxonomyTermIds: Array.from(
            new Set((taxonomyTermIds as string[]).map((x: string) => String(x)).filter(Boolean))
          ),
          savedAt: new Date().toISOString(),
          savedBy,
        }

        await db
          .from('posts')
          .where('id', postId)
          .update({ ai_review_draft: merged, updated_at: new Date() } as any)
        await RevisionService.record({ postId, mode: 'ai-review', snapshot: merged, userId: null })

        return jsonResult({
          message: 'Staged taxonomyTermIds in AI review draft',
          data: { postId },
        })
      } catch (e: any) {
        return errorResult('Failed to stage taxonomy assignments', { message: e?.message })
      }
    }
  )

  // ---- Layout planning (module suitability + gap analysis) ----
  server.tool(
    'suggest_modules_for_layout',
    'Suggest a module plan for a page layout and identify missing module gaps (uses module aiGuidance + post type constraints).',
    {
      postType: z
        .string()
        .optional()
        .describe('Optional post type slug (filters allowedPostTypes when set)'),
      brief: z
        .string()
        .optional()
        .describe('Optional freeform layout brief. Used for lightweight role inference.'),
      desiredLayoutRoles: z
        .array(z.string().min(1))
        .optional()
        .describe(
          'Optional explicit layout roles to satisfy (e.g. ["hero","body","gallery","cta"])'
        ),
      excludeModuleTypes: z
        .array(z.string())
        .optional()
        .describe('Optional module types to exclude'),
      maxPerRole: z.number().int().min(1).max(10).optional().default(3),
    },
    async ({ postType, brief, desiredLayoutRoles, excludeModuleTypes, maxPerRole }) => {
      try {
        const all = moduleRegistry.getAllSchemas()
        const excluded = new Set(
          (excludeModuleTypes as string[] | undefined)?.map((t: string) => String(t)) || []
        )

        const modules = all
          .filter((m) => !excluded.has(m.type))
          .filter((m) => {
            if (!postType) return true
            const allowed = m.allowedPostTypes
            if (!allowed || allowed.length === 0) return true
            return allowed.includes(postType)
          })
          .map((m) => ({
            type: m.type,
            name: m.name,
            description: m.description || '',
            allowedPostTypes: m.allowedPostTypes || [],
            aiGuidance: m.aiGuidance || null,
            layoutRoles: m.aiGuidance?.layoutRoles || [],
          }))

        const inferRolesFromBrief = (text: string): string[] => {
          const t = text.toLowerCase()
          const roles: string[] = []
          const add = (r: string) => {
            if (!roles.includes(r)) roles.push(r)
          }

          for (const m of modules) {
            const guidance = m.aiGuidance as any
            const keywords = guidance?.keywords || []
            const moduleRoles = guidance?.layoutRoles || []

            // If brief matches any keyword, add all roles of this module
            if (keywords.some((k: string) => t.includes(k.toLowerCase()))) {
              moduleRoles.forEach(add)
            }

            // Also check the roles themselves as keywords
            moduleRoles.forEach((r: string) => {
              if (t.includes(r.toLowerCase())) {
                add(r)
              }
            })
          }

          // Fallback for common roles if no modules were matched yet
          if (roles.length === 0) {
            for (const fallback of mcpLayoutConfig.fallbackInference) {
              if (fallback.pattern.test(t)) {
                fallback.roles.forEach(add)
              }
            }
          }

          return roles
        }

        const desired = Array.from(
          new Set([
            ...(((desiredLayoutRoles as string[] | undefined) || [])
              .map((r: string) => String(r).trim())
              .filter(Boolean) as string[]),
            ...(brief ? inferRolesFromBrief(brief) : []),
          ])
        )

        // If caller provided nothing, return an overview grouped by layout roles we know about.
        const knownRoles = Array.from(
          new Set(
            modules.flatMap((m) => (m.layoutRoles && m.layoutRoles.length ? m.layoutRoles : []))
          )
        ).sort()

        const roleList = desired.length ? desired : knownRoles

        const byRole: Record<string, any[]> = {}
        for (const role of roleList) {
          const candidates = modules
            .filter((m) => (m.layoutRoles || []).includes(role))
            .map((m) => ({
              type: m.type,
              name: m.name,
              description: m.description,
              useWhen: m.aiGuidance?.useWhen || [],
              avoidWhen: m.aiGuidance?.avoidWhen || [],
              compositionNotes: m.aiGuidance?.compositionNotes || '',
            }))
          byRole[role] = candidates.slice(0, maxPerRole ?? 3)
        }

        const missingRoles = roleList.filter((r) => (byRole[r] || []).length === 0)

        const suggestedNewModules = missingRoles.map((r) => {
          const title = r
            .split(/[\s_-]+/)
            .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
            .join(' ')
          return {
            role: r,
            suggestedType: `todo-${r}`,
            suggestedName: title,
            suggestedDescription: `Consider adding a dedicated '${r}' module to support this layout role.`,
          }
        })

        const recommendedOrder = (() => {
          const order: string[] = []
          const add = (r: string) => {
            if (roleList.includes(r) && !order.includes(r)) order.push(r)
          }

          // Preferred structural order by role from config
          mcpLayoutConfig.rolePriority.forEach(add)

          // append anything else
          for (const r of roleList) add(r)
          return order
        })()

        return jsonResult({
          data: {
            postType: postType || null,
            desiredLayoutRoles: roleList,
            inferredFromBrief: brief ? inferRolesFromBrief(brief) : [],
            recommendedOrder,
            suggestionsByRole: byRole,
            missingRoles,
            suggestedNewModules,
            notes: [
              'This tool is deterministic and uses module aiGuidance.layoutRoles + postType constraints.',
              'If missingRoles is non-empty, consider creating new modules or expanding aiGuidance on existing modules.',
            ],
          },
        })
      } catch (e: any) {
        return errorResult('Failed to suggest modules for layout', { message: e?.message })
      }
    }
  )

  server.tool(
    'tail_activity_logs',
    'Returns the latest entries from the activity_logs table for debugging and auditing.',
    {
      limit: z.number().int().min(1).max(100).optional().default(20),
      entityId: z.string().optional(),
      action: z.string().optional(),
    },
    async ({ limit, entityId, action }) => {
      try {
        let query = db.from('activity_logs')
        if (entityId) query = query.where('entity_id', entityId)
        if (action) query = query.where('action', action)

        const logs = await query.orderBy('created_at', 'desc').limit(limit)
        return jsonResult({ data: logs })
      } catch (e: any) {
        return errorResult('Failed to tail activity logs', { message: e?.message })
      }
    }
  )

  server.tool(
    'simulate_webhook_event',
    'Triggers the webhook_service dispatch logic with a mock payload to test integrations.',
    {
      event: z.string().min(1).describe('The webhook event name (e.g. "post.published")'),
      payload: z.record(z.any()).describe('The mock data payload to send'),
    },
    async ({ event, payload }) => {
      try {
        await webhookService.dispatch(event as any, payload)
        return jsonResult({ success: true, message: `Dispatched ${event}` })
      } catch (e: any) {
        return errorResult('Failed to simulate webhook event', { message: e?.message })
      }
    }
  )

  server.tool(
    'run_ace_command',
    'Execute a node ace command (e.g. list:routes, migration:status).',
    {
      command: z.string().min(1).describe('The ace command to run'),
      args: z
        .array(z.string())
        .optional()
        .default([])
        .describe('Optional arguments for the command'),
    },
    async ({ command, args }) => {
      try {
        const fullCmd = `node ace ${command} ${args.join(' ')}`
        const { stdout, stderr } = await execAsync(fullCmd)
        return jsonResult({ stdout, stderr })
      } catch (e: any) {
        return errorResult('Ace command failed', { message: e?.message, stderr: e?.stderr })
      }
    }
  )

  server.tool(
    'test_local_route',
    'Make a request to a local URL to verify behavior, check status codes, and see response data.',
    {
      url: z.string().min(1).describe('Local URL path (e.g. "/api/posts")'),
      method: z.enum(['GET', 'POST', 'PUT', 'PATCH', 'DELETE']).optional().default('GET'),
      body: z.record(z.any()).optional().describe('Optional request body for POST/PUT/PATCH'),
    },
    async ({ url, method, body }) => {
      try {
        // Assume default port 3333 if not specified in env
        const appPort = process.env.PORT || 3333
        const fullUrl = `http://localhost:${appPort}${url.startsWith('/') ? '' : '/'}${url}`

        const response = await fetch(fullUrl, {
          method,
          headers: body ? { 'Content-Type': 'application/json' } : {},
          body: body ? JSON.stringify(body) : undefined,
        })

        const data = await response.json().catch(() => null)
        const text = !data ? await response.text().catch(() => '') : null

        return jsonResult({
          status: response.status,
          statusText: response.statusText,
          data,
          text,
        })
      } catch (e: any) {
        return errorResult('Local route test failed', { message: e?.message })
      }
    }
  )

  server.tool(
    'read_server_logs',
    'Read the last N lines of the application logs from the terminal output.',
    {
      lines: z.number().int().min(1).max(500).optional().default(50),
    },
    async ({ lines }) => {
      try {
        // Try to find terminal files in the project's terminal folder
        const terminalDir = path.join(process.cwd(), '.cursor/projects', 'home-spaced-man-Dev-applications-adonis-eos', 'terminals')

        // This is a bit speculative as the path might change, but it's based on the user's provided info.
        // If it fails, we'll try a more generic approach.
        let logContent = ''
        try {
          const files = await fs.readdir(terminalDir)
          // Find the most recently modified .txt file
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
          }
        } catch {
          return errorResult('Could not find or read terminal logs in .cursor directory.')
        }

        return jsonResult({
          logs: logContent,
        })
      } catch (e: any) {
        return errorResult('Failed to read server logs', { message: e?.message })
      }
    }
  )

  server.tool(
    'trace_url_resolution',
    'Resolves a URL path to its corresponding Post or URL Pattern.',
    {
      path: z.string().min(1).describe('The URL path to trace (e.g. "/blog/my-post")'),
    },
    async ({ path: urlPath }) => {
      try {
        const match = await urlPatternService.matchPath(urlPath)
        if (!match) {
          return jsonResult({ matched: false, message: 'No pattern matched this URL' })
        }

        const post = await Post.query()
          .where({
            type: match.postType,
            locale: match.locale,
            slug: match.slug,
          })
          .whereNull('deleted_at')
          .first()

        return jsonResult({
          matched: true,
          matchInfo: match,
          post: post
            ? {
              id: post.id,
              title: post.title,
              status: post.status,
            }
            : null,
        })
      } catch (e: any) {
        return errorResult('URL resolution trace failed', { message: e?.message })
      }
    }
  )

  server.tool(
    'validate_mcp_payload',
    'Dry run validation for module props against their schema without saving.',
    {
      type: z.string().min(1).describe('Module type (e.g. "hero")'),
      props: z.record(z.any()).describe('The props to validate'),
    },
    async ({ type, props }) => {
      try {
        if (!moduleRegistry.has(type)) {
          return errorResult(`Module type "${type}" not found`)
        }
        const module = moduleRegistry.get(type)
        try {
          module.validate(props)
          return jsonResult({ valid: true })
        } catch (err: any) {
          return jsonResult({ valid: false, error: err.message })
        }
      } catch (e: any) {
        return errorResult('Payload validation failed', { message: e?.message })
      }
    }
  )

  server.tool(
    'diff_post_versions',
    'Compares two versions of a post (revision, draft, or source) and returns a detailed field-level and module-level diff.',
    {
      postId: z.string().min(1).describe('The post ID'),
      baseMode: z.enum(['source', 'review', 'ai-review']).optional().default('source').describe('Base version to compare from'),
      targetMode: z.enum(['source', 'review', 'ai-review']).optional().default('ai-review').describe('Target version to compare to'),
    },
    async ({ postId, baseMode, targetMode }) => {
      try {
        const [base, target] = await Promise.all([
          PostSerializerService.serialize(postId, baseMode as any),
          PostSerializerService.serialize(postId, targetMode as any)
        ])

        const fieldDiff: Record<string, { base: any; target: any; changed: boolean }> = {}
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

        // Simple module diff
        const baseModules = base.modules || []
        const targetModules = target.modules || []
        const moduleDiff = {
          added: targetModules.filter(tm => !baseModules.some(bm => bm.postModuleId === tm.postModuleId)),
          removed: baseModules.filter(bm => !targetModules.some(tm => tm.postModuleId === bm.postModuleId)),
          changed: targetModules.filter(tm => {
            const bm = baseModules.find(b => b.postModuleId === tm.postModuleId)
            return bm && JSON.stringify(bm.props) !== JSON.stringify(tm.props)
          })
        }

        return jsonResult({
          postId,
          baseMode,
          targetMode,
          fields: fieldDiff,
          modules: {
            addedCount: moduleDiff.added.length,
            removedCount: moduleDiff.removed.length,
            changedCount: moduleDiff.changed.length,
            added: moduleDiff.added.map(m => ({ id: m.postModuleId, type: m.type })),
            removed: moduleDiff.removed.map(m => ({ id: m.postModuleId, type: m.type })),
            changed: moduleDiff.changed.map(m => ({ id: m.postModuleId, type: m.type }))
          }
        })
      } catch (e: any) {
        return errorResult('Failed to diff post versions', { message: e?.message })
      }
    }
  )

  server.tool(
    'query_db_summary',
    'Returns a high-level summary of database statistics (post counts by type/status, media usage, etc.).',
    {},
    async () => {
      try {
        const [posts, media, users] = await Promise.all([
          db.from('posts').select('type', 'status').count('* as count').groupBy('type', 'status'),
          db.from('media_assets').count('* as count').first(),
          db.from('users').count('* as count').first()
        ])

        const postStats: Record<string, any> = {}
        posts.forEach((p: any) => {
          if (!postStats[p.type]) postStats[p.type] = { total: 0, byStatus: {} }
          const count = Number(p.count)
          postStats[p.type].total += count
          postStats[p.type].byStatus[p.status] = count
        })

        return jsonResult({
          posts: postStats,
          media: {
            total: Number(media?.count || 0)
          },
          users: {
            total: Number(users?.count || 0)
          }
        })
      } catch (e: any) {
        return errorResult('Failed to query database summary', { message: e?.message })
      }
    }
  )

  return server
}

export default class McpServe extends BaseCommand {
  static commandName = 'mcp:serve'
  static description = 'Serve MCP endpoints (SSE for n8n; optional stdio for local dev)'

  static options: CommandOptions = {
    startApp: true,
  }

  @flags.string({
    description: 'Transport: "sse" (recommended for n8n) or "stdio" (local dev)',
    default: process.env.MCP_TRANSPORT || 'sse',
  })
  declare transport: 'sse' | 'stdio'

  @flags.string({
    description: 'Bind host for SSE server',
    default: process.env.MCP_HOST || '0.0.0.0',
  })
  declare host: string

  @flags.string({
    description: 'Bind port for SSE server',
    default: process.env.MCP_PORT || '8787',
  })
  declare port: string

  async run() {
    const transport = String(this.transport || 'sse')
      .trim()
      .toLowerCase()
    const host = String(this.host || '0.0.0.0').trim()
    const port = Number.parseInt(String(this.port || '8787'), 10)
    if (!Number.isFinite(port) || port <= 0) {
      this.logger.error(`Invalid port: ${this.port}`)
      this.exitCode = 1
      return
    }

    if (transport === 'stdio') {
      // Cursor's MCP stdio mode is strict: stdout must only contain protocol messages.
      // Also, some clients will close pipes aggressively if handshake fails; handle EPIPE gracefully.
      try {
        process.stdout.on('error', (e: any) => {
          if (e?.code === 'EPIPE') {
            process.exit(0)
          }
        })
      } catch {
        // ignore
      }
      try {
        process.on('uncaughtException', (err) => {
          // Avoid crashing without context; stderr is fine for diagnostics.
          console.error(err)
        })
        process.on('unhandledRejection', (reason) => {
          console.error(reason)
        })
      } catch {
        // ignore
      }

      const server = createServerInstance()
      await server.connect(new StdioServerTransport())
      // Intentionally do not log anything here (stdout must be protocol-only).
      return
    }

    if (transport !== 'sse') {
      this.logger.error(
        `Unsupported transport: ${transport}. Use --transport=sse or --transport=stdio.`
      )
      this.exitCode = 1
      return
    }

    const transports: Record<string, SSEServerTransport> = {}

    const httpServer = http.createServer(async (req, res) => {
      try {
        const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`)

        // Simple health endpoint
        if (req.method === 'GET' && url.pathname === '/health') {
          res.writeHead(200, { 'content-type': 'application/json' })
          res.end(JSON.stringify({ ok: true }))
          return
        }

        // SSE endpoint (n8n MCP Client Tool expects this)
        if (req.method === 'GET' && url.pathname === '/mcp') {
          if (!isAuthorized(req)) return sendUnauthorized(res)

          const sseTransport = new SSEServerTransport('/messages', res)
          const sessionId = sseTransport.sessionId
          transports[sessionId] = sseTransport
          sseTransport.onclose = () => {
            delete transports[sessionId]
          }

          const server = createServerInstance()
          await server.connect(sseTransport)
          return
        }

        // Message endpoint (client POSTs JSON-RPC here; sessionId query param is required)
        if (req.method === 'POST' && url.pathname === '/messages') {
          if (!isAuthorized(req)) return sendUnauthorized(res)

          const sessionId = url.searchParams.get('sessionId')
          if (!sessionId) {
            res.writeHead(400, { 'content-type': 'application/json' })
            res.end(JSON.stringify({ error: 'Missing sessionId parameter' }))
            return
          }

          const sseTransport = transports[sessionId]
          if (!sseTransport) {
            res.writeHead(404, { 'content-type': 'application/json' })
            res.end(JSON.stringify({ error: 'Session not found' }))
            return
          }

          // Read body so we can pass parsed JSON to the SDK transport
          const chunks: Buffer[] = []
          for await (const chunk of req) chunks.push(Buffer.from(chunk))
          const bodyRaw = Buffer.concat(chunks).toString('utf-8')
          let parsed: any
          try {
            parsed = bodyRaw ? JSON.parse(bodyRaw) : undefined
          } catch {
            res.writeHead(400, { 'content-type': 'application/json' })
            res.end(JSON.stringify({ error: 'Invalid JSON body' }))
            return
          }

          await sseTransport.handlePostMessage(req as any, res as any, parsed)
          return
        }

        res.writeHead(404, { 'content-type': 'application/json' })
        res.end(JSON.stringify({ error: 'Not found' }))
      } catch (e: any) {
        if (!res.headersSent) {
          res.writeHead(500, { 'content-type': 'application/json' })
        }
        res.end(JSON.stringify({ error: 'Internal server error', message: e?.message }))
      }
    })

    httpServer.listen(port, host, () => {
      const authMode =
        process.env.MCP_AUTH_TOKEN ||
          (process.env.MCP_AUTH_HEADER_NAME && process.env.MCP_AUTH_HEADER_VALUE)
          ? 'enabled'
          : 'disabled'
      this.logger.info(`MCP SSE server listening on http://${host}:${port}`)
      this.logger.info(`- SSE endpoint:  GET  /mcp`)
      this.logger.info(`- Messages:      POST /messages?sessionId=...`)
      this.logger.info(`- Auth: ${authMode}`)
    })

    const shutdown = async () => {
      this.logger.info('Shutting down MCP server...')
      for (const [sessionId, t] of Object.entries(transports)) {
        try {
          await t.close()
        } catch {
          /* ignore */
        }
        delete transports[sessionId]
      }
      await new Promise<void>((resolve) => httpServer.close(() => resolve()))
      process.exit(0)
    }

    process.on('SIGINT', shutdown)
    process.on('SIGTERM', shutdown)
  }
}
