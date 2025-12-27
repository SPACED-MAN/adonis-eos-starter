import type { HttpContext } from '@adonisjs/core/http'
import type { NextFn } from '@adonisjs/core/types/http'
import RateLimitMiddleware from '#middleware/rate_limit_middleware'

/**
 * Stricter rate limiting for authentication endpoints.
 */
export default class RateLimitAuthMiddleware {
  private delegate = RateLimitMiddleware.auth()

  async handle(ctx: HttpContext, next: NextFn) {
    return this.delegate.handle(ctx, next)
  }
}
