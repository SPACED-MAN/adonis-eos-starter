import type { HttpContext } from '@adonisjs/core/http'
import SaveReviewDraft from '#actions/posts/save_review_draft'
import ApproveReviewDraft from '#actions/posts/approve_review_draft'
import RejectReviewDraft from '#actions/posts/reject_review_draft'
import Post from '#models/post'
import CreatePost, { CreatePostException } from '#actions/posts/create_post'
import UpdatePost, { UpdatePostException } from '#actions/posts/update_post'
import UpsertPostCustomFields from '#actions/posts/upsert_post_custom_fields'
import BulkPostsAction from '#actions/posts/bulk_action'
import db from '@adonisjs/lucid/services/db'
import authorizationService from '#services/authorization_service'
import RevisionService from '#services/revision_service'
import postTypeConfigService from '#services/post_type_config_service'
import webhookService from '#services/webhook_service'
import roleRegistry from '#services/role_registry'
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
      // Approvals don't need the full update payload; validate as little as possible.
      // This avoids 422s caused by empty-string fields (canonicalUrl/featuredImageId) when the
      // user is only trying to approve a draft.
      const requestedMode = String(request.input('mode') || '').toLowerCase()
      if (
        requestedMode === 'approve' ||
        requestedMode === 'approve-ai-review' ||
        requestedMode === 'reject-review' ||
        requestedMode === 'reject-ai-review'
      ) {
        const currentPost = await Post.findOrFail(id)
        const postType = currentPost.type
        if (requestedMode === 'approve') {
          if (!roleRegistry.hasPermission(role, 'posts.review.approve', postType)) {
            return this.response.forbidden(response, 'Not allowed to approve review')
          }
          return this.approveReviewDraft(id, auth, response)
        }
        if (!roleRegistry.hasPermission(role, 'posts.ai-review.approve', postType)) {
          return this.response.forbidden(response, 'Not allowed to approve AI review')
        }
        if (requestedMode === 'approve-ai-review') {
          return this.approveAiReviewDraft(id, auth, response)
        }
        if (requestedMode === 'reject-ai-review') {
          return this.rejectAiReviewDraft(id, auth, response)
        }
        // reject-review
        return this.rejectReviewDraft(id, auth, response)
      }

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
      })

      // Handle timestamps
      const now = new Date()
      if (payload.status === 'published') {
        await db
          .from('posts')
          .where('id', id)
          .update({ published_at: now, scheduled_at: null, updated_at: now })
      } else if (payload.status === 'scheduled' && payload.scheduledAt) {
        const ts = new Date(payload.scheduledAt)
        if (!isNaN(ts.getTime())) {
          await db.from('posts').where('id', id).update({ scheduled_at: ts, updated_at: now })
        }
      } else if (payload.status === 'draft') {
        await db.from('posts').where('id', id).update({ scheduled_at: null, updated_at: now })
      }

      // Update custom fields
      if (Array.isArray(payload.customFields)) {
        await UpsertPostCustomFields.handle({
          postId: id,
          customFields: payload.customFields,
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
    await ApproveReviewDraft.handle({
      postId: id,
      userId: auth.user!.id,
    })
    return response.ok({ message: 'Review promoted to Source' })
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
    const ard: any = current.aiReviewDraft

    if (!ard) {
      return this.response.badRequest(response, 'No AI review draft to approve')
    }

    await SaveReviewDraft.handle({
      postId: id,
      payload: ard,
      userId: auth.user!.id,
      userEmail: (auth.use('web').user as any)?.email || null,
      mode: 'review',
    })

    await Post.query().where('id', id).update({ ai_review_draft: null } as any)

    // Preserve agent execution history
    try {
      const agentExecutionService = await import('#services/agent_execution_service')
      await agentExecutionService.default.promoteAiReviewToReview(id)
    } catch {}

    return response.ok({ message: 'AI Review promoted to Review' })
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
