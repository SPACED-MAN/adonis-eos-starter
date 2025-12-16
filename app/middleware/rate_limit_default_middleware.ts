import type { HttpContext } from '@adonisjs/core/http'
import type { NextFn } from '@adonisjs/core/types/http'
import RateLimitMiddleware from '#middleware/rate_limit_middleware'

/**
 * Default rate limit middleware instance.
 *
 * This wrapper exists because Adonis lazy-import middleware expects a module
 * with `export default`, and it will instantiate/call the exported middleware.
 */
export default class RateLimitDefaultMiddleware {
	private delegate = RateLimitMiddleware.make()

	async handle(ctx: HttpContext, next: NextFn) {
		return this.delegate.handle(ctx, next)
	}
}


