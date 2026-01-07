import type { HttpContext } from '@adonisjs/core/http'
import Post from '#models/post'
import PostCustomFieldValue from '#models/post_custom_field_value'

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

    const total = await query.clone().count('* as total').first().then((r) => Number(r?.$extras.total || 0))
    const rows = await query.orderBy('updated_at', sortOrder).limit(limit).preload('featuredMedia')

    if (rows.length === 0) {
      return response.ok({ data: [], meta: { total: 0 } })
    }

    // Load testimonial custom fields (author_name, author_title, quote)
    const testimonialIds = rows.map((p) => p.id as string)

    const cfRows = await PostCustomFieldValue.query()
      .whereIn('postId', testimonialIds)
      .whereIn('fieldSlug', ['author_name', 'author_title', 'quote'])
      .select('postId', 'fieldSlug', 'value')

    const byPostId = new Map<
      string,
      { author_name?: string; author_title?: string; quote?: string }
    >()

    for (const r of cfRows as any[]) {
      const pid = String((r as any).postId || (r as any).post_id)
      let entry = byPostId.get(pid)
      if (!entry) {
        entry = {}
        byPostId.set(pid, entry)
      }

      const slug = String((r as any).fieldSlug || (r as any).field_slug)
      let rawVal: any = (r as any).value

      // Values are stored as JSON
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
    }

    const items = rows.map((p) => {
      const pid = String(p.id)
      const extras = byPostId.get(pid)
      const featuredMedia = p.featuredMedia

      const authorName = extras?.author_name || p.title || 'Testimonial'
      const authorTitle = extras?.author_title || null
      const quote = extras?.quote || null

      const image = featuredMedia
        ? {
            id: featuredMedia.id,
            url: featuredMedia.url,
            mimeType: featuredMedia.mimeType,
            altText: featuredMedia.altText,
            metadata: featuredMedia.metadata,
          }
        : null

      return {
        id: pid,
        authorName,
        authorTitle,
        quote,
        image,
      }
    })

    return response.ok({
      data: items,
      meta: {
        total,
        limit,
      },
    })
  }
}
