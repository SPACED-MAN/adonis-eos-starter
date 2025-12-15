import type { HttpContext } from '@adonisjs/core/http'
import Post from '#models/post'
import UpdatePost from '#actions/posts/update_post'
import db from '@adonisjs/lucid/services/db'
import authorizationService from '#services/authorization_service'
import BasePostsController from './base_posts_controller.js'
import { randomUUID } from 'node:crypto'

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
    const mode: 'approved' | 'review' | 'ai-review' = rev.mode || 'approved'

    // New-style composite snapshots restore all active versions + staging.
    if (snapshot?.kind === 'active-versions') {
      const postSnap = snapshot?.post || {}
      const postType = postSnap?.type || (await Post.find(id))?.type
      if (
        !authorizationService.canRevertRevision(role, postType) ||
        !authorizationService.canUpdateStatus(role, postSnap?.status, postType)
      ) {
        return this.response.forbidden(response, 'Not allowed to revert to this revision')
      }
      const now = new Date()
      // Restore Source fields
      await UpdatePost.handle({
        postId: id,
        slug: postSnap?.slug,
        title: postSnap?.title,
        status: postSnap?.status,
        excerpt: postSnap?.excerpt ?? null,
        parentId: postSnap?.parentId ?? undefined,
        orderIndex: typeof postSnap?.orderIndex === 'number' ? postSnap.orderIndex : undefined,
        metaTitle: postSnap?.metaTitle ?? null,
        metaDescription: postSnap?.metaDescription ?? null,
        canonicalUrl: postSnap?.canonicalUrl ?? null,
        robotsJson: postSnap?.robotsJson ?? null,
        jsonldOverrides: postSnap?.jsonldOverrides ?? null,
        featuredImageId: postSnap?.featuredImageId ?? undefined,
      } as any)

      // Restore draft payloads
      await Post.query()
        .where('id', id)
        .update({
          review_draft: snapshot?.drafts?.reviewDraft ?? null,
          ai_review_draft: snapshot?.drafts?.aiReviewDraft ?? null,
        } as any)

      // Restore custom fields (Source)
      if (Array.isArray(postSnap?.customFields)) {
        await db.from('post_custom_field_values').where('post_id', id).delete()
        const rows = (postSnap.customFields as any[]).map((r) => ({
          id: randomUUID(),
          post_id: id,
          field_slug: String(r.fieldSlug),
          value: r.value ?? null,
          created_at: now,
          updated_at: now,
        }))
        if (rows.length > 0) {
          await db.table('post_custom_field_values').insert(rows)
        }
      }

      // Restore taxonomy assignments (Source)
      if (Array.isArray(postSnap?.taxonomyTermIds)) {
        await db.from('post_taxonomy_terms').where('post_id', id).delete()
        const rows = (postSnap.taxonomyTermIds as any[]).map((termId) => ({
          id: randomUUID(),
          post_id: id,
          taxonomy_term_id: String(termId),
          created_at: now,
          updated_at: now,
        }))
        if (rows.length > 0) {
          await db.table('post_taxonomy_terms').insert(rows)
        }
      }

      // Restore module staging + flags (best-effort; does not recreate deleted modules)
      if (Array.isArray(snapshot?.modules)) {
        for (const m of snapshot.modules as any[]) {
          if (m?.moduleInstanceId) {
            // If props is not provided in revision, load current props to preserve them
            let propsToSet = m.props
            if (!propsToSet) {
              const current = await db
                .from('module_instances')
                .where('id', String(m.moduleInstanceId))
                .select('props')
                .first()
              propsToSet = (current?.props as Record<string, any>) || {}
            }
            // Update module instance props - only update what's provided in snapshot
            const updateData: any = {
              updated_at: now,
            }
            // Only update props if explicitly provided (preserve current if not)
            if (m.props !== undefined && m.props !== null) {
              updateData.props = propsToSet
            }
            // Always update review/ai-review props if they exist in snapshot (even if null)
            if (m.reviewProps !== undefined) {
              updateData.review_props = m.reviewProps ?? null
            }
            if (m.aiReviewProps !== undefined) {
              updateData.ai_review_props = m.aiReviewProps ?? null
            }
            // Only update if we have something to update
            if (Object.keys(updateData).length > 1) {
              await db
                .from('module_instances')
                .where('id', String(m.moduleInstanceId))
                .update(updateData)
            }
          }
          if (m?.postModuleId) {
            await db
              .from('post_modules')
              .where('id', String(m.postModuleId))
              .update({
                overrides: m.overrides ?? null,
                review_overrides: m.reviewOverrides ?? null,
                ai_review_overrides: m.aiReviewOverrides ?? null,
                review_added: !!m?.flags?.reviewAdded,
                review_deleted: !!m?.flags?.reviewDeleted,
                ai_review_added: !!m?.flags?.aiReviewAdded,
                ai_review_deleted: !!m?.flags?.aiReviewDeleted,
                order_index: typeof m.orderIndex === 'number' ? m.orderIndex : undefined,
                locked: !!m.locked,
                updated_at: now,
              } as any)
          }
        }
      }

      return response.ok({ message: 'Reverted to revision' })
    }

    if (mode === 'review') {
      await Post.query().where('id', id).update({ review_draft: snapshot } as any)

      // If snapshot has modules data, restore module review_props
      if (Array.isArray(snapshot?.modules)) {
        const now = new Date()
        for (const m of snapshot.modules as any[]) {
          if (m?.moduleInstanceId && m?.reviewProps !== undefined) {
            await db
              .from('module_instances')
              .where('id', String(m.moduleInstanceId))
              .update({
                review_props: m.reviewProps ?? null,
                updated_at: now,
              } as any)
          }
          if (m?.postModuleId) {
            await db
              .from('post_modules')
              .where('id', String(m.postModuleId))
              .update({
                review_overrides: m.reviewOverrides ?? null,
                review_added: !!m?.flags?.reviewAdded,
                review_deleted: !!m?.flags?.reviewDeleted,
                updated_at: now,
              } as any)
          }
        }
      }

      return response.ok({ message: 'Reverted review draft' })
    }
    if (mode === 'ai-review') {
      await Post.query().where('id', id).update({ ai_review_draft: snapshot } as any)

      // If snapshot has modules data, restore module ai_review_props
      if (Array.isArray(snapshot?.modules)) {
        const now = new Date()
        for (const m of snapshot.modules as any[]) {
          if (m?.moduleInstanceId && m?.aiReviewProps !== undefined) {
            await db
              .from('module_instances')
              .where('id', String(m.moduleInstanceId))
              .update({
                ai_review_props: m.aiReviewProps ?? null,
                updated_at: now,
              } as any)
          }
          if (m?.postModuleId) {
            await db
              .from('post_modules')
              .where('id', String(m.postModuleId))
              .update({
                ai_review_overrides: m.aiReviewOverrides ?? null,
                ai_review_added: !!m?.flags?.aiReviewAdded,
                ai_review_deleted: !!m?.flags?.aiReviewDeleted,
                updated_at: now,
              } as any)
          }
        }
      }

      return response.ok({ message: 'Reverted AI review draft' })
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
