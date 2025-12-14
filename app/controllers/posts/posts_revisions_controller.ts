import type { HttpContext } from '@adonisjs/core/http'
import Post from '#models/post'
import UpdatePost from '#actions/posts/update_post'
import db from '@adonisjs/lucid/services/db'
import authorizationService from '#services/authorization_service'
import BasePostsController from './base_posts_controller.js'

/**
 * Posts Revisions Controller
 *
 * Handles revision history and revert operations.
 */
export default class PostsRevisionsController extends BasePostsController {
  /**
   * GET /api/posts/:id/revisions
   * List recent revisions for a post
   */
  async index({ params, response, request }: HttpContext) {
    const { id } = params
    const limit = Math.min(50, Math.max(1, Number(request.input('limit', 20)) || 20))

    const rows = await db
      .from('post_revisions')
      .leftJoin('users', 'post_revisions.user_id', 'users.id')
      .where('post_revisions.post_id', id)
      .orderBy('post_revisions.created_at', 'desc')
      .limit(limit)
      .select(
        'post_revisions.id',
        'post_revisions.mode',
        'post_revisions.created_at as createdAt',
        'post_revisions.user_id as userId',
        'users.email as userEmail'
      )

    return response.ok({
      data: rows.map((r: any) => ({
        id: r.id,
        mode: r.mode,
        createdAt: r.createdat || r.createdAt,
        user: r.useremail ? { email: r.useremail, id: r.userid } : null,
      })),
    })
  }

  /**
   * GET /api/posts/:id/revisions/:revId
   * Get a specific revision's snapshot
   */
  async show({ params, response }: HttpContext) {
    const { id, revId } = params

    const rev = await db
      .from('post_revisions')
      .leftJoin('users', 'post_revisions.user_id', 'users.id')
      .where('post_revisions.id', revId)
      .andWhere('post_revisions.post_id', id)
      .select('post_revisions.*', 'users.email as userEmail')
      .first()

    if (!rev) {
      return this.response.notFound(response, 'Revision not found')
    }

    return response.ok({
      id: rev.id,
      mode: rev.mode,
      snapshot: rev.snapshot,
      createdAt: rev.created_at,
      user: rev.userEmail ? { email: rev.userEmail, id: rev.user_id } : null,
    })
  }

  /**
   * POST /api/posts/:id/revisions/:revId/revert
   * Revert a post to a given revision
   */
  async revert({ params, response, auth }: HttpContext) {
    const { id, revId } = params
    const role = (auth.use('web').user as any)?.role as
      | 'admin'
      | 'editor'
      | 'translator'
      | undefined

    const rev = await db.from('post_revisions').where('id', revId).andWhere('post_id', id).first()
    if (!rev) {
      return this.response.notFound(response, 'Revision not found')
    }

    const snapshot = rev.snapshot || {}
    const mode: 'approved' | 'review' = rev.mode || 'approved'

    // Review revisions go to review_draft
    if (mode === 'review') {
      await Post.query()
        .where('id', id)
        .update({ review_draft: snapshot } as any)
      return response.ok({ message: 'Reverted review draft' })
    }

    const postType = snapshot?.type || (await Post.find(id))?.type
    // Source (approved/live) revisions require permission
    if (
      !authorizationService.canRevertRevision(role, postType) ||
      !authorizationService.canUpdateStatus(role, snapshot?.status, postType)
    ) {
      return this.response.forbidden(response, 'Not allowed to revert to this revision')
    }

    await UpdatePost.handle({
      postId: id,
      slug: snapshot?.slug,
      title: snapshot?.title,
      status: snapshot?.status,
      excerpt: snapshot?.excerpt ?? null,
      metaTitle: snapshot?.metaTitle ?? null,
      metaDescription: snapshot?.metaDescription ?? null,
      canonicalUrl: snapshot?.canonicalUrl ?? null,
      robotsJson: snapshot?.robotsJson ?? null,
      jsonldOverrides: snapshot?.jsonldOverrides ?? null,
    })

    // Log activity
    try {
      const activityService = (await import('#services/activity_log_service')).default
      await activityService.log({
        action: 'post.revision.revert',
        userId: auth.user?.id ?? null,
        entityType: 'post',
        entityId: id,
        metadata: { revisionId: revId },
      })
    } catch {
      /* ignore */
    }

    return response.ok({ message: 'Reverted to revision' })
  }

  /**
   * POST /api/posts/:id/revisions/:revId/compare
   * Compare a revision with current state
   */
  async compare({ params, response }: HttpContext) {
    const { id, revId } = params

    const [post, rev] = await Promise.all([
      Post.find(id),
      db.from('post_revisions').where('id', revId).andWhere('post_id', id).first(),
    ])

    if (!post) {
      return this.response.notFound(response, 'Post not found')
    }
    if (!rev) {
      return this.response.notFound(response, 'Revision not found')
    }

    const snapshot = rev.snapshot || {}

    // Build diff
    const diff: Record<string, { current: any; revision: any }> = {}

    const fieldsToCompare = [
      'slug',
      'title',
      'status',
      'excerpt',
      'metaTitle',
      'metaDescription',
      'canonicalUrl',
    ]

    for (const field of fieldsToCompare) {
      const currentValue = (post as any)[field]
      const revisionValue = snapshot[field]

      if (JSON.stringify(currentValue) !== JSON.stringify(revisionValue)) {
        diff[field] = { current: currentValue, revision: revisionValue }
      }
    }

    return response.ok({
      postId: id,
      revisionId: revId,
      mode: rev.mode,
      createdAt: rev.created_at,
      diff,
      hasChanges: Object.keys(diff).length > 0,
    })
  }
}
