import Post from '#models/post'
import authorizationService from '#services/authorization_service'
import db from '@adonisjs/lucid/services/db'
import { randomUUID } from 'node:crypto'

export default class BulkPostsAction {
  static async handle(input: {
    action: 'publish' | 'draft' | 'archive' | 'delete' | 'duplicate' | 'regeneratePermalinks'
    ids: string[]
    role?: 'admin' | 'editor' | 'translator'
  }): Promise<{ message: string; count: number }> {
    const { action, ids, role } = input
    const uniqueIds = Array.from(new Set(ids.map((v) => String(v))))

    if (!authorizationService.canBulkAction(role, action)) {
      const err = new Error('Not allowed to perform this action') as any
      err.statusCode = 403
      throw err
    }

    if (action === 'duplicate') {
      const posts = await Post.query().whereIn('id', uniqueIds)
      let duplicated = 0
      for (const post of posts) {
        await db.transaction(async (trx) => {
          const now = new Date()
          // Find unique slug within same locale
          const baseSlug = String(post.slug)
          const locale = String(post.locale)
          const newSlug = await BulkPostsAction.generateUniqueSlug(baseSlug, locale)
          // Create duplicated post (draft)
          const newPost = await Post.create(
            {
              type: post.type,
              locale: locale,
              slug: newSlug,
              title: `${post.title} (Copy)`,
              status: 'draft',
              excerpt: post.excerpt ?? null,
              metaTitle: post.metaTitle ?? null,
              metaDescription: post.metaDescription ?? null,
              canonicalUrl: post.canonicalUrl ?? null,
              robotsJson: post.robotsJson ?? null,
              jsonldOverrides: post.jsonldOverrides ?? null,
              templateId: post.templateId ?? null,
              userId: post.userId,
              authorId: post.authorId ?? null,
              parentId: post.parentId ?? null,
              orderIndex: post.orderIndex ?? 0,
              publishedAt: null,
              scheduledAt: null,
            },
            { client: trx }
          )
          // Duplicate custom field values
          const cfValues = await trx.from('post_custom_field_values').where({ post_id: post.id })
          if (Array.isArray(cfValues) && cfValues.length) {
            const rows = cfValues.map((r: any) => ({
              id: randomUUID(),
              post_id: newPost.id,
              field_slug: String(r.field_slug),
              value: r.value,
              created_at: now,
              updated_at: now,
            }))
            await trx.table('post_custom_field_values').insert(rows)
          }
          // Duplicate modules (clone local modules; reuse global)
          const modules = await trx
            .from('post_modules')
            .join('module_instances', 'post_modules.module_id', 'module_instances.id')
            .where('post_modules.post_id', post.id)
            .select(
              'post_modules.order_index as orderIndex',
              'post_modules.overrides',
              'post_modules.locked',
              'module_instances.id as moduleId',
              'module_instances.scope as scope',
              'module_instances.type as type',
              'module_instances.global_slug as globalSlug',
              'module_instances.props as props'
            )
            .orderBy('post_modules.order_index', 'asc')
          for (const m of modules) {
            let targetModuleId = m.moduleId
            if (String(m.scope) === 'post') {
              const [created] = await trx
                .table('module_instances')
                .insert({
                  id: randomUUID(),
                  scope: 'post',
                  type: String(m.type),
                  global_slug: null,
                  props: m.props ?? {},
                  created_at: now,
                  updated_at: now,
                })
                .returning('id')
              targetModuleId = (created as any).id
            }
            await trx.table('post_modules').insert({
              id: randomUUID(),
              post_id: newPost.id,
              module_id: targetModuleId,
              order_index: Number(m.orderIndex ?? 0),
              overrides: m.overrides ?? null,
              locked: !!m.locked,
              created_at: now,
              updated_at: now,
            })
          }
        })
        duplicated++
      }
      return { message: `Duplicated ${duplicated} posts`, count: duplicated }
    }

    if (action === 'regeneratePermalinks') {
      // Update canonical_url to reflect current hierarchical path (pattern may include {path})
      const rows = await Post.query().whereIn('id', uniqueIds)
      let updated = 0
      const now = new Date()
      const urlPatternService = (await import('#services/url_pattern_service')).default
      const postTypeConfigService = (await import('#services/post_type_config_service')).default

      for (const p of rows) {
        // Get current canonical URL (before regeneration)
        const oldPath = p.canonicalUrl

        // Build new path (without host) to store in canonical_url
        const newPath = await urlPatternService.buildPostPathForPost(p.id)

        // Update canonical URL
        await Post.query()
          .where('id', p.id)
          .update({ canonicalUrl: newPath, updatedAt: now } as any)

        // Create redirect if path changed and auto-redirect is enabled
        if (oldPath && oldPath !== newPath) {
          const shouldAutoRedirect = (() => {
            try {
              const cfg = postTypeConfigService.getUiConfig(p.type)
              return (cfg as any).autoRedirectOnSlugChange !== undefined
                ? !!(cfg as any).autoRedirectOnSlugChange
                : true
            } catch {
              return true // Default to enabled
            }
          })()

          if (shouldAutoRedirect) {
            // Check if redirect already exists
            const existing = await db.from('url_redirects').where('from_path', oldPath).first()
            if (!existing) {
              await db.table('url_redirects').insert({
                from_path: oldPath,
                to_path: newPath,
                http_status: 301,
                locale: p.locale,
                post_id: p.id,
                created_at: now,
                updated_at: now,
              })
            }
          }
        }

        updated++
      }
      return { message: `Regenerated permalinks for ${updated} posts`, count: updated }
    }

    if (action === 'delete') {
      const notArchived = await Post.query()
        .whereIn('id', uniqueIds)
        .whereNot('status', 'archived')
        .select('id', 'status')
      if (notArchived.length > 0) {
        const err = new Error('Only archived posts can be deleted') as any
        err.statusCode = 400
        err.meta = { notArchived: notArchived.map((p) => ({ id: p.id, status: p.status })) }
        throw err
      }
      await Post.query().whereIn('id', uniqueIds).delete()
      return { message: 'Deleted archived posts', count: uniqueIds.length }
    }

    let nextStatus: 'published' | 'draft' | 'archived'
    switch (action) {
      case 'publish':
        nextStatus = 'published'
        break
      case 'draft':
        nextStatus = 'draft'
        break
      case 'archive':
        nextStatus = 'archived'
        break
      default:
        const err = new Error('Invalid action') as any
        err.statusCode = 400
        throw err
    }
    const now = new Date()
    await db.from('posts').whereIn('id', uniqueIds).update({ status: nextStatus, updated_at: now })
    return { message: `Updated status to ${nextStatus}`, count: uniqueIds.length }
  }

  private static async generateUniqueSlug(baseSlug: string, locale: string): Promise<string> {
    // Try "-copy", then "-copy-2", "-copy-3", ...
    const firstCandidate = `${baseSlug}-copy`
    const existsFirst = await Post.query()
      .where('slug', firstCandidate)
      .where('locale', locale)
      .first()
    if (!existsFirst) return firstCandidate
    // Loop attempts
    for (let i = 2; i <= 1000; i++) {
      const candidate = `${baseSlug}-copy-${i}`
      const exists = await Post.query().where('slug', candidate).where('locale', locale).first()
      if (!exists) return candidate
    }
    // Fallback to unique random suffix
    return `${baseSlug}-copy-${randomUUID().slice(0, 8)}`
  }
}
