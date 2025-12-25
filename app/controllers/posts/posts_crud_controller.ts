import type { HttpContext } from '@adonisjs/core/http'
import SaveReviewDraft from '#actions/posts/save_review_draft'
import PromoteAiReviewToReview from '#actions/posts/promote_ai_review_to_review'
import ApproveReviewDraft from '#actions/posts/approve_review_draft'
import RejectReviewDraft from '#actions/posts/reject_review_draft'
import Post from '#models/post'
import CreatePost, { CreatePostException } from '#actions/posts/create_post'
import CreateVariation from '#actions/posts/create_variation'
import PromoteVariation from '#actions/posts/promote_variation'
import DeleteVariation from '#actions/posts/delete_variation'
import UpdatePost, { UpdatePostException } from '#actions/posts/update_post'
import UpsertPostCustomFields from '#actions/posts/upsert_post_custom_fields'
import BulkPostsAction from '#actions/posts/bulk_action'
import db from '@adonisjs/lucid/services/db'
import authorizationService from '#services/authorization_service'
import RevisionService from '#services/revision_service'
import postTypeConfigService from '#services/post_type_config_service'
import webhookService from '#services/webhook_service'
import roleRegistry from '#services/role_registry'
import { coerceJsonObject } from '../../helpers/jsonb.js'
import BasePostsController from './base_posts_controller.js'
import {
  createPostValidator,
  updatePostValidator,
  bulkActionValidator,
  reorderPostsValidator,
} from '#validators/post'

/**
 * Posts CRUD Controller
 *
 * Handles create, update, delete operations for posts.
 */
export default class PostsCrudController extends BasePostsController {
  /**
   * POST /api/posts
   * Create a new post
   */
  async store({ request, response, auth }: HttpContext) {
    const role = (auth.use('web').user as any)?.role as
      | 'admin'
      | 'editor'
      | 'translator'
      | undefined

    if (!authorizationService.canCreatePost(role, (request.all() as any)?.type)) {
      return this.response.forbidden(response, 'Not allowed to create posts')
    }

    try {
      const payload = await request.validateUsing(createPostValidator)

      const post = await CreatePost.handle({
        type: payload.type,
        locale: payload.locale,
        slug: payload.slug,
        title: payload.title,
        status: payload.status,
        excerpt: payload.excerpt,
        metaTitle: payload.metaTitle,
        metaDescription: payload.metaDescription,
        moduleGroupId: (payload as any).moduleGroupId,
        userId: auth.user!.id,
      })

      // Log activity
      try {
        const activityService = (await import('#services/activity_log_service')).default
        await activityService.log({
          action: 'post.create',
          userId: auth.user?.id ?? null,
          entityType: 'post',
          entityId: post.id,
          metadata: { type: payload.type, locale: payload.locale, slug: payload.slug },
        })
      } catch {
        /* ignore */
      }

      // Dispatch webhook
      await webhookService.dispatch('post.created', {
        id: post.id,
        type: post.type,
        locale: post.locale,
        slug: post.slug,
        title: post.title,
      })

      return this.response.created(
        response,
        {
          id: post.id,
          type: post.type,
          locale: post.locale,
          slug: post.slug,
          title: post.title,
          status: post.status,
          createdAt: post.createdAt,
        },
        'Post created successfully'
      )
    } catch (error) {
      if (error instanceof CreatePostException) {
        return this.handleActionException(response, error)
      }
      throw error
    }
  }

