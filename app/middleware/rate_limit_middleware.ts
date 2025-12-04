import type { HttpContext } from '@adonisjs/core/http'
import type { NextFn } from '@adonisjs/core/types/http'
import redis from '@adonisjs/redis/services/main'
import cmsConfig from '#config/cms'

export type RateLimitOptions = {
  /** Maximum requests allowed in the window */
  requests?: number
  /** Window duration in seconds */
  window?: number
  /** Custom key generator (defaults to IP-based) */
  keyGenerator?: (ctx: HttpContext) => string
  /** Skip rate limiting for authenticated users */
  skipAuthenticated?: boolean
  /** Skip rate limiting for admin users */
  skipAdmins?: boolean
}

/**
 * Rate Limiting Middleware
 *
 * Implements sliding window rate limiting using Redis.
 * Configurable per-route with sensible defaults.
 */
export default class RateLimitMiddleware {
  private static defaultOptions: Required<RateLimitOptions> = {
    requests: cmsConfig.rateLimit.defaultRequests,
    window: cmsConfig.rateLimit.defaultWindow,
    keyGenerator: (ctx) => `rate:${ctx.request.ip()}:${ctx.request.url()}`,
    skipAuthenticated: false,
    skipAdmins: true,
  }

  /**
   * Create middleware with custom options
   */
  static make(options: RateLimitOptions = {}) {
    return new RateLimitMiddleware({ ...this.defaultOptions, ...options })
  }

  /**
   * Auth-specific rate limiting (stricter)
   */
  static auth() {
    return new RateLimitMiddleware({
      ...this.defaultOptions,
      requests: cmsConfig.rateLimit.authRequests,
      window: cmsConfig.rateLimit.authWindow,
      keyGenerator: (ctx) => `rate:auth:${ctx.request.ip()}`,
      skipAuthenticated: false,
      skipAdmins: false,
    })
  }

  /**
   * API-specific rate limiting
   */
  static api() {
    return new RateLimitMiddleware({
      ...this.defaultOptions,
      requests: cmsConfig.rateLimit.apiRequests,
      window: cmsConfig.rateLimit.apiWindow,
      keyGenerator: (ctx) => {
        const user = ctx.auth?.user
        if (user) {
          return `rate:api:user:${user.id}:${ctx.request.url().split('?')[0]}`
        }
        return `rate:api:ip:${ctx.request.ip()}:${ctx.request.url().split('?')[0]}`
      },
      skipAdmins: true,
    })
  }

  constructor(private options: Required<RateLimitOptions>) {}

  async handle(ctx: HttpContext, next: NextFn) {
    // Skip if configured to skip authenticated users
    if (this.options.skipAuthenticated && ctx.auth?.isAuthenticated) {
      return next()
    }

    // Skip if configured to skip admins
    if (this.options.skipAdmins && (ctx.auth?.user as any)?.role === 'admin') {
      return next()
    }

    const key = this.options.keyGenerator(ctx)
    const now = Date.now()
    const windowMs = this.options.window * 1000
    const windowStart = now - windowMs

    try {
      // Use sorted set with timestamps for sliding window
      const redisKey = `ratelimit:${key}`

      // Remove old entries
      await redis.zremrangebyscore(redisKey, 0, windowStart)

      // Count current requests in window
      const currentCount = await redis.zcard(redisKey)

      if (currentCount >= this.options.requests) {
        // Get oldest entry to calculate retry-after
        const oldest = await redis.zrange(redisKey, 0, 0, 'WITHSCORES')
        const oldestTimestamp = oldest.length >= 2 ? Number(oldest[1]) : now
        const retryAfter = Math.ceil((oldestTimestamp + windowMs - now) / 1000)

        ctx.response.header('X-RateLimit-Limit', String(this.options.requests))
        ctx.response.header('X-RateLimit-Remaining', '0')
        ctx.response.header('X-RateLimit-Reset', String(Math.ceil((now + windowMs) / 1000)))
        ctx.response.header('Retry-After', String(Math.max(1, retryAfter)))

        return ctx.response.status(429).json({
          error: 'Too many requests. Please try again later.',
          retryAfter: Math.max(1, retryAfter),
        })
      }

      // Add current request
      await redis.zadd(redisKey, { score: now, member: `${now}:${Math.random()}` })

      // Set expiry on the key
      await redis.expire(redisKey, this.options.window + 10)

      // Set rate limit headers
      ctx.response.header('X-RateLimit-Limit', String(this.options.requests))
      ctx.response.header('X-RateLimit-Remaining', String(this.options.requests - currentCount - 1))
      ctx.response.header('X-RateLimit-Reset', String(Math.ceil((now + windowMs) / 1000)))

      return next()
    } catch (error) {
      // If Redis fails, allow the request but log the error
      // Rate limit middleware error
      return next()
    }
  }
}

/**
 * Factory functions for route middleware
 */
export const rateLimit = RateLimitMiddleware.make.bind(RateLimitMiddleware)
export const rateLimitAuth = RateLimitMiddleware.auth.bind(RateLimitMiddleware)
export const rateLimitApi = RateLimitMiddleware.api.bind(RateLimitMiddleware)
