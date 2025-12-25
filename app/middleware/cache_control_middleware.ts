import type { HttpContext } from '@adonisjs/core/http'
import cmsConfig from '#config/cms'

export default class CacheControlMiddleware {
  public async handle(ctx: HttpContext, next: () => Promise<void>) {
    await next()

    // Skip if cache is disabled globally
    if (!cmsConfig.cache.enabled) {
      ctx.response.header('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate')
      ctx.response.header('Pragma', 'no-cache')
      ctx.response.header('Expires', '0')
      return
    }

    // Skip admin and non-GET
    if (ctx.request.url().startsWith('/admin') || !['GET', 'HEAD'].includes(ctx.request.method())) {
      return
    }

    // Only cache successful html responses
    const contentType = ctx.response.getHeader('content-type') as string | undefined
    if ((ctx.response.getStatus() ?? 200) >= 200 && (ctx.response.getStatus() ?? 200) < 400) {
      if (contentType && contentType.includes('text/html')) {
        // CDN-friendly caching
        ctx.response.header(
          'Cache-Control',
          'public, max-age=60, s-maxage=3600, stale-while-revalidate=604800'
        )
        ctx.response.header('Vary', 'Accept-Encoding')
      }
    }
  }
}