  /**
   * PUT /api/posts/:id
   * Update an existing post
   */
  async update({ params, request, response, auth }: HttpContext) {
    const { id } = params
    const role = (auth.use('web').user as any)?.role as
      | 'admin'
      | 'editor'
      | 'translator'
      | undefined

    try {
      const requestedMode = String(request.input('mode') || '').toLowerCase()
      console.log(`[PostsCrudController.update] ID: ${id}, Mode: ${requestedMode}`)

      if (
        requestedMode === 'approve' ||
        requestedMode === 'approve-ai-review' ||
        requestedMode === 'reject-review' ||
        requestedMode === 'reject-ai-review'
      ) {
        console.log(`[PostsCrudController.update] Routing to decision: ${requestedMode}`)
        const currentPost = await Post.findOrFail(id)
        const postType = currentPost.type

        if (requestedMode === 'approve') {
          if (!roleRegistry.hasPermission(role, 'posts.review.approve', postType)) {
            console.log(`[PostsCrudController.update] Permission denied for approve`)
            return this.response.forbidden(response, 'Not allowed to approve review')
          }
          return this.approveReviewDraft(id, auth, response)
        }

        if (requestedMode === 'approve-ai-review') {
          if (!roleRegistry.hasPermission(role, 'posts.ai-review.approve', postType)) {
            console.log(`[PostsCrudController.update] Permission denied for approve-ai-review`)
            return this.response.forbidden(response, 'Not allowed to approve AI review')
          }
          return this.approveAiReviewDraft(id, auth, response)
        }

        if (requestedMode === 'reject-review') {
          if (!roleRegistry.hasPermission(role, 'posts.review.approve', postType)) {
            console.log(`[PostsCrudController.update] Permission denied for reject-review`)
            return this.response.forbidden(response, 'Not allowed to reject review')
          }
          return this.rejectReviewDraft(id, auth, response)
        }

        if (requestedMode === 'reject-ai-review') {
          if (!roleRegistry.hasPermission(role, 'posts.ai-review.approve', postType)) {
            console.log(`[PostsCrudController.update] Permission denied for reject-ai-review`)
            return this.response.forbidden(response, 'Not allowed to reject AI review')
          }
          return this.rejectAiReviewDraft(id, auth, response)
        }
      }

      console.log(`[PostsCrudController.update] Standard update path`)
      const payload = await request.validateUsing(updatePostValidator)
      const saveMode = String(payload.mode || 'publish').toLowerCase()
      const currentPost = await Post.findOrFail(id)
      const postType = currentPost.type

      // Handle review mode
      if (saveMode === 'review') {
        if (!roleRegistry.hasPermission(role, 'posts.review.save', postType)) {
          return this.response.forbidden(response, 'Not allowed to save for review')
        }
        return this.saveReviewDraft(id, payload, auth, response)
      }

      // Handle AI review mode
      if (saveMode === 'ai-review') {
        if (!roleRegistry.hasPermission(role, 'posts.ai-review.save', postType)) {
          return this.response.forbidden(response, 'Not allowed to save for AI review')
        }
        return this.saveAiReviewDraft(id, payload, auth, response)
      }

      // Handle approve mode
      if (saveMode === 'approve') {
        if (!roleRegistry.hasPermission(role, 'posts.review.approve', postType)) {
          return this.response.forbidden(response, 'Not allowed to approve review')
        }
        return this.approveReviewDraft(id, auth, response)
      }

      // Handle approve AI review mode
      if (saveMode === 'approve-ai-review') {
        if (!roleRegistry.hasPermission(role, 'posts.ai-review.approve', postType)) {
          return this.response.forbidden(response, 'Not allowed to approve AI review')
        }
        return this.approveAiReviewDraft(id, auth, response)
      }
      // Handle reject review mode
      if (saveMode === 'reject-review') {
        if (!roleRegistry.hasPermission(role, 'posts.review.approve', postType)) {
          return this.response.forbidden(response, 'Not allowed to reject review')
        }
        return this.rejectReviewDraft(id, auth, response)
      }
      // Handle reject AI review mode
      if (saveMode === 'reject-ai-review') {
        if (!roleRegistry.hasPermission(role, 'posts.ai-review.approve', postType)) {
          return this.response.forbidden(response, 'Not allowed to reject AI review')
        }
        return this.rejectAiReviewDraft(id, auth, response)
      }

      // Authorization check for status changes
      if (!authorizationService.canUpdateStatus(role, payload.status, postType)) {
        return this.response.forbidden(response, 'Not allowed to set this status')
      }

      // Parse JSON fields
      const robotsJson = this.parseJsonField(payload.robotsJson)
      const jsonldOverrides = this.parseJsonField(payload.jsonldOverrides)

      // Enforce hierarchy rules
      if (payload.parentId !== undefined) {
        const enabled = postTypeConfigService.getUiConfig(currentPost.type).hierarchyEnabled
        if (!enabled && payload.parentId) {
          return this.response.badRequest(response, 'Hierarchy is disabled for this post type')
        }
      }

      await UpdatePost.handle({
        postId: id,
        slug: payload.slug,
        title: payload.title,
        status: payload.status,
        excerpt: payload.excerpt,
        parentId: payload.parentId || undefined,
        orderIndex: payload.orderIndex,
        metaTitle: payload.metaTitle,
        metaDescription: payload.metaDescription,
        canonicalUrl: payload.canonicalUrl,
        robotsJson,
        jsonldOverrides,
        // Featured image: support optional update when provided by the editor
        featuredImageId:
          payload.featuredImageId !== undefined
            ? payload.featuredImageId === null || payload.featuredImageId === ''
              ? null
              : payload.featuredImageId
            : undefined,
        taxonomyTermIds: Array.isArray((payload as any).taxonomyTermIds)
          ? ((payload as any).taxonomyTermIds as string[])
          : undefined,
        scheduledAt: (payload as any).scheduledAt,
      })

      // Update custom fields
      const customFields = payload.customFields || request.input('customFields')
      if (Array.isArray(customFields)) {
        await UpsertPostCustomFields.handle({
          postId: id,
          customFields,
        })
      }

      // Record revision (captures all active versions + module staging)
      await RevisionService.recordActiveVersionsSnapshot({
        postId: id,
        mode: 'source',
        action: 'save-source',
        userId: auth.user?.id,
      })

      // Log activity
      try {
        const activityService = (await import('#services/activity_log_service')).default
        await activityService.log({
          action: 'post.update',
          userId: auth.user?.id ?? null,
          entityType: 'post',
          entityId: id,
        })
      } catch {
        /* ignore */
      }

      // Dispatch webhook
      await webhookService.dispatch('post.updated', { id })
      if (payload.status === 'published' && currentPost.status !== 'published') {
        await webhookService.dispatch('post.published', { id })
      }

      return response.ok({ message: 'Post updated successfully', id })
    } catch (error) {
      if (error instanceof UpdatePostException) {
        return this.handleActionException(response, error)
      }
      throw error
    }
  }

