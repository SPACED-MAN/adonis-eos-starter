import type { HttpContext } from '@adonisjs/core/http'
import moduleRegistry from '#services/module_registry'
import moduleScopeService from '#services/module_scope_service'

/**
 * Modules Controller
 *
 * Handles API requests for module system information and management.
 */
export default class ModulesController {
  /**
   * GET /api/modules/registry
   *
   * Returns the list of all registered modules with their schemas.
   * Optionally filter by post type.
   */
  async registry({ request, response }: HttpContext) {
    const postType = request.input('post_type')

    try {
      let modules

      if (postType) {
        // Get modules allowed for specific post type
        modules = await moduleScopeService.getAllowedModuleConfigsForPostType(postType)
      } else {
        // Get all registered modules
        modules = moduleRegistry.getAllConfigs()
      }

      return response.ok({
        data: modules,
        meta: {
          count: modules.length,
          postType: postType || null,
        },
      })
    } catch (error) {
      return response.internalServerError({
        error: 'Failed to load module registry',
        message: error.message,
      })
    }
  }

  /**
   * GET /api/modules/:type/schema
   *
   * Returns the schema for a specific module type.
   */
  async schema({ params, response }: HttpContext) {
    const { type } = params

    try {
      if (!moduleRegistry.has(type)) {
        return response.notFound({
          error: 'Module not found',
          message: `Module type '${type}' is not registered`,
        })
      }

      const schema = moduleRegistry.getSchema(type)

      return response.ok({
        data: schema,
      })
    } catch (error) {
      return response.internalServerError({
        error: 'Failed to load module schema',
        message: error.message,
      })
    }
  }
}
