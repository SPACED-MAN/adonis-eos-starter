import type { HttpContext } from '@adonisjs/core/http'
import sitemapService from '#services/sitemap_service'

export default class SitemapController {
  async index({ request, response }: HttpContext) {
    const protocol = request.protocol() || 'https'
    const host = request.host() || request.hostname()
    const xml = await sitemapService.generate({ protocol, host })
    return response
      .status(200)
      .header('Content-Type', 'application/xml; charset=utf-8')
      .header('X-Content-Type-Options', 'nosniff')
      .header('Cache-Control', 'public, max-age=300')
      .send(xml)
  }
}

