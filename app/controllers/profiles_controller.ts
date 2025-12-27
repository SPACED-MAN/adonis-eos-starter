import type { HttpContext } from '@adonisjs/core/http'
import Post from '#models/post'
import PostCustomFieldValue from '#models/post_custom_field_value'
import urlPatternService from '#services/url_pattern_service'

/**
 * ProfilesController
 *
 * Dedicated API for Profile post types, so /api/posts can remain type-agnostic.
 */
export default class ProfilesController {
  /**
   * GET /api/profiles
   * List profile summaries for use in modules like Profile List.
   *
   * Query params:
   * - status: filter by post status (e.g. published)
   * - locale: filter by locale
   * - ids: optional comma-separated profile IDs to include
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

    const query = Post.query().where('type', 'profile')

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

    // Build paths in bulk for efficiency
    const postIds = rows.map((p) => p.id)
    const urlMap = await urlPatternService.buildPostPaths(postIds)

    // Load profile custom fields (first_name, last_name, role, profile_image)
    const profileIds = rows.map((p) => p.id as string)

    const cfRows = await PostCustomFieldValue.query()
      .whereIn('postId', profileIds)
      .whereIn('fieldSlug', ['first_name', 'last_name', 'role', 'profile_image'])
      .select('postId', 'fieldSlug', 'value')

    const byPostId = new Map<
      string,
      { first_name?: string; last_name?: string; role?: string; profile_image_id?: string }
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

      // Values are stored as JSON. For historical reasons, media fields can be:
      // - a plain string media ID: `"uuid"`
      // - an object: `{ id: 'uuid', url: '/uploads/...' }`
      if (typeof rawVal === 'string') {
        try {
          rawVal = JSON.parse(rawVal)
        } catch {
          // leave as stored
        }
      }

      if (slug === 'first_name') {
        entry.first_name = String(rawVal ?? '')
      }

      if (slug === 'last_name') {
        entry.last_name = String(rawVal ?? '')
      }

      if (slug === 'role') {
        entry.role = String(rawVal ?? '')
      }

      if (slug === 'profile_image') {
        let mediaId: string | null = null

        if (typeof rawVal === 'string') {
          mediaId = rawVal || null
        } else if (rawVal && typeof rawVal === 'object' && (rawVal as any).id) {
          mediaId = String((rawVal as any).id)
        }

        entry.profile_image_id = mediaId || ''
      }
    }

    const items = rows.map((p) => {
      const pid = String(p.id)
      const extras = byPostId.get(pid)
      const first = extras?.first_name || ''
      const last = extras?.last_name || ''
      const name = [first, last].filter(Boolean).join(' ') || p.title || 'Profile'
      const role = extras?.role || null
      const bio = p.excerpt ?? null
      const featuredImage = p.featuredImage

      const image = featuredImage ? {
        id: featuredImage.id,
        url: featuredImage.url,
        mimeType: featuredImage.mimeType,
        altText: featuredImage.altText,
        metadata: featuredImage.metadata,
      } : null

      return {
        id: pid,
        name,
        role,
        bio,
        slug: p.slug,
        url: urlMap.get(pid) || `/profile/${p.slug}`,
        image,
      }
    })

    return response.ok({ data: items })
  }
}
