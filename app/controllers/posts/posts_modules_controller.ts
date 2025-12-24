import type { HttpContext } from '@adonisjs/core/http'
import AddModuleToPost, { AddModuleToPostException } from '#actions/posts/add_module_to_post'
import UpdatePostModule, { UpdatePostModuleException } from '#actions/posts/update_post_module'
import DeletePostModule, { DeletePostModuleException } from '#actions/posts/delete_post_module'
import db from '@adonisjs/lucid/services/db'
import BasePostsController from './base_posts_controller.js'
import { addModuleValidator, updateModuleValidator } from '#validators/post'
import postTypeConfigService from '#services/post_type_config_service'

const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const isUuid = (val: unknown): val is string => typeof val === 'string' && uuidRegex.test(val)

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
        overrides: payload.overrides || null,
        globalSlug: payload.globalSlug ?? null,
        orderIndex: payload.orderIndex,
        locked: payload.locked || false,
        adminLabel: payload.adminLabel,
        mode:
          payload.mode === 'review'
            ? 'review'
            : payload.mode === 'ai-review'
              ? 'ai-review'
              : 'publish',
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

    if (!isUuid(id)) {
      return this.response.badRequest(response, 'Invalid module id')
    }

    try {
      const payload = await request.validateUsing(updateModuleValidator)

      const updated = await UpdatePostModule.handle({
        postModuleId: id,
        orderIndex: payload.orderIndex,
        overrides: payload.overrides,
        locked: payload.locked,
        adminLabel: payload.adminLabel,
        mode:
          payload.mode === 'review'
            ? 'review'
            : payload.mode === 'ai-review'
              ? 'ai-review'
              : 'publish',
      })

      const resolvedMode =
        payload.mode === 'review' ? 'review' : payload.mode === 'ai-review' ? 'ai-review' : 'publish'

      return response.ok({
        data: {
          id: updated.id,
          orderIndex: (updated as any).orderIndex ?? (updated as any).order_index,
          overrides:
            resolvedMode === 'review'
              ? (updated as any).reviewOverrides ?? (updated as any).review_overrides
              : resolvedMode === 'ai-review'
                ? (updated as any).aiReviewOverrides ?? (updated as any).ai_review_overrides
                : (updated as any).overrides,
          reviewOverrides: (updated as any).reviewOverrides ?? (updated as any).review_overrides ?? null,
          aiReviewOverrides:
            (updated as any).aiReviewOverrides ?? (updated as any).ai_review_overrides ?? null,
          adminLabel: (updated as any).adminLabel ?? (updated as any).admin_label ?? null,
          locked: (updated as any).locked,
          updatedAt:
            (updated as any).updatedAt?.toISO?.() ??
            (updated as any).updated_at?.toISOString?.() ??
            (updated as any).updated_at ??
            null,
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
  async destroy({ params, request, response }: HttpContext) {
    const { id } = params
    const mode = request.input('mode') || 'publish'

    if (!isUuid(id)) {
      return this.response.badRequest(response, 'Invalid module id')
    }

    try {
      await DeletePostModule.handle({
        postModuleId: id,
        mode: mode as any,
      })

      return this.response.noContent(response)
    } catch (error) {
      if (error instanceof DeletePostModuleException) {
        return this.handleActionException(response, error)
    }
      throw error
    }
  }
}
