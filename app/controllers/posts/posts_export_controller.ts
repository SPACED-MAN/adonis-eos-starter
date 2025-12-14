import type { HttpContext } from '@adonisjs/core/http'
import PostSerializerService from '#services/post_serializer_service'
import RevisionService from '#services/revision_service'
import authorizationService from '#services/authorization_service'
import Post from '#models/post'
import BasePostsController from './base_posts_controller.js'

/**
 * Posts Export Controller
 *
 * Handles import/export operations for posts.
 */
export default class PostsExportController extends BasePostsController {
  /**
   * GET /api/posts/:id/export
   * Export canonical JSON for a post
   */
  async exportJson({ params, response, request }: HttpContext) {
    const { id } = params

    try {
      const data = await PostSerializerService.serialize(id)
      const asDownload = String(request.input('download', '1')) !== '0'

      response.header('Content-Type', 'application/json; charset=utf-8')
      if (asDownload) {
        response.header('Content-Disposition', `attachment; filename="post-${id}.json"`)
      }

      return response.ok(data)
    } catch (error: any) {
      return this.response.badRequest(response, error?.message || 'Failed to export')
    }
  }

  /**
   * POST /api/posts/import
   * Create a new post from canonical JSON
   */
  async importCreate({ request, response, auth }: HttpContext) {
    const role = (auth.use('web').user as any)?.role as
      | 'admin'
      | 'editor'
      | 'translator'
      | undefined

    const { data } = request.only(['data'])
    const importType = (data as any)?.post?.type || (data as any)?.type

    if (!authorizationService.canCreatePost(role, importType)) {
      return this.response.forbidden(response, 'Not allowed to import')
    }

    if (!data) {
      return this.response.badRequest(response, 'Missing data')
    }

    try {
      const userId = auth.user?.id
      if (!userId) {
        return response.unauthorized({ error: 'User must be authenticated' })
      }
      const post = await PostSerializerService.importCreate(data, userId)

      // Log activity
      try {
        const activityService = (await import('#services/activity_log_service')).default
        await activityService.log({
          action: 'post.import.create',
          userId: auth.user?.id ?? null,
          entityType: 'post',
          entityId: post.id,
        })
      } catch {
        /* ignore */
      }

      return this.response.created(response, { id: post.id }, 'Post imported successfully')
    } catch (error: any) {
      return this.response.badRequest(response, error?.message || 'Failed to import')
    }
  }

  /**
   * POST /api/posts/:id/import
   * Import canonical JSON into an existing post
   */
  async importInto({ params, request, response, auth }: HttpContext) {
    const { id } = params
    const { data, mode } = request.only(['data', 'mode'])

    if (!data) {
      return this.response.badRequest(response, 'Missing data')
    }

    const importMode = String(mode || 'replace').toLowerCase()

    try {
      if (importMode === 'review') {
        // Store in review draft only
        await Post.query()
          .where('id', id)
          .update({ review_draft: data.post } as any)

        await RevisionService.record({
          postId: id,
          mode: 'review',
          snapshot: data.post,
          userId: auth.user?.id,
        })

        return response.ok({ message: 'Imported into review draft' })
      }

      // Replace live content
      const role = (auth.use('web').user as any)?.role as
        | 'admin'
        | 'editor'
        | 'translator'
        | undefined
      const existing = await Post.find(id)
      const targetType = (data as any)?.post?.type || existing?.type
      if (!authorizationService.canUpdateStatus(role, data?.post?.status, targetType)) {
        return this.response.forbidden(response, 'Not allowed to set target status')
      }

      await PostSerializerService.importReplace(id, data)

      await RevisionService.record({
        postId: id,
        mode: 'approved',
        snapshot: data.post,
        userId: auth.user?.id,
      })

      // Log activity
      try {
        const activityService = (await import('#services/activity_log_service')).default
        await activityService.log({
          action: 'post.import.replace',
          userId: auth.user?.id ?? null,
          entityType: 'post',
          entityId: id,
        })
      } catch {
        /* ignore */
      }

      return response.ok({ message: 'Imported and replaced live content' })
    } catch (error: any) {
      return this.response.badRequest(response, error?.message || 'Failed to import')
    }
  }
}
