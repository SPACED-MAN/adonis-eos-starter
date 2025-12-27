import type { HttpContext } from '@adonisjs/core/http'
import Post from '#models/post'
import urlPatternService from '#services/url_pattern_service'

/**
 * CompaniesController
 *
 * Dedicated API for Company post types, so /api/posts can remain type-agnostic.
 */
export default class CompaniesController {
  /**
   * GET /api/companies
   * List company summaries for use in modules like Company List.
   *
   * Query params:
   * - status: filter by post status (e.g. published)
   * - locale: filter by locale
   * - ids: optional comma-separated company post IDs to include
   * - limit: optional max rows (default 50)
   */
  async index({ request, response }: HttpContext) {
    const status = String(request.input('status', '')).trim()
    const locale = String(request.input('locale', '')).trim()
    const sortOrderRaw = String(request.input('sortOrder', 'asc')).trim()
    const sortOrder = sortOrderRaw.toLowerCase() === 'desc' ? 'desc' : 'asc'
    const limit = Math.min(100, Math.max(1, Number(request.input('limit', 50)) || 50))

    const idsParam = String(request.input('ids', '')).trim()
    const ids: string[] = idsParam
      ? idsParam
          .split(',')
          .map((v) => v.trim())
          .filter(Boolean)
      : []

    const query = Post.query().where('type', 'company')

    if (status) {
      query.where('status', status)
    }
    if (locale) {
      query.where('locale', locale)
    }
    if (ids.length > 0) {
      query.whereIn('id', ids)
    }

    const rows = await query
      .orderBy('title', sortOrder)
      .limit(limit)
      .preload('customFieldValues')
      .preload('featuredImage')

    if (rows.length === 0) {
      return response.ok({ data: [] })
    }

    // Build paths in bulk for efficiency
    const postIds = rows.map((p) => p.id)
    const urlMap = await urlPatternService.buildPostPaths(postIds)

    const items = rows.map((p) => {
      const pid = String(p.id)
      const featuredImageId = p.featuredImageId || null
      const featuredImage = p.featuredImage

      const image = featuredImage
        ? {
            id: featuredImage.id,
            url: featuredImage.url,
            mimeType: featuredImage.mimeType,
            altText: featuredImage.altText,
            metadata: featuredImage.metadata,
          }
        : null

      const customFields: Record<string, any> = {}
      if (p.customFieldValues) {
        for (const cf of p.customFieldValues) {
          customFields[cf.fieldSlug] = cf.value
        }
      }

      return {
        id: pid,
        title: p.title || 'Company',
        slug: p.slug,
        url: urlMap.get(pid) || `/company/${p.slug}`,
        image,
        customFields,
      }
    })

    return response.ok({ data: items })
  }
}
