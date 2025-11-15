import db from '@adonisjs/lucid/services/db'

class UrlPatternService {
  private cached: Map<string, string> = new Map()

  private async getPatternForLocale(locale: string): Promise<string> {
    if (this.cached.has(locale)) return this.cached.get(locale)!
    const rec = await db.from('url_patterns').where('locale', locale).first()
    const pattern = rec?.pattern || '/:locale/posts/:slug'
    this.cached.set(locale, pattern)
    return pattern
  }

  /**
   * Build a path (no protocol/host) for a post using the locale-specific pattern.
   * Supported tokens: :locale, :slug
   */
  async buildPostPath(slug: string, locale: string): Promise<string> {
    const pattern = await this.getPatternForLocale(locale)
    let path = pattern.replace(':slug', encodeURIComponent(slug))
    path = path.replace(':locale', encodeURIComponent(locale))
    // Ensure leading slash
    if (!path.startsWith('/')) path = '/' + path
    return path
  }

  async buildPostUrl(slug: string, locale: string, protocol: string, host: string): Promise<string> {
    const path = await this.buildPostPath(slug, locale)
    return `${protocol}://${host}${path}`
  }
}

const urlPatternService = new UrlPatternService()
export default urlPatternService


