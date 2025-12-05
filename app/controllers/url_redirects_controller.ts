import type { HttpContext } from '@adonisjs/core/http'
import db from '@adonisjs/lucid/services/db'

export default class UrlRedirectsController {
  /**
   * GET /api/redirects
   */
  async index({ request, response }: HttpContext) {
    const type = String(request.input('type', '')).trim()
    const query = db
      .from('url_redirects')
      .select('url_redirects.*')
      .orderBy('url_redirects.created_at', 'desc')
    if (type) {
      query.leftJoin('posts', 'url_redirects.post_id', 'posts.id').where('posts.type', type)
    }
    const rows = await query
    return response.ok({ data: rows, meta: { count: rows.length } })
  }

  /**
   * POST /api/redirects
   * Body: { fromPath: string, toPath: string, httpStatus?: number, locale?: string | null }
   */
  async store({ request, response }: HttpContext) {
    const {
      fromPath,
      toPath,
      httpStatus = 301,
      locale = null,
    } = request.only(['fromPath', 'toPath', 'httpStatus', 'locale'])
    if (!fromPath || !toPath) {
      return response.badRequest({ error: 'fromPath and toPath are required' })
    }
    const now = new Date()
    const [created] = await db
      .table('url_redirects')
      .insert({
        from_path: fromPath,
        to_path: toPath,
        http_status: httpStatus,
        locale: locale || null,
        created_at: now,
        updated_at: now,
      })
      .returning('*')
    return response.created({ data: created, message: 'Redirect created' })
  }

  /**
   * PUT /api/redirects/:id
   * Body: { fromPath?, toPath?, httpStatus?, locale? }
   */
  async update({ params, request, response }: HttpContext) {
    const { id } = params
    const payload = request.only(['fromPath', 'toPath', 'httpStatus', 'locale'])
    const updateData: Record<string, any> = { updated_at: new Date() }
    if (payload.fromPath !== undefined) updateData.from_path = payload.fromPath
    if (payload.toPath !== undefined) updateData.to_path = payload.toPath
    if (payload.httpStatus !== undefined) updateData.http_status = payload.httpStatus
    if (payload.locale !== undefined) updateData.locale = payload.locale || null

    const [updated] = await db
      .from('url_redirects')
      .where('id', id)
      .update(updateData)
      .returning('*')
    if (!updated) {
      return response.notFound({ error: 'Redirect not found' })
    }
    return response.ok({ data: updated, message: 'Redirect updated' })
  }

  /**
   * DELETE /api/redirects/:id
   */
  async destroy({ params, response }: HttpContext) {
    const { id } = params
    const deleted = await db.from('url_redirects').where('id', id).delete()
    if (!deleted) {
      return response.notFound({ error: 'Redirect not found' })
    }
    return response.noContent()
  }

  /**
   * GET /api/redirect-settings/:postType
   * Get redirect settings for a specific post type
   */
  async getSettings({ params, response }: HttpContext) {
    const { postType } = params
    const settings = await db
      .from('post_type_settings')
      .where('post_type', postType)
      .first()

    if (!settings) {
      // Return default settings if none exist
      return response.ok({
        data: {
          postType,
          autoRedirectOnSlugChange: false, // Default disabled
        },
      })
    }

    return response.ok({
      data: {
        postType,
        autoRedirectOnSlugChange: !!(settings as any).settings?.autoRedirectOnSlugChange,
      },
    })
  }

  /**
   * POST /api/redirect-settings/:postType
   * Update redirect settings for a specific post type
   * Body: { autoRedirectOnSlugChange: boolean }
   */
  async updateSettings({ params, request, response }: HttpContext) {
    const { postType } = params
    const { autoRedirectOnSlugChange } = request.only(['autoRedirectOnSlugChange'])

    // Check if settings exist for this post type
    const existing = await db
      .from('post_type_settings')
      .where('post_type', postType)
      .first()

    const now = new Date()

    if (existing) {
      // Update existing settings
      const currentSettings = (existing as any).settings || {}
      const updatedSettings = {
        ...currentSettings,
        autoRedirectOnSlugChange: !!autoRedirectOnSlugChange,
      }

      await db
        .from('post_type_settings')
        .where('post_type', postType)
        .update({
          settings: JSON.stringify(updatedSettings),
          updated_at: now,
        })
    } else {
      // Create new settings entry
      await db.table('post_type_settings').insert({
        post_type: postType,
        settings: JSON.stringify({
          autoRedirectOnSlugChange: !!autoRedirectOnSlugChange,
        }),
        created_at: now,
        updated_at: now,
      })
    }

    return response.ok({
      data: {
        postType,
        autoRedirectOnSlugChange: !!autoRedirectOnSlugChange,
      },
      message: 'Settings updated',
    })
  }
}
