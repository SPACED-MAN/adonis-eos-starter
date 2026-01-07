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
import deletePostAction from '#actions/posts/delete_post_action'
import restorePostAction from '#actions/posts/restore_post_action'
import reorderPostsAction from '#actions/posts/reorder_posts_action'
import updatePostAuthorAction from '#actions/posts/update_post_author_action'
import getPostAbStatsAction from '#actions/posts/get_post_ab_stats_action'
import db from '@adonisjs/lucid/services/db'
import authorizationService from '#services/authorization_service'
import RevisionService from '#services/revision_service'
import postTypeConfigService from '#services/post_type_config_service'
import roleRegistry from '#services/role_registry'
import { generateProfileTitleFromCustomFields } from '#helpers/post_helpers'
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
        noindex: payload.noindex,
        nofollow: payload.nofollow,
        robotsJson: payload.robotsJson,
        moduleGroupId: (payload as any).moduleGroupId,
        userId: auth.user!.id,
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

      // Handle decision modes EARLY before full validation
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

        if (requestedMode === 'approve-ai-review') {
          if (!roleRegistry.hasPermission(role, 'posts.ai-review.approve', postType)) {
            return this.response.forbidden(response, 'Not allowed to approve AI review')
          }
          return this.approveAiReviewDraft(id, auth, response)
        }

        if (requestedMode === 'reject-review') {
          if (!roleRegistry.hasPermission(role, 'posts.review.approve', postType)) {
            return this.response.forbidden(response, 'Not allowed to reject review')
          }
          return this.rejectReviewDraft(id, auth, response)
        }

        if (requestedMode === 'reject-ai-review') {
          if (!roleRegistry.hasPermission(role, 'posts.ai-review.approve', postType)) {
            return this.response.forbidden(response, 'Not allowed to reject AI review')
          }
          return this.rejectAiReviewDraft(id, auth, response)
        }
      }

      const payload = await request.validateUsing(updatePostValidator)
      const saveMode = String(payload.mode || requestedMode || 'publish').toLowerCase()
      const currentPost = await Post.findOrFail(id)
      const postType = currentPost.type

      // Handle draft save modes
      if (saveMode === 'review') {
        if (!roleRegistry.hasPermission(role, 'posts.review.save', postType)) {
          return this.response.forbidden(response, 'Not allowed to save for review')
        }
        return this.saveReviewDraft(id, payload, auth, response)
      }

      if (saveMode === 'ai-review') {
        if (!roleRegistry.hasPermission(role, 'posts.ai-review.save', postType)) {
          return this.response.forbidden(response, 'Not allowed to save for AI review')
        }
        return this.saveAiReviewDraft(id, payload, auth, response)
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

      let title = payload.title
      const customFields = payload.customFields || request.input('customFields')

      // Auto-sync profile title if needed
      if (currentPost.type === 'profile' && Array.isArray(customFields)) {
        const syncedTitle = generateProfileTitleFromCustomFields(customFields)
        if (syncedTitle) {
          title = syncedTitle
        }
      }

      await UpdatePost.handle({
        postId: id,
        slug: payload.slug,
        title,
        status: payload.status,
        excerpt: payload.excerpt,
        parentId: payload.parentId || undefined,
        orderIndex: payload.orderIndex,
        metaTitle: payload.metaTitle,
        metaDescription: payload.metaDescription,
        socialTitle: (payload as any).socialTitle,
        socialDescription: (payload as any).socialDescription,
        socialImageId: (payload as any).socialImageId,
        noindex: (payload as any).noindex,
        nofollow: (payload as any).nofollow,
        canonicalUrl: payload.canonicalUrl,
        robotsJson,
        jsonldOverrides,
        // Featured media: support optional update when provided by the editor
        featuredMediaId:
          payload.featuredMediaId !== undefined
            ? payload.featuredMediaId === null || payload.featuredMediaId === ''
              ? null
              : payload.featuredMediaId
            : undefined,
        taxonomyTermIds: Array.isArray((payload as any).taxonomyTermIds)
          ? ((payload as any).taxonomyTermIds as string[])
          : undefined,
        scheduledAt: (payload as any).scheduledAt,
      })

      // Update custom fields
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

    try {
      await deletePostAction.handle({ id, userId: auth.user?.id })
      return this.response.noContent(response)
    } catch (error: any) {
      return this.response.badRequest(response, error.message || 'Delete failed')
    }
  }

  /**
   * POST /api/posts/:id/restore
   * Restore a soft-deleted post
   */
  async restore({ params, response, auth }: HttpContext) {
    try {
      await restorePostAction.handle({ id: params.id, userId: auth.user?.id })
      return response.ok({ message: 'Post restored' })
    } catch (error: any) {
      return this.response.badRequest(response, error.message || 'Restore failed')
    }
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
        userId: auth.user?.id,
      })

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
      const result = await reorderPostsAction.handle({
        scope: payload.scope,
        items: payload.items,
        userId: auth.user?.id,
      })
      return response.ok(result)
    } catch (error: any) {
      return this.response.badRequest(response, error.message || 'Failed to reorder posts')
    }
  }

  /**
   * PATCH /api/posts/:id/author
   * Reassign post author (admin only)
   */
  async updateAuthor({ params, request, response, auth }: HttpContext) {
    const { id } = params
    const authorId = Number(request.input('authorId'))

    if (!authorId || Number.isNaN(authorId)) {
      return this.response.badRequest(response, 'authorId must be a valid user id')
    }

    try {
      await updatePostAuthorAction.handle({
        postId: id,
        authorId,
        userId: auth.user?.id,
      })
      return response.ok({ message: 'Author updated' })
    } catch (error: any) {
      return this.response.badRequest(response, error.message || 'Failed to update author')
    }
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
    try {
      const stats = await getPostAbStatsAction.handle({ postId: params.id })
      return response.ok({ data: stats })
    } catch (error: any) {
      return this.response.badRequest(response, error.message || 'Failed to get stats')
    }
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
