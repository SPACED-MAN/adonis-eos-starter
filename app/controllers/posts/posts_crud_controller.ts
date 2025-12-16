import type { HttpContext } from '@adonisjs/core/http'
import Post from '#models/post'
import CreatePost, { CreatePostException } from '#actions/posts/create_post'
import UpdatePost, { UpdatePostException } from '#actions/posts/update_post'
import BulkPostsAction from '#actions/posts/bulk_action'
import db from '@adonisjs/lucid/services/db'
import authorizationService from '#services/authorization_service'
import RevisionService from '#services/revision_service'
import postTypeConfigService from '#services/post_type_config_service'
import webhookService from '#services/webhook_service'
import roleRegistry from '#services/role_registry'
import taxonomyService from '#services/taxonomy_service'
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

      // Debug: log raw input before validation
      console.log('[PostsCrudController] Raw update input:', {
        canonicalUrl: request.input('canonicalUrl'),
        canonicalUrlType: typeof request.input('canonicalUrl'),
        featuredImageId: request.input('featuredImageId'),
        parentId: request.input('parentId'),
      })

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
        await this.upsertCustomFields(id, payload.customFields)
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
    const draftPayload: Record<string, any> = {
      slug: payload.slug,
      title: payload.title,
      status: payload.status,
      excerpt: payload.excerpt,
      parentId: payload.parentId,
      orderIndex: payload.orderIndex,
      metaTitle: payload.metaTitle,
      metaDescription: payload.metaDescription,
      canonicalUrl: payload.canonicalUrl,
      robotsJson: payload.robotsJson,
      jsonldOverrides: payload.jsonldOverrides,
      featuredImageId: payload.featuredImageId,
      customFields: payload.customFields,
      taxonomyTermIds: Array.isArray((payload as any).taxonomyTermIds)
        ? ((payload as any).taxonomyTermIds as string[])
        : undefined,
      savedAt: new Date().toISOString(),
      savedBy: (auth.use('web').user as any)?.email || null,
    }

    await Post.query()
      .where('id', id)
      .update({ review_draft: draftPayload } as any)

    // Promote AI Review module content to Review when saving for review
    // This ensures that any AI Review edits (including inline edits) are available in Review mode
    await this.promoteAiReviewModulesToReview(id)

    await RevisionService.recordActiveVersionsSnapshot({
      postId: id,
      mode: 'review',
      action: 'save-review',
      userId: (auth.use('web').user as any)?.id,
    })

    return response.ok({ message: 'Saved for review' })
  }

  private async approveReviewDraft(
    id: string,
    auth: HttpContext['auth'],
    response: HttpContext['response']
  ) {
    const current = await Post.findOrFail(id)
    const rd: any = current.reviewDraft

    if (!rd) {
      return this.response.badRequest(response, 'No review draft to approve')
    }

    await UpdatePost.handle({
      postId: id,
      slug: rd.slug ?? current.slug,
      title: rd.title ?? current.title,
      status: current.status,
      excerpt: rd.excerpt ?? current.excerpt,
      parentId: rd.parentId ?? current.parentId ?? undefined,
      metaTitle: rd.metaTitle ?? current.metaTitle,
      metaDescription: rd.metaDescription ?? current.metaDescription,
      canonicalUrl: rd.canonicalUrl ?? current.canonicalUrl,
      robotsJson: this.parseJsonField(rd.robotsJson) ?? current.robotsJson,
      jsonldOverrides: this.parseJsonField(rd.jsonldOverrides) ?? current.jsonldOverrides,
      featuredImageId:
        rd.featuredImageId !== undefined
          ? rd.featuredImageId === null || rd.featuredImageId === ''
            ? null
            : rd.featuredImageId
          : current.featuredImageId,
    })

    // Promote custom fields
    if (Array.isArray(rd.customFields)) {
      await this.upsertCustomFields(id, rd.customFields)
    }

    // Promote module changes
    await this.promoteModuleChanges(id)

    // Promote taxonomy term assignments (if present in review draft)
    if (Array.isArray((rd as any).taxonomyTermIds)) {
      const termIds = ((rd as any).taxonomyTermIds as any[]).map((x) => String(x))
      const applied = await this.applyTaxonomyAssignments(id, current.type, termIds)
      if (!applied.ok) {
        return this.response.badRequest(response, applied.error || 'Invalid taxonomy assignments')
      }
    }

    // Clear review draft
    await Post.query()
      .where('id', id)
      .update({ review_draft: null } as any)

    await RevisionService.recordActiveVersionsSnapshot({
      postId: id,
      mode: 'source',
      action: 'approve-review-to-source',
      userId: (auth.use('web').user as any)?.id,
    })

    return response.ok({ message: 'Review promoted to Source' })
  }

  private async saveAiReviewDraft(
    id: string,
    payload: any,
    auth: HttpContext['auth'],
    response: HttpContext['response']
  ) {
    const draftPayload: Record<string, any> = {
      slug: payload.slug,
      title: payload.title,
      status: payload.status,
      excerpt: payload.excerpt,
      parentId: payload.parentId,
      orderIndex: payload.orderIndex,
      metaTitle: payload.metaTitle,
      metaDescription: payload.metaDescription,
      canonicalUrl: payload.canonicalUrl,
      robotsJson: payload.robotsJson,
      jsonldOverrides: payload.jsonldOverrides,
      featuredImageId: payload.featuredImageId,
      customFields: payload.customFields,
      taxonomyTermIds: Array.isArray((payload as any).taxonomyTermIds)
        ? ((payload as any).taxonomyTermIds as string[])
        : undefined,
      savedAt: new Date().toISOString(),
      savedBy: 'AI Agent',
    }

    await Post.query()
      .where('id', id)
      .update({ ai_review_draft: draftPayload } as any)

    await RevisionService.recordActiveVersionsSnapshot({
      postId: id,
      mode: 'ai-review',
      action: 'save-ai-review',
      userId: (auth.use('web').user as any)?.id,
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

    // Instead of promoting to Source, promote to review_draft
    const reviewPayload: Record<string, any> = {
      slug: ard.slug ?? current.slug,
      title: ard.title ?? current.title,
      status: ard.status ?? current.status,
      excerpt: ard.excerpt ?? current.excerpt,
      parentId: ard.parentId ?? current.parentId,
      orderIndex: ard.orderIndex ?? current.orderIndex,
      metaTitle: ard.metaTitle ?? current.metaTitle,
      metaDescription: ard.metaDescription ?? current.metaDescription,
      canonicalUrl: ard.canonicalUrl ?? current.canonicalUrl,
      robotsJson: ard.robotsJson ?? current.robotsJson,
      jsonldOverrides: ard.jsonldOverrides ?? current.jsonldOverrides,
      featuredImageId:
        ard.featuredImageId !== undefined
          ? ard.featuredImageId === null || ard.featuredImageId === ''
            ? null
            : ard.featuredImageId
          : current.featuredImageId,
      customFields: ard.customFields ?? [],
      savedAt: new Date().toISOString(),
      savedBy: (auth.use('web').user as any)?.email || null,
    }

    // Promote AI review modules to review modules
    await this.promoteAiReviewModulesToReview(id)

    // Update review_draft with AI review content
    await Post.query()
      .where('id', id)
      .update({
        review_draft: reviewPayload,
        ai_review_draft: null,
      } as any)

    await RevisionService.recordActiveVersionsSnapshot({
      postId: id,
      mode: 'review',
      action: 'promote-ai-review-to-review',
      userId: (auth.use('web').user as any)?.id,
    })

    // Preserve agent execution history when promoting AI Review to Review
    try {
      const agentExecutionService = await import('#services/agent_execution_service')
      await agentExecutionService.default.promoteAiReviewToReview(id)
    } catch (historyError: any) {
      // Don't fail the request if history promotion fails, but log it
      console.error('Failed to promote agent execution history:', {
        postId: id,
        error: historyError?.message,
      })
    }

    return response.ok({ message: 'AI Review promoted to Review' })
  }

  private async rejectReviewDraft(
    postId: string,
    auth: HttpContext['auth'],
    response: HttpContext['response']
  ) {
    const userId = (auth.use('web').user as any)?.id ?? null
    // Capture current full Active Versions state before discarding
    await RevisionService.recordActiveVersionsSnapshot({
      postId,
      mode: 'review',
      action: 'reject-review',
      userId,
    })

    const now = new Date()
    // Clear review draft
    await Post.query()
      .where('id', postId)
      .update({ review_draft: null } as any)
    // Clear staged module state for Review
    await db
      .from('module_instances')
      .where('scope', 'post')
      .andWhereIn('id', db.from('post_modules').where('post_id', postId).select('module_id'))
      .update({ review_props: null, updated_at: now } as any)
    await db
      .from('post_modules')
      .where('post_id', postId)
      .update({
        review_overrides: null,
        review_added: false,
        review_deleted: false,
        updated_at: now,
      } as any)

    return response.ok({ message: 'Review discarded' })
  }

  private async rejectAiReviewDraft(
    postId: string,
    auth: HttpContext['auth'],
    response: HttpContext['response']
  ) {
    const userId = (auth.use('web').user as any)?.id ?? null
    await RevisionService.recordActiveVersionsSnapshot({
      postId,
      mode: 'ai-review',
      action: 'reject-ai-review',
      userId,
    })

    const now = new Date()
    await Post.query()
      .where('id', postId)
      .update({ ai_review_draft: null } as any)
    await db
      .from('module_instances')
      .where('scope', 'post')
      .andWhereIn('id', db.from('post_modules').where('post_id', postId).select('module_id'))
      .update({ ai_review_props: null, updated_at: now } as any)
    await db
      .from('post_modules')
      .where('post_id', postId)
      .update({
        ai_review_overrides: null,
        ai_review_added: false,
        ai_review_deleted: false,
        updated_at: now,
      } as any)

    return response.ok({ message: 'AI Review discarded' })
  }

  private async promoteAiReviewModulesToReview(postId: string) {
    // Load all module instances for this post to merge props properly in JavaScript
    const moduleInstances = await db
      .from('module_instances')
      .where('scope', 'post')
      .andWhereIn('id', db.from('post_modules').where('post_id', postId).select('module_id'))
      .select('id', 'props', 'review_props', 'ai_review_props')

    // Promote ai_review_props to review_props for local modules
    // Only merge ai_review_props and review_props - do NOT include props (source/approved content)
    // Props is the approved/live content and should not be mixed into review content
    for (const instance of moduleInstances) {
      const reviewProps = (instance.review_props as Record<string, any>) || {}
      const aiReviewProps = (instance.ai_review_props as Record<string, any>) || {}

      // Merge: AI review props (base AI content) + existing review props
      // Review props should only contain review-stage content, not source/approved content
      const mergedReviewProps = { ...aiReviewProps, ...reviewProps }

      await db
        .from('module_instances')
        .where('id', instance.id)
        .update({
          review_props: mergedReviewProps,
          ai_review_props: null,
          updated_at: new Date(),
        } as any)
    }

    // Load all post_modules for this post to merge overrides properly
    const postModules = await db
      .from('post_modules')
      .where('post_id', postId)
      .select('id', 'overrides', 'review_overrides', 'ai_review_overrides')

    // Promote ai_review_overrides to review_overrides for post_modules
    // Only merge ai_review_overrides and review_overrides - do NOT include overrides (source/approved content)
    for (const pm of postModules) {
      const reviewOverrides = (pm.review_overrides as Record<string, any>) || {}
      const aiReviewOverrides = (pm.ai_review_overrides as Record<string, any>) || {}

      // Merge: AI review overrides (base AI content) + existing review overrides
      // Review overrides should only contain review-stage content, not source/approved content
      const mergedReviewOverrides = { ...aiReviewOverrides, ...reviewOverrides }

      await db
        .from('post_modules')
        .where('id', pm.id)
        .update({
          review_overrides: mergedReviewOverrides,
          ai_review_overrides: null,
          updated_at: new Date(),
        } as any)
    }

    // Promote ai_review_added/deleted flags to review flags
    await db
      .from('post_modules')
      .where('post_id', postId)
      .andWhere('ai_review_added', true)
      .update({
        review_added: true,
        ai_review_added: false,
        updated_at: new Date(),
      })

    await db
      .from('post_modules')
      .where('post_id', postId)
      .andWhere('ai_review_deleted', true)
      .update({
        review_deleted: true,
        ai_review_deleted: false,
        updated_at: new Date(),
      })
  }

  private async upsertCustomFields(
    postId: string,
    customFields: Array<{ slug?: string; value: any }>
  ) {
    const now = new Date()
    for (const cf of customFields) {
      if (!cf?.slug) continue
      const fieldSlug = String(cf.slug).trim()
      if (!fieldSlug) continue

      const value = this.normalizeJsonb(cf.value === undefined ? null : cf.value)

      const updated = await db
        .from('post_custom_field_values')
        .where({ post_id: postId, field_slug: fieldSlug })
        .update({ value, updated_at: now })

      if (!updated) {
        const { randomUUID } = await import('node:crypto')
        await db.table('post_custom_field_values').insert({
          id: randomUUID(),
          post_id: postId,
          field_slug: fieldSlug,
          value,
          created_at: now,
          updated_at: now,
        })
      }
    }
  }

  private async promoteModuleChanges(postId: string) {
    // Load all module instances for this post to merge props properly in JavaScript
    // This prevents SQL expressions from being saved as JSON data
    const moduleInstances = await db
      .from('module_instances')
      .where('scope', 'post')
      .andWhereIn('id', db.from('post_modules').where('post_id', postId).select('module_id'))
      .select('id', 'props', 'review_props')

    // Promote review_props to props for local modules
    // Merge: props (base) + review_props (if exists, overrides props)
    for (const instance of moduleInstances) {
      const props = (instance.props as Record<string, any>) || {}
      const reviewProps = (instance.review_props as Record<string, any>) || {}

      // If props contains a SQL expression (corrupted data), use review_props or empty object
      let mergedProps: Record<string, any>
      if (props && typeof props === 'object' && 'sql' in props) {
        // Props is corrupted (contains SQL expression), use review_props or empty
        mergedProps = reviewProps && Object.keys(reviewProps).length > 0 ? reviewProps : {}
      } else {
        // Normal case: merge review_props over props
        mergedProps = { ...props, ...reviewProps }
      }

      await db
        .from('module_instances')
        .where('id', instance.id)
        .update({
          props: mergedProps,
          review_props: null,
          updated_at: new Date(),
        } as any)
    }

    // Promote review_overrides to overrides
    await db
      .from('post_modules')
      .where('post_id', postId)
      .update({
        overrides: db.raw('COALESCE(review_overrides, overrides)'),
        review_overrides: null,
        updated_at: new Date(),
      })

    // Delete modules marked for deletion
    await db.from('post_modules').where('post_id', postId).andWhere('review_deleted', true).delete()

    // Finalize newly added modules
    await db
      .from('post_modules')
      .where('post_id', postId)
      .andWhere('review_added', true)
      .update({ review_added: false, updated_at: new Date() })
  }

  /**
   * Replace taxonomy term assignments for this post (scoped to taxonomies enabled for the post type).
   *
   * This is invoked during Review approval, so it never runs on AI Review directly.
   */
  private async applyTaxonomyAssignments(
    postId: string,
    postType: string,
    requestedTermIds: string[]
  ): Promise<{ ok: true } | { ok: false; error: string }> {
    const uiCfg = postTypeConfigService.getUiConfig(postType)
    const allowedTaxonomySlugs = Array.isArray((uiCfg as any).taxonomies)
      ? (uiCfg as any).taxonomies
      : []
    if (allowedTaxonomySlugs.length === 0) {
      return { ok: true }
    }

    // Normalize ids
    const termIds = Array.from(new Set(requestedTermIds.map((x) => String(x)).filter(Boolean)))

    // Resolve requested terms -> taxonomy slug and filter to allowed taxonomies
    const rows = termIds.length
      ? await db
          .from('taxonomy_terms as tt')
          .join('taxonomies as t', 'tt.taxonomy_id', 't.id')
          .whereIn('tt.id', termIds)
          .whereIn('t.slug', allowedTaxonomySlugs)
          .select('tt.id as termId', 't.slug as taxonomySlug')
      : []

    const byTaxonomy = new Map<string, string[]>()
    for (const r of rows as any[]) {
      const slug = String(r.taxonomyslug || r.taxonomySlug)
      const id = String(r.termid || r.termId)
      if (!byTaxonomy.has(slug)) byTaxonomy.set(slug, [])
      byTaxonomy.get(slug)!.push(id)
    }

    // Enforce maxSelections per taxonomy (when configured)
    for (const [slug, ids] of byTaxonomy.entries()) {
      const cfg = taxonomyService.getConfig(slug)
      const max =
        cfg?.maxSelections === undefined || cfg?.maxSelections === null
          ? null
          : Number(cfg.maxSelections)
      if (max !== null && Number.isFinite(max) && ids.length > max) {
        return { ok: false, error: `Too many selections for taxonomy '${slug}' (max ${max})` }
      }
    }

    // Remove existing assignments for allowed taxonomies only
    await db
      .from('post_taxonomy_terms')
      .where('post_id', postId)
      .whereIn(
        'taxonomy_term_id',
        db
          .from('taxonomy_terms as tt')
          .join('taxonomies as t', 'tt.taxonomy_id', 't.id')
          .whereIn('t.slug', allowedTaxonomySlugs)
          .select('tt.id')
      )
      .delete()

    if (rows.length === 0) return { ok: true }

    // Insert requested (filtered) assignments
    const { randomUUID } = await import('node:crypto')
    const now = new Date()
    await db.table('post_taxonomy_terms').insert(
      (rows as any[]).map((r) => ({
        id: randomUUID(),
        post_id: postId,
        taxonomy_term_id: String(r.termid || r.termId),
        created_at: now,
        updated_at: now,
      }))
    )

    return { ok: true }
  }
}
