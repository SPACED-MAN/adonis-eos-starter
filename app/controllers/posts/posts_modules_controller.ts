import type { HttpContext } from '@adonisjs/core/http'
import AddModuleToPost, { AddModuleToPostException } from '#actions/posts/add_module_to_post'
import UpdatePostModule, { UpdatePostModuleException } from '#actions/posts/update_post_module'
import db from '@adonisjs/lucid/services/db'
import BasePostsController from './base_posts_controller.js'
import { addModuleValidator, updateModuleValidator } from '#validators/post'

/**
 * Posts Modules Controller
 *
 * Handles module operations within posts.
 */
export default class PostsModulesController extends BasePostsController {
  /**
   * POST /api/posts/:id/modules
   * Add a module to a post
   */
  async store({ params, request, response }: HttpContext) {
    const { id } = params

    try {
      const payload = await request.validateUsing(addModuleValidator)

      const result = await AddModuleToPost.handle({
        postId: id,
        moduleType: payload.moduleType,
        scope: payload.scope || 'local',
        props: payload.props || {},
        globalSlug: payload.globalSlug ?? null,
        orderIndex: payload.orderIndex,
        locked: payload.locked || false,
        mode: payload.mode === 'review' ? 'review' : 'publish',
      })

      // For Inertia requests, redirect back
      if (request.header('x-inertia')) {
        return response.redirect().back()
      }

      return this.response.created(
        response,
        {
          postModuleId: result.postModule.id,
          moduleInstanceId: result.moduleInstanceId,
          orderIndex: result.postModule.order_index,
        },
        'Module added to post successfully'
      )
    } catch (error) {
      if (error instanceof AddModuleToPostException) {
        if (request.header('x-inertia')) {
          return response.redirect().back()
        }
        return this.handleActionException(response, error)
      }
      throw error
    }
  }

  /**
   * PUT /api/post-modules/:id
   * Update a post module (reorder, overrides, lock)
   */
  async update({ params, request, response }: HttpContext) {
    const { id } = params

    try {
      const payload = await request.validateUsing(updateModuleValidator)

      const updated = await UpdatePostModule.handle({
        postModuleId: id,
        orderIndex: payload.orderIndex,
        overrides: payload.overrides,
        locked: payload.locked,
        mode: payload.mode === 'review' ? 'review' : 'publish',
      })

      return response.ok({
        data: {
          id: updated.id,
          orderIndex: updated.order_index,
          overrides: payload.mode === 'review' ? updated.review_overrides : updated.overrides,
          reviewOverrides: updated.review_overrides ?? null,
          locked: updated.locked,
          updatedAt: updated.updated_at,
        },
        message: 'Post module updated successfully',
      })
    } catch (error) {
      if (error instanceof UpdatePostModuleException) {
        return this.handleActionException(response, error)
      }
      throw error
    }
  }

  /**
   * DELETE /api/post-modules/:id
   * Remove a module from a post
   */
  async destroy({ params, response }: HttpContext) {
    const { id } = params

    const row = await db.from('post_modules').where('id', id).first()
    if (!row) {
      return this.response.notFound(response, 'Post module not found')
    }

    // Check if locked
    if (row.locked) {
      return this.response.badRequest(response, 'Cannot delete a locked module')
    }

    await db.from('post_modules').where('id', id).delete()

    return this.response.noContent(response)
  }
}
