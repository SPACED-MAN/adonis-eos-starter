import Post from '#models/post'
import db from '@adonisjs/lucid/services/db'
import urlPatternService from '#services/url_pattern_service'
import LocaleService from '#services/locale_service'
import { randomUUID } from 'node:crypto'
import siteSettingsService from '#services/site_settings_service'
import postTypeConfigService from '#services/post_type_config_service'
import moduleRegistry from '#services/module_registry'
import { existsSync } from 'node:fs'
import { join } from 'node:path'

type CreatePostParams = {
  type: string
  locale: string
  slug: string
  title: string
  status?: 'draft' | 'review' | 'scheduled' | 'published' | 'private' | 'protected' | 'archived'
  excerpt?: string | null
  metaTitle?: string | null
  metaDescription?: string | null
  moduleGroupId?: string | null
  /**
   * Controls how seeded modules are staged.
   * - approved: write into module_instances.props + post_modules.overrides (default behavior)
   * - ai-review: write seeded props into module_instances.ai_review_props and mark post_modules.ai_review_added=true
   */
  seedMode?: 'approved' | 'ai-review'
  userId: number
}

export class CreatePostException extends Error {
  constructor(
    message: string,
    public statusCode: number = 400,
    public meta?: Record<string, any>
  ) {
    super(message)
    this.name = 'CreatePostException'
  }
}

export default class CreatePost {
  static async handle({
    type,
    locale,
    slug,
    title,
    status = 'draft',
    excerpt = null,
    metaTitle = null,
    metaDescription = null,
    moduleGroupId = null,
    seedMode = 'approved',
    userId,
  }: CreatePostParams): Promise<Post> {
    // Enforce: post types must be defined in code (app/post_types/*)
    try {
      const appRoot = process.cwd()
      const tsPath = join(appRoot, 'app', 'post_types', `${type}.ts`)
      const jsPath = join(appRoot, 'app', 'post_types', `${type}.js`)
      const hasConfig = existsSync(tsPath) || existsSync(jsPath)
      if (!hasConfig) {
        // Allow if service provides built-in defaults (e.g., profile), else reject
        const ui = postTypeConfigService.getUiConfig(type)
        const isBuiltIn = type === 'profile'
        if (!isBuiltIn && !ui) {
          throw new CreatePostException(
            `Unknown post type: ${type}. Create app/post_types/${type}.ts first.`,
            400,
            { type }
          )
        }
      }
    } catch {
      // If any unexpected error, still proceed; controller endpoints and UI use configured list
    }
    // Profiles governance: one profile per user and role-based enablement
    if (type === 'profile') {
      // Role enablement from site settings
      const site = await siteSettingsService.get()
      const enabledRoles: string[] = Array.isArray((site as any).profileRolesEnabled)
        ? (site as any).profileRolesEnabled
        : []
      // Determine user role
      const userRow = await db.from('users').where('id', userId).select('role').first()
      const userRole = String((userRow as any)?.role || '')
      if (!userRole || (enabledRoles.length > 0 && !enabledRoles.includes(userRole))) {
        throw new CreatePostException('Profiles are disabled for your role', 403, {
          role: userRole,
        })
      }
      // Enforce one profile per user
      const existingProfile = await db
        .from('posts')
        .where({ type: 'profile', author_id: userId })
        .first()
      if (existingProfile) {
        throw new CreatePostException('A profile already exists for this user', 409, {
          postId: (existingProfile as any).id,
        })
      }
    }
    // Validate slug uniqueness for this locale
    const existingPost = await Post.query().where('slug', slug).where('locale', locale).first()

    if (existingPost) {
      throw new CreatePostException('A post with this slug already exists for this locale', 409, {
        slug,
        locale,
      })
    }

    const uiConfig = postTypeConfigService.getUiConfig(type)
    const hasPermalinks = uiConfig.permalinksEnabled !== false && uiConfig.urlPatterns.length > 0
    const modulesEnabled = uiConfig.modulesEnabled !== false && uiConfig.urlPatterns.length > 0
    const moduleGroupsEnabled =
      uiConfig.moduleGroupsEnabled !== false && uiConfig.urlPatterns.length > 0

    // Resolve default module group when none provided
    let effectiveModuleGroupId: string | null = moduleGroupId
    if (moduleGroupsEnabled && !effectiveModuleGroupId) {
      const defaultName = uiConfig.moduleGroup?.name || `${type}-default`
      const defaultGroup = await db
        .from('module_groups')
        .where({ post_type: type, name: defaultName })
        .first()
      if (defaultGroup) {
        effectiveModuleGroupId = (defaultGroup as any).id as string
      } else {
        // Fallbacks:
        // 1) If there is exactly one module group for this post type, use it.
        // 2) If there are multiple (common in seeded/dev DBs), choose the most recently updated.
        const candidates = await db
          .from('module_groups')
          .where({ post_type: type })
          .orderBy('updated_at', 'desc')
          .select('id')

        if (Array.isArray(candidates) && candidates.length >= 1) {
          effectiveModuleGroupId =
            candidates.length === 1
              ? ((candidates[0] as any).id as string)
              : ((candidates[0] as any).id as string)
        }
      }
    }

    // Create the post using a transaction
    const post = await db.transaction(async (trx) => {
      // Create post
      const newPost = await Post.create(
        {
          type,
          locale,
          slug,
          title,
          status,
          excerpt,
          metaTitle,
          metaDescription,
          moduleGroupId: moduleGroupsEnabled ? effectiveModuleGroupId : null,
          userId,
          authorId: userId,
          abVariation: 'A',
          abGroupId: randomUUID(),
        },
        { client: trx }
      )

      // If module group is specified, seed modules from that group
      if (moduleGroupsEnabled && effectiveModuleGroupId && modulesEnabled) {
        await this.seedModulesFromModuleGroup(newPost.id, effectiveModuleGroupId, trx, {
          seedMode,
        })
      }

      return newPost
    })

    // Ensure default URL patterns for this post type across supported locales
    if (hasPermalinks) {
      try {
        const locales = await LocaleService.getSupportedLocales()
        await urlPatternService.ensureDefaultsForPostType(type, locales)
      } catch {}
    }

    // Set canonical URL for the post
    if (hasPermalinks) {
      try {
        const canonicalPath = await urlPatternService.buildPostPathForPost(post.id)
        post.canonicalUrl = canonicalPath
        await post.save()
      } catch {
        // If canonical URL generation fails, continue without it
      }
    }

    return post
  }

