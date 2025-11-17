import type { HttpContext } from '@adonisjs/core/http'
import UrlPatternService from '#services/url_pattern_service'
import LocaleService from '#services/locale_service'

export default class PatternsController {
  /**
   * GET /api/url-patterns
   * Returns all URL patterns
   */
  async index({ response }: HttpContext) {
    // Ensure defaults exist for all post types across supported locales
    const locales = LocaleService.getSupportedLocales()
    await UrlPatternService.ensureDefaultsForAll(locales)
    const patterns = await UrlPatternService.getAllPatterns()
    return response.ok({ data: patterns, meta: { count: patterns.length } })
  }

  /**
   * PUT /api/url-patterns/:locale
   * Upsert the default pattern for a given postType + locale
   * Body: { postType: string, pattern: string, isDefault?: boolean }
   */
  async upsert({ params, request, response }: HttpContext) {
    const { locale } = params
    const { postType, pattern, isDefault = true } = request.only(['postType', 'pattern', 'isDefault'])

    if (!postType || typeof postType !== 'string') {
      return response.badRequest({ error: 'postType is required' })
    }
    if (!pattern || typeof pattern !== 'string') {
      return response.badRequest({ error: 'pattern is required' })
    }
    if (!(pattern.includes('{slug}') || pattern.includes(':slug'))) {
      return response.badRequest({ error: 'pattern must include {slug} token' })
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


