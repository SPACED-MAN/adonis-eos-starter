import { BaseCommand, flags } from '@adonisjs/core/ace'
import type { CommandOptions } from '@adonisjs/core/types/ace'
import moduleRegistry from '#services/module_registry'
import moduleScopeService from '#services/module_scope_service'
import postTypeRegistry from '#services/post_type_registry'
import postTypeConfigService from '#services/post_type_config_service'
import agentRegistry from '#services/agent_registry'
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
import PostSerializerService from '#services/post_serializer_service'
import CreateTranslation from '#actions/translations/create_translation'
import previewService from '#services/preview_service'
import taxonomyService from '#services/taxonomy_service'
import { getUserIdForAgent } from '#services/agent_user_service'
import { markdownToLexical } from '#helpers/markdown_to_lexical'

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
  type: z.string().optional().describe('Module type selector (used when postModuleId is not provided).'),
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

let _cachedSystemUserId: number | null | undefined
async function resolveSystemUserId(): Promise<number | null> {
  if (_cachedSystemUserId !== undefined) return _cachedSystemUserId

  const envId = getSystemUserId()
  if (envId) {
    _cachedSystemUserId = envId
    return envId
  }

  // Fallback to a dedicated seeded AI user (or any user with ai_agent role)
  try {
    const byEmail = await db.from('users').select('id').where('email', 'ai@example.com').first()
    if (byEmail?.id) {
      _cachedSystemUserId = Number(byEmail.id)
      return _cachedSystemUserId
    }
    const byRole = await db
      .from('users')
      .select('id')
      .where('role', 'ai_agent')
      .orderBy('id', 'asc')
      .first()
    if (byRole?.id) {
      _cachedSystemUserId = Number(byRole.id)
      return _cachedSystemUserId
    }
  } catch {
    // ignore DB errors; MCP tools will surface a helpful error when needed
  }

  _cachedSystemUserId = null
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
              featuredImageId: post.featured_image_id ?? null,
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
    'create_post_ai_review',
    'Create a new post and stage its first content into ai_review_draft. The live post remains as draft until a human approves.',
    {
      type: z.string().min(1),
      locale: z.string().min(1).default('en'),
      slug: z.string().min(1),
      title: z.string().min(1),
      excerpt: z.string().optional(),
      contentMarkdown: z
        .string()
        .optional()
        .describe(
          'Convenience: if provided, Adonis EOS will populate the first seeded `prose` module by converting this markdown to Lexical JSON and staging it into `content` (AI Review).'
        ),
      moduleGroupId: z
        .string()
        .optional()
        .describe('Optional module group id to seed modules from (overrides default post type module group).'),
      moduleGroupName: z
        .string()
        .optional()
        .describe(
          'Optional module group name to seed modules from (looked up by {post_type,type}+name). If provided, takes precedence over moduleGroupId.'
        ),
      moduleEdits: z
        .array(moduleEditSchema)
        .optional()
        .describe(
          'Optional module edits to apply immediately after creation (AI Review). Useful for populating seeded template modules.'
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
            hint:
              "Run `node ace db:seed --files database/seeders/user_seeder.ts` (creates ai@example.com) then set MCP_SYSTEM_USER_ID=<that id>.",
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
                error: 'contentMarkdown was provided but no seeded prose module exists to populate.',
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

          const firstHero = (seededModules as any[]).find((m: any) => String(m.type) === 'hero')
          if (firstHero && !alreadyEditsModule(String(firstHero.postModuleId))) {
            const heroTitle = String(title || '').trim() || mdH1 || ''
            const heroSubtitle =
              String(excerpt || '').trim() || (mdParas.length > 0 ? mdParas[0] : '')
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

              const targetMeta = (seededModules as any[]).find((m: any) => String(m.postModuleId) === targetId)
              const isProse = String(targetMeta?.type || (edit as any)?.type || '') === 'prose'

              let overrides =
                (edit as any)?.overrides === undefined ? undefined : ((edit as any)?.overrides as any)

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
          'Partial post fields: slug/title/excerpt/metaTitle/metaDescription/canonicalUrl/robotsJson/jsonldOverrides/featuredImageId/customFields/...'
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
          featuredImageId: post.featured_image_id ?? null,
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

  server.tool(
    'update_post_module_ai_review',
    'Update a post module as an AI Review change (writes to ai_review_props/ai_review_overrides).',
    {
      postModuleId: z.string().min(1),
      overrides: z.record(z.any()).nullable().optional(),
      locked: z.boolean().optional(),
      orderIndex: z.number().int().optional(),
    },
    async ({ postModuleId, overrides, locked, orderIndex }) => {
      try {
        // Locked modules are structural constraints from module groups and should not be changed by agents.
        // If an agent could unlock a module, it could then remove it, defeating the "locked modules must stay" contract.
        if (locked !== undefined) {
          return errorResult('Cannot change locked state via MCP (AI Review)', {
            postModuleId,
            hint: 'Locked modules must remain locked. Populate content via `overrides` (or use `contentMarkdown` for prose).',
          })
        }
        const updated = await UpdatePostModule.handle({
          postModuleId,
          overrides: overrides === undefined ? undefined : overrides,
          orderIndex,
          mode: 'ai-review',
        })
        return jsonResult({ data: { id: updated.id, updatedAt: updated.updated_at } })
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
          featuredImageId: source?.featured_image_id ?? null,
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
            featuredImageId: source?.featured_image_id ?? null,
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
            type: a.type,
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

      if (agent.type !== 'external' || !agent.external) {
        return errorResult('Only external agents are supported for run_field_agent', { agentId })
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
        featuredImageId: post.featured_image_id ?? null,
        taxonomyTermIds: undefined,
      }

      // Get module rows when needed
      let moduleRow: any | null = null
      let moduleSchema: any | null = null
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
        try {
          moduleSchema = moduleRegistry.getSchema(String(moduleRow.type))
        } catch {
          moduleSchema = null
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

      // Build payload for the external agent
      const webhookUrl = agentRegistry.getWebhookUrl(agentId)
      if (!webhookUrl) return errorResult('Agent webhook URL not configured', { agentId })

      const headers: Record<string, string> = { 'Content-Type': 'application/json' }
      if (agent.external.secret) {
        if (agent.external.secretHeader)
          headers[agent.external.secretHeader] = agent.external.secret
        else headers['Authorization'] = `Bearer ${agent.external.secret}`
      }

      const timeout = agentRegistry.getTimeout(agentId)
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), timeout)

      let agentResponse: any = null
      try {
        const res = await fetch(webhookUrl, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            scope: 'field',
            post: {
              id: post.id,
              type: post.type,
              locale: post.locale,
              status: post.status,
            },
            field: {
              key: fieldKey,
              currentValue: effectiveCurrentValue,
            },
            draftBase: baseDraft, // review draft (preferred) or approved snapshot
            module: moduleRow
              ? {
                postModuleId: moduleRow.postModuleId,
                moduleInstanceId: moduleRow.moduleInstanceId,
                type: moduleRow.type,
                scope: moduleRow.scope === 'post' ? 'local' : 'global',
                globalSlug: moduleRow.globalSlug || null,
                props: moduleRow.props || {},
                reviewProps: moduleRow.reviewProps || null,
                aiReviewProps: moduleRow.aiReviewProps || null,
                overrides: moduleRow.overrides || null,
                reviewOverrides: moduleRow.reviewOverrides || null,
                aiReviewOverrides: moduleRow.aiReviewOverrides || null,
                schema: moduleSchema,
              }
              : null,
            context: {
              ...(context || {}),
              ...(openEndedContext ? { openEndedContext } : {}),
            },
          }),
          signal: controller.signal,
        })
        clearTimeout(timeoutId)
        if (!res.ok) {
          const txt = await res.text().catch(() => '')
          return errorResult('Agent request failed', { status: res.status, body: txt })
        }
        agentResponse = await res.json().catch(() => ({}))
      } catch (e: any) {
        clearTimeout(timeoutId)
        if (e?.name === 'AbortError') return errorResult('Agent request timed out', { agentId })
        return errorResult('Agent request error', { message: e?.message || String(e) })
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
        const like = `%${url}%`

        const inModules = await db
          .from('module_instances')
          .whereRaw(
            `(props::text ILIKE ? OR review_props::text ILIKE ? OR ai_review_props::text ILIKE ?)`,
            [like, like, like]
          )
          .select('id', 'type', 'scope')

        const inOverrides = await db
          .from('post_modules')
          .whereRaw(
            `(overrides::text ILIKE ? OR review_overrides::text ILIKE ? OR ai_review_overrides::text ILIKE ?)`,
            [like, like, like]
          )
          .select('id', 'post_id as postId')

        return jsonResult({
          data: {
            inModules: inModules.map((m: any) => ({ id: m.id, type: m.type, scope: m.scope })),
            inOverrides: inOverrides.map((o: any) => ({ id: o.id, postId: o.postid || o.postId })),
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
          featuredImageId: post.featured_image_id ?? null,
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
          if (/\bhero\b/.test(t)) add('hero')
          if (/\bintro\b/.test(t)) add('intro')
          if (/\bcta\b|\bcall to action\b/.test(t)) add('cta')
          if (/\bform\b|\blead\b|\bcontact\b/.test(t)) add('form')
          if (/\bgallery\b|\bphotos?\b|\bimages?\b/.test(t)) add('gallery')
          if (/\btestimonial(s)?\b|\breviews?\b/.test(t)) add('testimonials')
          if (/\bfaq\b|\bquestions?\b/.test(t)) add('faq')
          if (/\bpricing\b|\bplans?\b/.test(t)) add('pricing')
          if (/\blogos?\b|\bbrands?\b/.test(t)) add('logos')
          if (/\bfeatures?\b/.test(t)) add('features')
          if (/\bstat(s)?\b|\bmetrics?\b/.test(t)) add('stats')
          if (/\bcontent\b|\bprose\b|\bbody\b/.test(t)) add('body')
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
          add('hero')
          add('intro')
          add('logos')
          add('features')
          add('body')
          add('stats')
          add('gallery')
          add('testimonials')
          add('faq')
          add('pricing')
          add('form')
          add('cta')
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