  /**
   * DELETE /api/posts/:id
   * Delete a post (soft delete if enabled)
   */
  async destroy({ params, response, auth }: HttpContext) {
    const { id } = params
    const post = await Post.find(id)

    if (!post) {
      return this.response.notFound(response, 'Post not found')
    }

    const role = (auth.use('web').user as any)?.role
    if (!authorizationService.canDeletePosts(role, post.type)) {
      return this.response.forbidden(response, 'Not allowed to delete posts')
    }

    if (post.status !== 'archived') {
      return this.response.badRequest(response, 'Only archived posts can be deleted')
    }

    // Soft delete
    await post.softDelete()

    // Log activity
    try {
      const activityService = (await import('#services/activity_log_service')).default
      await activityService.log({
        action: 'post.delete',
        userId: auth.user?.id ?? null,
        entityType: 'post',
        entityId: id,
        metadata: { type: post.type, slug: post.slug, locale: post.locale },
      })
    } catch {
      /* ignore */
    }

    // Dispatch webhook
    await webhookService.dispatch('post.deleted', { id, type: post.type, slug: post.slug })

    return this.response.noContent(response)
  }

  /**
   * POST /api/posts/:id/restore
   * Restore a soft-deleted post
   */
  async restore({ params, response, auth }: HttpContext) {
    const { id } = params

    // Temporarily include deleted posts
    Post.softDeleteEnabled = false
    const post = await Post.find(id)
    Post.softDeleteEnabled = true

    if (!post) {
      return this.response.notFound(response, 'Post not found')
    }

    if (!post.isDeleted) {
      return this.response.badRequest(response, 'Post is not deleted')
    }

    await post.restore()

    // Log activity
    try {
      const activityService = (await import('#services/activity_log_service')).default
      await activityService.log({
        action: 'post.restore',
        userId: auth.user?.id ?? null,
        entityType: 'post',
        entityId: id,
      })
    } catch {
      /* ignore */
    }

    // Dispatch webhook
    await webhookService.dispatch('post.restored', { id })

    return response.ok({ message: 'Post restored' })
  }

