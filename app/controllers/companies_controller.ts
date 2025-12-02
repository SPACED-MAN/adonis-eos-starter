import type { HttpContext } from '@adonisjs/core/http'
import Post from '#models/post'
import db from '@adonisjs/lucid/services/db'

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
    const ids: string[] = idsParam ? idsParam.split(',').map((v) => v.trim()).filter(Boolean) : []

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

    const rows = await query.orderBy('title', sortOrder).limit(limit)

    if (rows.length === 0) {
      return response.ok({ data: [] })
    }

    const items = rows.map((p) => {
      const pid = String(p.id)
      const featuredImageId = (p as any).featuredImageId || (p as any).featured_image_id || null

      return {
        id: pid,
        title: p.title || 'Company',
        slug: p.slug,
        imageId: featuredImageId ? String(featuredImageId) : null,
      }
    })

    return response.ok({ data: items })
  }
}


