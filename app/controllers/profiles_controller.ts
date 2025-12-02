import type { HttpContext } from '@adonisjs/core/http'
import Post from '#models/post'
import db from '@adonisjs/lucid/services/db'

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
    const ids: string[] = idsParam ? idsParam.split(',').map((v) => v.trim()).filter(Boolean) : []

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

    const rows = await query.orderBy('updated_at', sortOrder).limit(limit)

    if (rows.length === 0) {
      return response.ok({ data: [] })
    }

    // Load profile custom fields (first_name, last_name, role, profile_image)
    const profileIds = rows.map((p) => p.id as string)

    const cfRows = await db
      .from('post_custom_field_values as v')
      .whereIn('v.post_id', profileIds)
      .whereIn('v.field_slug', ['first_name', 'last_name', 'role', 'profile_image'])
      .select('v.post_id', 'v.field_slug', 'v.value')

    const byPostId = new Map<
      string,
      { first_name?: string; last_name?: string; role?: string; profile_image_id?: string }
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
      if (typeof rawVal === 'string') {
        try {
          rawVal = JSON.parse(rawVal)
        } catch {
          // leave as stored
        }
      }
      if (slug === 'first_name') entry.first_name = String(rawVal ?? '')
      if (slug === 'last_name') entry.last_name = String(rawVal ?? '')
      if (slug === 'role') entry.role = String(rawVal ?? '')
      if (slug === 'profile_image') entry.profile_image_id = String(rawVal ?? '')
    }

    const avatarIds = Array.from(
      new Set(
        Array.from(byPostId.values())
          .map((v) => v.profile_image_id)
          .filter(Boolean) as string[],
      ),
    )

    let avatarsById = new Map<string, string>()
    if (avatarIds.length > 0) {
      const avatarRows = await db
        .from('media_assets')
        .whereIn('id', avatarIds)
        .select('id', 'url')

      avatarsById = new Map(
        avatarRows.map((a: any) => [String(a.id), String(a.url || '')]),
      )
    }

    const items = rows.map((p) => {
      const pid = String(p.id)
      const extras = byPostId.get(pid)
      const first = extras?.first_name || ''
      const last = extras?.last_name || ''
      const name = [first, last].filter(Boolean).join(' ') || p.title || 'Profile'
      const role = extras?.role || null
      const bio = p.excerpt ?? null
      const avatarUrl =
        (extras?.profile_image_id && avatarsById.get(extras.profile_image_id)) || null

      return {
        id: pid,
        name,
        role,
        bio,
        slug: p.slug,
        imageUrl: avatarUrl,
      }
    })

    return response.ok({ data: items })
  }
}


