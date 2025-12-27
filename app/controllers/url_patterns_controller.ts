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
        const hasPermalinks = cfg.permalinksEnabled !== false && cfg.urlPatterns.length > 0
        return hasPermalinks
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
   * Body: { postType: string, pattern: string, isDefault?: boolean, aggregatePostId?: string }
   */
  async upsert({ params, request, response }: HttpContext) {
    const { locale: currentLocale } = params
    const {
      postType,
      pattern,
      isDefault = true,
      aggregatePostId = undefined, // Use undefined to know if it was provided
    } = request.only(['postType', 'pattern', 'isDefault', 'aggregatePostId'])

    if (!postType || typeof postType !== 'string') {
      return response.badRequest({ error: 'postType is required' })
    }
    if (!pattern || typeof pattern !== 'string') {
      return response.badRequest({ error: 'pattern is required' })
    }
    if (!(pattern.includes('{slug}') || pattern.includes('{path}') || pattern.includes(':slug'))) {
      return response.badRequest({ error: 'pattern must include {slug} or {path} token' })
    }

    // If aggregatePostId is provided, we want to normalize it to the base translation
    // and apply it to ALL locales for this post type.
    let baseAggregateId = aggregatePostId
    if (aggregatePostId) {
      const Post = (await import('#models/post')).default
      const aggPost = await Post.find(aggregatePostId)
      if (aggPost) {
        baseAggregateId = aggPost.translationOfId || aggPost.id
      }
    }

    // Update or create the specific pattern for this locale
    const existing = isDefault
      ? await UrlPatternService.getDefaultPattern(postType, currentLocale)
      : null
    let result
    if (existing) {
      result = await UrlPatternService.updatePattern(existing.id, {
        pattern,
        isDefault,
        aggregatePostId: baseAggregateId !== undefined ? baseAggregateId : undefined,
      })
    } else {
      result = await UrlPatternService.createPattern(postType, currentLocale, pattern, isDefault)
      if (baseAggregateId !== undefined) {
        await UrlPatternService.updatePattern(result.id, {
          pattern,
          isDefault,
          aggregatePostId: baseAggregateId,
        })
      }
    }

    // Apply the aggregatePostId to ALL other locales for this post type
    if (baseAggregateId !== undefined) {
      const UrlPattern = (await import('#models/url_pattern')).default
      await UrlPattern.query()
        .where('post_type', postType)
        .update({ aggregate_post_id: baseAggregateId })
    }

    return response.ok({ data: result, message: 'URL pattern updated' })
  }
}
