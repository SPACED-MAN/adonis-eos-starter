import type { HttpContext } from '@adonisjs/core/http'
import Post from '#models/post'

/**
 * BlogsController
 *
 * Dedicated API for Blog post types, so /api/posts can remain type-agnostic.
 */
export default class BlogsController {
  /**
   * GET /api/blogs
   * List blog summaries for use in modules like Blog List.
   *
   * Query params:
   * - status: filter by post status (e.g. published)
   * - locale: filter by locale
   * - ids: optional comma-separated blog post IDs to include
   * - limit: optional max rows (default 20)
   */
  async index({ request, response }: HttpContext) {
    const status = String(request.input('status', '')).trim()
    const locale = String(request.input('locale', '')).trim()
    const sortOrderRaw = String(request.input('sortOrder', 'desc')).trim()
    const sortOrder = sortOrderRaw.toLowerCase() === 'asc' ? 'asc' : 'desc'
    const limit = Math.min(100, Math.max(1, Number(request.input('limit', 20)) || 20))

    const idsParam = String(request.input('ids', '')).trim()
    const ids: string[] = idsParam
      ? idsParam
          .split(',')
          .map((v) => v.trim())
          .filter(Boolean)
      : []

    const query = Post.query().where('type', 'blog')

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
      .orderBy('updated_at', sortOrder)
      .limit(limit)
      .preload('featuredImage')

    if (rows.length === 0) {
      return response.ok({ data: [] })
    }

    const items = rows.map((p) => {
      const pid = String(p.id)
      const featuredImage = p.featuredImage
      const updatedAtRaw = (p as any).updatedAt ?? (p as any).updated_at ?? null
      let updatedAt: string | null = null
      if (updatedAtRaw instanceof Date) {
        updatedAt = updatedAtRaw.toISOString()
      } else if (typeof updatedAtRaw === 'string') {
        updatedAt = updatedAtRaw
      }

      const image = featuredImage ? {
        id: featuredImage.id,
        url: featuredImage.url,
        mimeType: featuredImage.mimeType,
        altText: featuredImage.altText,
        metadata: featuredImage.metadata,
      } : null

      return {
        id: pid,
        title: p.title || 'Blog post',
        slug: p.slug,
        excerpt: p.excerpt ?? null,
        updatedAt,
        image,
      }
    })

    return response.ok({ data: items })
  }
}
