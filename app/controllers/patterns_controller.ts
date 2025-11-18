import type { HttpContext } from '@adonisjs/core/http'
import UrlPatternService from '#services/url_pattern_service'
import db from '@adonisjs/lucid/services/db'
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
      const oldPattern = existing.pattern
      const updated = await UrlPatternService.updatePattern(existing.id, { pattern, isDefault })

      // If pattern actually changed, create redirects from old -> new for all posts of this type+locale
      if (oldPattern !== pattern) {
        const posts = await db
          .from('posts')
          .select('id', 'type', 'slug', 'locale', 'created_at')
          .where({ type: postType, locale })

        const now = new Date()
        for (const p of posts) {
          const createdAt = p.created_at ? new Date(p.created_at) : undefined
          const fromPath = UrlPatternService.buildPathWithPattern(oldPattern, p.slug, p.locale, createdAt)
          const toPath = UrlPatternService.buildPathWithPattern(pattern, p.slug, p.locale, createdAt)
          if (fromPath !== toPath) {
            try {
              const existingRedirect = await db.from('url_redirects').where('from_path', fromPath).first()
              if (!existingRedirect) {
                await db.table('url_redirects').insert({
                  from_path: fromPath,
                  to_path: toPath,
                  http_status: 301,
                  locale: p.locale,
                  post_id: p.id,
                  created_at: now,
                  updated_at: now,
                })
              }
            } catch {
              // Ignore conflicts/errors for bulk creation
            }
          }
        }
      }

      return response.ok({ data: updated, message: 'URL pattern updated' })
    } else {
      const created = await UrlPatternService.createPattern(postType, locale, pattern, isDefault)
      return response.ok({ data: created, message: 'URL pattern created' })
    }
  }
}