  /**
   * POST /api/posts/bulk
   * Perform bulk actions on posts
   */
  async bulk({ request, response, auth }: HttpContext) {
    const role = (auth.use('web').user as any)?.role as
      | 'admin'
      | 'editor'
      | 'translator'
      | undefined

    try {
      const payload = await request.validateUsing(bulkActionValidator)

      const result = await BulkPostsAction.handle({
        action: payload.action as any,
        ids: payload.ids,
        role,
      })

      // Log activity
      try {
        const activityService = (await import('#services/activity_log_service')).default
        await activityService.log({
          action: `post.bulk.${payload.action}`,
          userId: auth.user?.id ?? null,
          entityType: 'post',
          entityId: 'bulk',
          metadata: { count: payload.ids.length },
        })
      } catch {
        /* ignore */
      }

      return response.ok(result)
    } catch (error: any) {
      return this.handleActionException(response, error)
    }
  }

  /**
   * POST /api/posts/reorder
   * Bulk update order_index for posts
   */
  async reorder({ request, response, auth }: HttpContext) {
    const role = (auth.use('web').user as any)?.role as
      | 'admin'
      | 'editor'
      | 'translator'
      | undefined

    if (!authorizationService.canPublishOrArchive(role)) {
      return this.response.forbidden(response, 'Not allowed to reorder posts')
    }

    try {
      const payload = await request.validateUsing(reorderPostsValidator)
      const { scope, items } = payload

      const now = new Date()

      await db.transaction(async (trx) => {
        // Validate all items belong to the same scope
        const ids = items.map((i) => i.id)
        const rows = await trx.from('posts').whereIn('id', ids)
        const idToRow = new Map(rows.map((r: any) => [r.id, r]))

        for (const item of items) {
          const row = idToRow.get(item.id)
          if (!row) {
            throw new Error(`Post not found: ${item.id}`)
          }
          if (row.type !== scope.type || row.locale !== scope.locale) {
            throw new Error('Reorder items must match scope type/locale')
          }
        }

        // Update each item
        for (const item of items) {
          const update: any = { order_index: item.orderIndex, updated_at: now }
          if (item.parentId !== undefined) {
            update.parent_id = item.parentId
          }
          await trx.from('posts').where('id', item.id).update(update)
        }
      })

      // Log activity
      try {
        const activityService = (await import('#services/activity_log_service')).default
        await activityService.log({
          action: 'post.reorder',
          userId: auth.user?.id ?? null,
          entityType: 'post',
          entityId: 'bulk',
          metadata: { count: items.length },
        })
      } catch {
        /* ignore */
      }

      return response.ok({ updated: items.length })
    } catch (error: any) {
      return this.response.badRequest(response, error.message || 'Failed to reorder posts')
    }
  }

  /**
   * PATCH /api/posts/:id/author
   * Reassign post author (admin only)
   */
  async updateAuthor({ params, request, response }: HttpContext) {
    const { id } = params
    const authorIdRaw = request.input('authorId')
    const authorId = Number(authorIdRaw)

    if (!authorId || Number.isNaN(authorId)) {
      return this.response.badRequest(response, 'authorId must be a valid user id')
    }

    const post = await Post.find(id)
    if (!post) {
      return this.response.notFound(response, 'Post not found')
    }

    // Check target user exists
    const exists = await db.from('users').where('id', authorId).first()
    if (!exists) {
      return this.response.notFound(response, 'User not found')
    }

    // Prevent multiple profiles per user
    if (post.type === 'profile') {
      const existing = await db
        .from('posts')
        .where({ type: 'profile', author_id: authorId })
        .andWhereNot('id', id)
        .first()
      if (existing) {
        return this.response.conflict(response, 'Target user already has a profile')
      }
    }

    await db.from('posts').where('id', id).update({ author_id: authorId, updated_at: new Date() })

    return response.ok({ message: 'Author updated' })
  }

