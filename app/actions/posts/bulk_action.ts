import Post from '#models/post'
import authorizationService from '#services/authorization_service'
import db from '@adonisjs/lucid/services/db'
import { randomUUID } from 'node:crypto'
import PostCustomFieldValue from '#models/post_custom_field_value'
import ModuleInstance from '#models/module_instance'
import PostModule from '#models/post_module'
import UrlRedirect from '#models/url_redirect'

export default class BulkPostsAction {
  static async handle(input: {
    action: 'publish' | 'draft' | 'archive' | 'delete' | 'duplicate' | 'regeneratePermalinks'
    ids: string[]
    role?: 'admin' | 'editor' | 'translator'
    userId?: number
  }): Promise<{ message: string; count: number }> {
    const { action, ids, role, userId } = input
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
              moduleGroupId: post.moduleGroupId ?? null,
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
          const cfValues = await PostCustomFieldValue.query({ client: trx }).where(
            'postId',
            post.id
          )
          if (Array.isArray(cfValues) && cfValues.length) {
            const { DateTime } = await import('luxon')
            const rows = cfValues.map((r: any) => ({
              id: randomUUID(),
              postId: newPost.id,
              fieldSlug: String((r as any).fieldSlug ?? (r as any).field_slug),
              value: r.value,
              createdAt: DateTime.fromJSDate(now),
              updatedAt: DateTime.fromJSDate(now),
            }))
            await PostCustomFieldValue.createMany(rows, { client: trx })
          }
          // Duplicate modules (clone local modules; reuse global)
          const modules = await PostModule.query({ client: trx })
            .where('postId', post.id)
            .orderBy('orderIndex', 'asc')
            .preload('moduleInstance')

          for (const pm of modules) {
            const mi = pm.moduleInstance as any as ModuleInstance
            let targetModuleId = mi?.id

            if (String(mi?.scope) === 'post') {
              const createdMi = await ModuleInstance.create(
                {
                  id: randomUUID(),
                  scope: 'post',
                  type: String(mi.type),
                  globalSlug: null,
                  props: mi.props ?? {},
                },
                { client: trx }
              )
              targetModuleId = createdMi.id
            }

            await PostModule.create(
              {
                id: randomUUID(),
                postId: newPost.id,
                moduleId: targetModuleId!,
                orderIndex: Number(pm.orderIndex ?? 0),
                overrides: pm.overrides ?? null,
                locked: !!pm.locked,
              },
              { client: trx }
            )
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
            const existing = await UrlRedirect.query().where('fromPath', oldPath).first()
            if (!existing) {
              await UrlRedirect.create({
                fromPath: oldPath,
                toPath: newPath,
                httpStatus: 301,
                locale: p.locale,
                postId: p.id,
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

    if (action === 'publish') {
      const PromoteAiReviewToReview = (await import('#actions/posts/promote_ai_review_to_review'))
        .default
      const ApproveReviewDraft = (await import('#actions/posts/approve_review_draft')).default
      const posts = await Post.query().whereIn('id', uniqueIds)

      for (const post of posts) {
        // Recognition: if post has AI Review draft but no manual Review draft,
        // and Source is empty or it's a new AI-generated post, promote it.
        const hasArd = post.aiReviewDraft && Object.keys(post.aiReviewDraft).length > 0
        const hasRd = post.reviewDraft && Object.keys(post.reviewDraft).length > 0

        if (hasArd && !hasRd) {
          // Automatic promotion for AI-only content during bulk publish
          await PromoteAiReviewToReview.handle({ postId: post.id, userId: userId || post.userId })
          await ApproveReviewDraft.handle({ postId: post.id, userId: userId || post.userId })
        } else if (hasRd) {
          // If there's a manual review draft, approve it during bulk publish
          await ApproveReviewDraft.handle({ postId: post.id, userId: userId || post.userId })
        }
      }
    }

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
