import type { HttpContext } from '@adonisjs/core/http'
import UrlPatternService from '#services/url_pattern_service'
import postTypeConfigService from '#services/post_type_config_service'

export default class UrlPatternsController {
  /**
   * GET /api/url-patterns
   * Returns all URL patterns
   */
  async index({ response }: HttpContext) {
    // Ensure defaults exist for all post types across supported locales
    const locales = await (await import('#services/locale_service')).default.getSupportedLocales()
    await UrlPatternService.ensureDefaultsForAll(locales)
    const patterns = await UrlPatternService.getAllPatterns()

    // Only expose URL patterns for post types that have permalinks enabled.
    // Post types like "company" and "testimonial" disable permalinks in their config,
    // so they should not appear in the URL Patterns admin UI.
    const filtered = patterns.filter((p: any) => {
      try {
        const cfg = postTypeConfigService.getUiConfig(p.postType)
        return cfg.permalinksEnabled !== false
      } catch {
        // If config lookup fails, default to showing the pattern
        return true
      }
    })

    return response.ok({ data: filtered, meta: { count: filtered.length } })
  }

  /**
   * PUT /api/url-patterns/:locale
   * Upsert the default pattern for a given postType + locale
   * Body: { postType: string, pattern: string, isDefault?: boolean }
   */
  async upsert({ params, request, response }: HttpContext) {
    const { locale } = params
    const {
      postType,
      pattern,
      isDefault = true,
    } = request.only(['postType', 'pattern', 'isDefault'])

    if (!postType || typeof postType !== 'string') {
      return response.badRequest({ error: 'postType is required' })
    }
    if (!pattern || typeof pattern !== 'string') {
      return response.badRequest({ error: 'pattern is required' })
    }
    if (!(pattern.includes('{slug}') || pattern.includes('{path}') || pattern.includes(':slug'))) {
      return response.badRequest({ error: 'pattern must include {slug} or {path} token' })
    }

    // Upsert default pattern (or non-default if explicitly requested)
    const existing = isDefault ? await UrlPatternService.getDefaultPattern(postType, locale) : null
    if (existing) {
      const updated = await UrlPatternService.updatePattern(existing.id, { pattern, isDefault })
      return response.ok({ data: updated, message: 'URL pattern updated' })
    } else {
      const created = await UrlPatternService.createPattern(postType, locale, pattern, isDefault)
      return response.ok({ data: created, message: 'URL pattern created' })
    }
  }
}