  /**
   * POST /api/posts/:id/variations
   * Create a new variation (B) from an existing post (A).
   */
  async createVariation({ params, request, response, auth }: HttpContext) {
    const { id } = params
    const { variation } = request.only(['variation']) as { variation: string }

    if (!variation) {
      return this.response.badRequest(response, 'Variation identifier is required')
    }

    try {
      const newPost = await CreateVariation.handle({
        sourcePostId: id,
        variation,
        userId: auth.user!.id,
      })

      return response.created({
        id: newPost.id,
        variation: newPost.abVariation,
        message: `Variation ${variation} created successfully`,
      })
    } catch (error: any) {
      return this.response.badRequest(response, error.message || 'Failed to create variation')
    }
  }

  /**
   * POST /api/posts/:id/promote-variation
   * Promote a variation to be the main post (ends A/B test).
   */
  async promoteVariation({ params, response, auth }: HttpContext) {
    const { id } = params

    try {
      const post = await PromoteVariation.handle({
        postId: id,
        userId: auth.user!.id,
      })

      return response.ok({
        id: post.id,
        message: 'Variation promoted successfully. A/B test has ended.',
      })
    } catch (error: any) {
      return response.badRequest({ error: error.message || 'Failed to promote variation' })
    }
  }

  /**
   * DELETE /api/posts/:id/variation
   * Delete a single variation from an A/B test.
   */
  async deleteVariation({ params, response, auth }: HttpContext) {
    const { id } = params

    try {
      const result = await DeleteVariation.handle({
        postId: id,
        userId: auth.user!.id,
      })

      return response.ok(result)
    } catch (error: any) {
      return response.badRequest({ error: error.message || 'Failed to delete variation' })
    }
  }

  /**
   * GET /api/posts/:id/ab-stats
   * Get A/B testing stats for a post and its variations
   */
  async getAbStats({ params, response }: HttpContext) {
    const { id } = params
    const post = await Post.find(id)
    if (!post) {
      return this.response.notFound(response, 'Post not found')
    }

    const abGroupId = post.abGroupId || post.id

    // Get views per variation
    const views = await db
      .from('post_variation_views')
      .where('ab_group_id', abGroupId)
      .select('ab_variation')
      .count('* as count')
      .groupBy('ab_variation')

    // Get submissions per variation
    const submissions = await db
      .from('form_submissions')
      .where('ab_group_id', abGroupId)
      .select('ab_variation')
      .count('* as count')
      .groupBy('ab_variation')

    const stats: Record<string, { views: number; submissions: number; conversionRate: number }> = {}

    // Initialize with variations from config if possible
    const uiConfig = postTypeConfigService.getUiConfig(post.type)
    const variations = uiConfig.abTesting.variations || []

    // We should also look at actual variations in the DB for this group
    const dbVariations = await Post.query().where('abGroupId', abGroupId).select('ab_variation')
    const labels = new Set([
      ...variations.map((v) => v.value),
      ...(dbVariations.map((v) => v.abVariation).filter(Boolean) as string[]),
      'A', // fallback
    ])

    for (const label of labels) {
      stats[label] = { views: 0, submissions: 0, conversionRate: 0 }
    }

    views.forEach((v: any) => {
      const label = v.ab_variation || 'A'
      if (!stats[label]) {
        stats[label] = { views: 0, submissions: 0, conversionRate: 0 }
      }
      stats[label].views = parseInt(v.count)
    })

    submissions.forEach((s: any) => {
      const label = s.ab_variation || 'A'
      if (!stats[label]) {
        stats[label] = { views: 0, submissions: 0, conversionRate: 0 }
      }
      stats[label].submissions = parseInt(s.count)
    })

    // Calculate rates
    Object.keys(stats).forEach((label) => {
      const s = stats[label]
      if (s.views > 0) {
        s.conversionRate = (s.submissions / s.views) * 100
      }
    })

    return response.ok({ data: stats })
  }

  // Private helper methods

