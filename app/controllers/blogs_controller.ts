import type { HttpContext } from '@adonisjs/core/http'
import Post from '#models/post'
import db from '@adonisjs/lucid/services/db'

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
    const ids: string[] = idsParam ? idsParam.split(',').map((v) => v.trim()).filter(Boolean) : []

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

    const rows = await query.orderBy('updated_at', sortOrder).limit(limit)

    if (rows.length === 0) {
      return response.ok({ data: [] })
    }

    // Load blog custom field hero_image so modules can render hero thumbnails.
    const postIds = rows.map((p) => p.id as string)

    const cfRows = await db
      .from('post_custom_field_values as v')
      .whereIn('v.post_id', postIds)
      .whereIn('v.field_slug', ['hero_image'])
      .select('v.post_id', 'v.field_slug', 'v.value')

    const byPostId = new Map<string, { hero_image_id?: string }>()

    for (const r of cfRows as any[]) {
      const pid = String(r.post_id)
      let entry = byPostId.get(pid)
      if (!entry) {
        entry = {}
        byPostId.set(pid, entry)
      }
      const slug = String(r.field_slug)
      let rawVal: any = r.value
      if (typeof rawVal === 'string') {
        try {
          rawVal = JSON.parse(rawVal)
        } catch {
          // leave as stored
        }
      }
      if (slug === 'hero_image') entry.hero_image_id = String(rawVal ?? '')
    }

    const items = rows.map((p) => {
      const pid = String(p.id)
      const extras = byPostId.get(pid)
      const updatedAtRaw = (p as any).updatedAt ?? (p as any).updated_at ?? null
      let updatedAt: string | null = null
      if (updatedAtRaw instanceof Date) {
        updatedAt = updatedAtRaw.toISOString()
      } else if (typeof updatedAtRaw === 'string') {
        updatedAt = updatedAtRaw
      }

      return {
        id: pid,
        title: p.title || 'Blog post',
        slug: p.slug,
        excerpt: p.excerpt ?? null,
        updatedAt,
        imageId: extras?.hero_image_id || null,
      }
    })

    return response.ok({ data: items })
  }
}


