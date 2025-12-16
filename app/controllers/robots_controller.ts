import type { HttpContext } from '@adonisjs/core/http'

export default class RobotsController {
  async index({ request, response }: HttpContext) {
    const protocol = request.protocol() || 'https'
    const host = request.host() || request.hostname() || 'localhost'
    const baseUrl = `${protocol}://${host}`

    // Generate robots.txt content
    const robotsContent = `User-agent: *
Allow: /

# Sitemap
Sitemap: ${baseUrl}/sitemap.xml
`

    return response
      .status(200)
      .header('Content-Type', 'text/plain; charset=utf-8')
      .header('X-Content-Type-Options', 'nosniff')
      .header('Cache-Control', 'public, max-age=3600')
      .send(robotsContent)
  }
}