  private async saveReviewDraft(
    id: string,
    payload: any,
    auth: HttpContext['auth'],
    response: HttpContext['response']
  ) {
    await SaveReviewDraft.handle({
      postId: id,
      payload,
      userId: auth.user!.id,
      userEmail: (auth.use('web').user as any)?.email || null,
      mode: 'review',
    })
    return response.ok({ message: 'Saved for review' })
  }

  private async approveReviewDraft(
    id: string,
    auth: HttpContext['auth'],
    response: HttpContext['response']
  ) {
    const current = await Post.findOrFail(id)
    const rd = coerceJsonObject(current.reviewDraft)

    // Check if there are any Review changes (post-level or module-level)
    const hasPostDraft = Object.keys(rd).length > 0
    const hasModuleChanges = await db
      .from('module_instances')
      .whereIn('id', db.from('post_modules').where('post_id', id).select('module_id'))
      .whereNotNull('review_props')
      .first()
    const hasJoinChanges = await db
      .from('post_modules')
      .where('post_id', id)
      .where((q) =>
        q
          .whereNotNull('review_overrides')
          .orWhere('review_added', true)
          .orWhere('review_deleted', true)
      )
      .first()

    // Relaxed check: if the column exists in DB, we'll try to promote.
    // We only block if we are CERTAIN there is nothing.
    const hasAnyDraftData = hasPostDraft || !!hasModuleChanges || !!hasJoinChanges

    if (!hasAnyDraftData) {
      return response.ok({ message: 'No review changes found to promote', promoted: false })
    }

    await ApproveReviewDraft.handle({
      postId: id,
      userId: auth.user!.id,
    })
    return response.ok({ message: 'Review promoted to Source', promoted: true })
  }

  private async saveAiReviewDraft(
    id: string,
    payload: any,
    auth: HttpContext['auth'],
    response: HttpContext['response']
  ) {
    await SaveReviewDraft.handle({
      postId: id,
      payload,
      userId: auth.user!.id,
      userEmail: 'AI Agent',
      mode: 'ai-review',
    })
    return response.ok({ message: 'Saved to AI Review' })
  }

  private async approveAiReviewDraft(
    id: string,
    auth: HttpContext['auth'],
    response: HttpContext['response']
  ) {
    const current = await Post.findOrFail(id)
    const ard = coerceJsonObject(current.aiReviewDraft)

    // Check if there are any AI Review changes (post-level or module-level)
    const hasPostDraft = Object.keys(ard).length > 0
    const hasModuleChanges = await db
      .from('module_instances')
      .whereIn('id', db.from('post_modules').where('post_id', id).select('module_id'))
      .whereNotNull('ai_review_props')
      .first()
    const hasJoinChanges = await db
      .from('post_modules')
      .where('post_id', id)
      .where((q) =>
        q
          .whereNotNull('ai_review_overrides')
          .orWhere('ai_review_added', true)
          .orWhere('ai_review_deleted', true)
      )
      .first()

    // Relaxed check: if the column exists in DB, we'll try to promote.
    // We only block if we are CERTAIN there is nothing.
    const hasAnyDraftData = hasPostDraft || !!hasModuleChanges || !!hasJoinChanges

    if (!hasAnyDraftData) {
      return response.ok({ message: 'No AI review changes found to promote', promoted: false })
    }

    await PromoteAiReviewToReview.handle({
      postId: id,
      userId: auth.user!.id,
      userEmail: (auth.use('web').user as any)?.email || null,
    })

    return response.ok({ message: 'AI Review promoted to Review', promoted: true })
  }

  private async rejectReviewDraft(
    postId: string,
    auth: HttpContext['auth'],
    response: HttpContext['response']
  ) {
    await RejectReviewDraft.handle({
      postId,
      userId: auth.user!.id,
      mode: 'review',
    })
    return response.ok({ message: 'Review discarded' })
  }

  private async rejectAiReviewDraft(
    postId: string,
    auth: HttpContext['auth'],
    response: HttpContext['response']
  ) {
    await RejectReviewDraft.handle({
      postId,
      userId: auth.user!.id,
      mode: 'ai-review',
    })
    return response.ok({ message: 'AI Review discarded' })
  }
}
