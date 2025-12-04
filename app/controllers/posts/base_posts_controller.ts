import responseService from '#services/response_service'
import type { Response } from '@adonisjs/core/http'

/**
 * Base Posts Controller
 *
 * Shared functionality for all post-related controllers.
 */
export default abstract class BasePostsController {
  protected response = responseService

  /**
   * Normalize JSONB values for database storage
   */
  protected normalizeJsonb(value: any): any {
    if (value === undefined) return null
    if (typeof value === 'string') return JSON.stringify(value)
    return value
  }

  /**
   * Parse JSON string to object, with fallback
   */
  protected parseJsonField(value: any): Record<string, any> | null {
    if (!value) return null
    if (typeof value === 'object') return value
    if (typeof value === 'string') {
      try {
        return JSON.parse(value)
      } catch {
        return null
      }
    }
    return null
  }

  /**
   * Handle action exception with proper response
   */
  protected handleActionException(
    response: Response,
    error: { message: string; statusCode?: number; meta?: Record<string, any> }
  ) {
    return this.response.fromException(response, error)
  }
}
