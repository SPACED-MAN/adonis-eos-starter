import type { HttpContext } from '@adonisjs/core/http'
import db from '@adonisjs/lucid/services/db'
import UrlRedirect from '#models/url_redirect'
import roleRegistry from '#services/role_registry'

export default class UrlRedirectsController {
  /**
   * GET /api/redirects
   */
  async index({ request, response, auth }: HttpContext) {
    const role = (auth.use('web').user as any)?.role
    if (!roleRegistry.hasPermission(role, 'admin.settings.view')) {
      return response.forbidden({ error: 'Not allowed to view redirects' })
    }
    const type = String(request.input('type', '')).trim()
    const query = UrlRedirect.query().orderBy('createdAt', 'desc')
    if (type) {
      query
        .join('posts', 'url_redirects.post_id', 'posts.id')
        .where('posts.type', type)
        .select('url_redirects.*')
    }
    const rows = await query.preload('post')
    return response.ok({
      data: rows.map((r) => ({
        id: r.id,
        fromPath: r.fromPath,
        toPath: r.toPath,
        httpStatus: r.httpStatus,
        locale: r.locale ?? null,
        postId: r.postId ?? null,
        postTitle: r.post?.title ?? null,
        createdAt: r.createdAt.toISO(),
      })),
      meta: { count: rows.length },
    })
  }

  /**
   * POST /api/redirects
   * Body: { fromPath: string, toPath: string, httpStatus?: number, locale?: string | null }
   */
  async store({ request, response, auth }: HttpContext) {
    const role = (auth.use('web').user as any)?.role
    if (!roleRegistry.hasPermission(role, 'admin.settings.update')) {
      return response.forbidden({ error: 'Not allowed to create redirects' })
    }
    const {
      fromPath,
      toPath,
      httpStatus = 301,
      locale = null,
      postId = null,
    } = request.only(['fromPath', 'toPath', 'httpStatus', 'locale', 'postId'])
    if (!fromPath || !toPath) {
      return response.badRequest({ error: 'fromPath and toPath are required' })
    }
    const created = await UrlRedirect.create({
      fromPath,
      toPath,
      httpStatus,
      locale: locale || null,
      postId: postId || null,
    })
    return response.created({ data: created, message: 'Redirect created' })
  }

  /**
   * PUT /api/redirects/:id
   * Body: { fromPath?, toPath?, httpStatus?, locale? }
   */
  async update({ params, request, response, auth }: HttpContext) {
    const role = (auth.use('web').user as any)?.role
    if (!roleRegistry.hasPermission(role, 'admin.settings.update')) {
      return response.forbidden({ error: 'Not allowed to update redirects' })
    }
    const { id } = params
    const payload = request.only(['fromPath', 'toPath', 'httpStatus', 'locale'])
    const rec = await UrlRedirect.find(id)
    if (!rec) {
      return response.notFound({ error: 'Redirect not found' })
    }
    if (payload.fromPath !== undefined) rec.fromPath = payload.fromPath
    if (payload.toPath !== undefined) rec.toPath = payload.toPath
    if (payload.httpStatus !== undefined) rec.httpStatus = Number(payload.httpStatus)
    if (payload.locale !== undefined) rec.locale = payload.locale || null
    await rec.save()
    return response.ok({ data: rec, message: 'Redirect updated' })
  }

  /**
   * DELETE /api/redirects/:id
   */
  async destroy({ params, response, auth }: HttpContext) {
    const role = (auth.use('web').user as any)?.role
    if (!roleRegistry.hasPermission(role, 'admin.settings.update')) {
      return response.forbidden({ error: 'Not allowed to delete redirects' })
    }
    const { id } = params
    const deleted = await UrlRedirect.query().where('id', id).delete()
    if (!deleted) {
      return response.notFound({ error: 'Redirect not found' })
    }
    return response.noContent()
  }

  /**
   * POST /api/redirects/bulk
   * Body: { action: 'delete', ids: string[] }
   */
  async bulk({ request, response, auth }: HttpContext) {
    const role = (auth.use('web').user as any)?.role
    if (!roleRegistry.hasPermission(role, 'admin.settings.update')) {
      return response.forbidden({ error: 'Not allowed to perform bulk actions' })
    }

    const { action, ids } = request.only(['action', 'ids'])
    if (!Array.isArray(ids) || ids.length === 0) {
      return response.badRequest({ error: 'No IDs provided' })
    }

    if (action === 'delete') {
      await UrlRedirect.query().whereIn('id', ids).delete()
      return response.ok({ message: `${ids.length} redirects deleted` })
    }

    if (action === 'status-301') {
      await UrlRedirect.query().whereIn('id', ids).update({ http_status: 301, updated_at: new Date() })
      return response.ok({ message: `${ids.length} redirects updated to 301` })
    }

    if (action === 'status-302') {
      await UrlRedirect.query().whereIn('id', ids).update({ http_status: 302, updated_at: new Date() })
      return response.ok({ message: `${ids.length} redirects updated to 302` })
    }

    return response.badRequest({ error: 'Invalid action' })
  }

  /**
   * GET /api/redirect-settings/:postType
   * Get redirect settings for a specific post type
   */
  async getSettings({ params, response, auth }: HttpContext) {
    const role = (auth.use('web').user as any)?.role
    if (!roleRegistry.hasPermission(role, 'admin.settings.view')) {
      return response.forbidden({ error: 'Not allowed to view redirect settings' })
    }
    const { postType } = params
    const settings = await db.from('post_type_settings').where('post_type', postType).first()

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
  async updateSettings({ params, request, response, auth }: HttpContext) {
    const role = (auth.use('web').user as any)?.role
    if (!roleRegistry.hasPermission(role, 'admin.settings.update')) {
      return response.forbidden({ error: 'Not allowed to update redirect settings' })
    }
    const { postType } = params
    const { autoRedirectOnSlugChange } = request.only(['autoRedirectOnSlugChange'])

    // Check if settings exist for this post type
    const existing = await db.from('post_type_settings').where('post_type', postType).first()

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
