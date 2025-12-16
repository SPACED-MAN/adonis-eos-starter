import type { HttpContext } from '@adonisjs/core/http'
import type { NextFn } from '@adonisjs/core/types/http'
import RateLimitMiddleware from '#middleware/rate_limit_middleware'

/**
 * Rate limiting tuned for API endpoints.
 */
export default class RateLimitApiMiddleware {
	private delegate = RateLimitMiddleware.api()

	async handle(ctx: HttpContext, next: NextFn) {
		return this.delegate.handle(ctx, next)
	}
}


