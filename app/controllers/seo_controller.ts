import type { HttpContext } from '@adonisjs/core/http'
import sitemapService from '#services/sitemap_service'
import urlPatternService from '#services/url_pattern_service'

export default class SeoController {
  async sitemapStatus({ request, response }: HttpContext) {
    const protocol = request.protocol() || 'https'
    const host = request.host() || request.hostname()
    const cacheKey = `${protocol}://${host}`
    const lastBuiltAt = sitemapService.getLastBuiltAt(cacheKey)
    response.type('application/json')
    return response.ok({
      data: {
        sitemapUrl: `${protocol}://${host}/sitemap.xml`,
        lastBuiltAt: lastBuiltAt ? new Date(lastBuiltAt).toISOString() : null,
        cacheTtlSeconds: 300,
      },
    })
  }

  async sitemapRebuild({ request, response }: HttpContext) {
    const protocol = request.protocol() || 'https'
    const host = request.host() || request.hostname() || 'localhost'
    sitemapService.clearCache()
    await sitemapService.generate({ protocol, host })
    response.type('application/json')
    return response.ok({ message: 'Sitemap rebuilt' })
  }

  async populateCanonicalUrls({ response }: HttpContext) {
    const result = await urlPatternService.populateCanonicalUrls()
    return response.ok({
      message: `Updated ${result.updated} posts, failed ${result.failed}`,
      data: result,
    })
  }
}
