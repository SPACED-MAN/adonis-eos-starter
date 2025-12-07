import Post from '#models/post'
import db from '@adonisjs/lucid/services/db'
import urlPatternService from '#services/url_pattern_service'
import LocaleService from '#services/locale_service'
import { randomUUID } from 'node:crypto'
import siteSettingsService from '#services/site_settings_service'
import postTypeConfigService from '#services/post_type_config_service'
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

    // Resolve default module group when none provided
    let effectiveModuleGroupId: string | null = moduleGroupId
    if (!effectiveModuleGroupId) {
      const defaultName =
        postTypeConfigService.getUiConfig(type)?.moduleGroup?.name || `${type}-default`
      const defaultGroup = await db
        .from('module_groups')
        .where({ post_type: type, name: defaultName })
        .first()
      if (defaultGroup) {
        effectiveModuleGroupId = (defaultGroup as any).id as string
      } else {
        const candidates = await db.from('module_groups').where({ post_type: type }).select('id')
        if (Array.isArray(candidates) && candidates.length === 1) {
          effectiveModuleGroupId = (candidates[0] as any).id as string
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
          moduleGroupId: effectiveModuleGroupId,
          userId,
          authorId: userId,
        },
        { client: trx }
      )

      // If module group is specified, seed modules from that group
      if (effectiveModuleGroupId) {
        await this.seedModulesFromModuleGroup(newPost.id, effectiveModuleGroupId, trx)
      }

      return newPost
    })

    // Ensure default URL patterns for this post type across supported locales
    try {
      const locales = await LocaleService.getSupportedLocales()
      await urlPatternService.ensureDefaultsForPostType(type, locales)
    } catch { }

    // Set canonical URL for the post
    try {
      const canonicalPath = await urlPatternService.buildPostPathForPost(post.id)
      post.canonicalUrl = canonicalPath
      await post.save()
    } catch {
      // If canonical URL generation fails, continue without it
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
    trx: any
  ): Promise<void> {
    // Load module group modules in order
    const groupModules = await trx
      .from('module_group_modules')
      .where('module_group_id', moduleGroupId)
      .orderBy('order_index', 'asc')

    if (!Array.isArray(groupModules) || groupModules.length === 0) {
      return
    }

    const now = new Date()
    for (const tm of groupModules) {
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
              props: tm.default_props || {},
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
            props: tm.default_props || {},
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
        order_index: (tm as any).order_index,
        overrides: null,
        locked: !!(tm as any).locked,
        created_at: now,
        updated_at: now,
      })
    }
  }
}
