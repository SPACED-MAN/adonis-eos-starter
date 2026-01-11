import type { HttpContext } from '@adonisjs/core/http'
import type { NextFn } from '@adonisjs/core/types/http'
import { adminPath } from '#services/admin_path_service'
import app from '@adonisjs/core/services/app'

/**
 * Early Hints Middleware
 * 
 * Injects Link headers for high-priority assets to help browsers start 
 * downloading them before the main HTML is fully processed.
 */
export default class EarlyHintsMiddleware {
  async handle({ request }: HttpContext, next: NextFn) {
    // Only apply in production and for frontend GET requests
    const isGet = request.method() === 'GET'
    const isAdmin = request.url().startsWith(adminPath())
    const isApi = request.url().startsWith('/api')

    if (app.inProduction && isGet && !isAdmin && !isApi) {
      // Skip hardcoded early hints in production with Vite as they often point to non-hashed paths
      // causing 404s/MIME-type errors. Ideally these should be resolved from the Vite manifest.
    }

    return next()
  }
}

