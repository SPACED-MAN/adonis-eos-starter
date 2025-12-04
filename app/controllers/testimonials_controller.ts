import type { HttpContext } from '@adonisjs/core/http'
import Post from '#models/post'
import db from '@adonisjs/lucid/services/db'

/**
 * TestimonialsController
 *
 * Dedicated API for Testimonial post types, so /api/posts can remain type-agnostic.
 * Permalinks are disabled for testimonials, so this controller only returns summaries
 * for use in modules like Testimonial List.
 */
export default class TestimonialsController {
  /**
   * GET /api/testimonials
   * List testimonial summaries for use in modules like Testimonial List.
   *
   * Query params:
   * - status: filter by post status (e.g. published)
   * - locale: filter by locale
   * - ids: optional comma-separated testimonial post IDs to include
   * - limit: optional max rows (default 50)
   */
  async index({ request, response }: HttpContext) {
    const status = String(request.input('status', '')).trim()
    const locale = String(request.input('locale', '')).trim()
    const sortOrderRaw = String(request.input('sortOrder', 'desc')).trim()
    const sortOrder = sortOrderRaw.toLowerCase() === 'asc' ? 'asc' : 'desc'
    const limit = Math.min(100, Math.max(1, Number(request.input('limit', 50)) || 50))

    const idsParam = String(request.input('ids', '')).trim()
    const ids: string[] = idsParam
      ? idsParam
          .split(',')
          .map((v) => v.trim())
          .filter(Boolean)
      : []

    const query = Post.query().where('type', 'testimonial')

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

    // Load testimonial custom fields (author_name, author_title, quote, photo)
    const testimonialIds = rows.map((p) => p.id as string)

    const cfRows = await db
      .from('post_custom_field_values as v')
      .whereIn('v.post_id', testimonialIds)
      .whereIn('v.field_slug', ['author_name', 'author_title', 'quote', 'photo'])
      .select('v.post_id', 'v.field_slug', 'v.value')

    const byPostId = new Map<
      string,
      { author_name?: string; author_title?: string; quote?: string; photo_id?: string }
    >()

    for (const r of cfRows as any[]) {
      const pid = String(r.post_id)
      let entry = byPostId.get(pid)
      if (!entry) {
        entry = {}
        byPostId.set(pid, entry)
      }

      const slug = String(r.field_slug)
      let rawVal: any = r.value

      // Values are stored as JSON. For media fields this can be:
      // - a plain string media ID: `"uuid"`
      // - an object: `{ id: 'uuid', url: '/uploads/...' }`
      if (typeof rawVal === 'string') {
        try {
          rawVal = JSON.parse(rawVal)
        } catch {
          // leave as stored
        }
      }

      if (slug === 'author_name') {
        entry.author_name = String(rawVal ?? '')
      }
      if (slug === 'author_title') {
        entry.author_title = String(rawVal ?? '')
      }
      if (slug === 'quote') {
        entry.quote = String(rawVal ?? '')
      }
      if (slug === 'photo') {
        let mediaId: string | null = null

        if (typeof rawVal === 'string') {
          mediaId = rawVal || null
        } else if (rawVal && typeof rawVal === 'object' && (rawVal as any).id) {
          mediaId = String((rawVal as any).id)
        }

        entry.photo_id = mediaId || ''
      }
    }

    const items = rows.map((p) => {
      const pid = String(p.id)
      const extras = byPostId.get(pid)

      const authorName = extras?.author_name || p.title || 'Testimonial'
      const authorTitle = extras?.author_title || null
      const quote = extras?.quote || null
      const imageId = extras?.photo_id || null

      return {
        id: pid,
        authorName,
        authorTitle,
        quote,
        imageId,
      }
    })

    return response.ok({ data: items })
  }
}
