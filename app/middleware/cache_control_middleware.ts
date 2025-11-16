import type { HttpContext } from '@adonisjs/core/http'

export default class CacheControlMiddleware {
  public async handle(ctx: HttpContext, next: () => Promise<void>) {
    await next()

    // Skip admin and non-GET
    if (ctx.request.url().startsWith('/admin') || !['GET', 'HEAD'].includes(ctx.request.method())) {
      return
    }

    // Only cache successful html responses
    const contentType = ctx.response.getHeader('content-type') as string | undefined
    if ((ctx.response.getStatus() ?? 200) >= 200 && (ctx.response.getStatus() ?? 200) < 400) {
      if (contentType && contentType.includes('text/html')) {
        // CDN-friendly caching
        ctx.response.header('Cache-Control', 'public, max-age=60, s-maxage=3600, stale-while-revalidate=604800')
        ctx.response.header('Vary', 'Accept-Encoding')
      }
    }
  }
}