  /**
   * Seed modules from a module group
   *
   * Copies all modules from a module group to the post, maintaining order and locks.
   */
  private static async seedModulesFromModuleGroup(
    postId: string,
    moduleGroupId: string,
    trx: any,
    options: { seedMode?: 'approved' | 'ai-review' } = {}
  ): Promise<void> {
    const seedMode = options.seedMode || 'approved'
    // Load module group modules in order
    const groupModules = await trx
      .from('module_group_modules')
      .where('module_group_id', moduleGroupId)
      .orderBy('order_index', 'asc')
      // Deterministic ordering when order_index ties exist
      .orderBy('created_at', 'asc')
      .orderBy('id', 'asc')

    if (!Array.isArray(groupModules) || groupModules.length === 0) {
      return
    }

    const now = new Date()
    for (const [idx, tm] of groupModules.entries()) {
      // Merge module defaults + module group defaults (module group wins)
      const defaultsFromRegistry = (moduleRegistry.get(tm.type).getConfig().defaultProps ||
        {}) as Record<string, any>
      const defaultsFromGroup = ((tm as any).default_props || {}) as Record<string, any>
      const mergedTemplateProps = { ...defaultsFromRegistry, ...defaultsFromGroup }

      const isGlobal = (tm as any).scope === 'global' && (tm as any).global_slug
      let moduleInstanceId: string
      if (isGlobal) {
        // Find existing global
        const global = await trx
          .from('module_instances')
          .where('scope', 'global')
          .where('global_slug', (tm as any).global_slug)
          .first()
        if (!global) {
          // If missing, create a new global instance using module group default props
          const [created] = await trx
            .table('module_instances')
            .insert({
              scope: 'global',
              type: tm.type,
              global_slug: (tm as any).global_slug,
              props: mergedTemplateProps,
              created_at: now,
              updated_at: now,
            })
            .returning('*')
          moduleInstanceId = (created as any).id
        } else {
          moduleInstanceId = (global as any).id
        }
      } else {
        // Create local instance
        const [instance] = await trx
          .table('module_instances')
          .insert({
            scope: 'post',
            type: tm.type,
            global_slug: null,
            // Always keep a sane approved default (registry defaults); stage template into AI Review when requested.
            props: defaultsFromRegistry,
            ai_review_props: seedMode === 'ai-review' ? mergedTemplateProps : null,
            created_at: now,
            updated_at: now,
          })
          .returning('*')
        moduleInstanceId = (instance as any).id
      }

      await trx.table('post_modules').insert({
        id: randomUUID(),
        post_id: postId,
        module_id: moduleInstanceId,
        // Respect module group ordering by position; using sequential indices avoids issues
        // when module_group_modules.order_index is missing/duplicated due to UI or import quirks.
        order_index: idx + 1,
        overrides: null,
        ai_review_overrides: null,
        review_overrides: null,
        locked: !!(tm as any).locked,
        review_added: false,
        review_deleted: false,
        ai_review_added: seedMode === 'ai-review',
        ai_review_deleted: false,
        created_at: now,
        updated_at: now,
      })
    }
  }
}
