import type { HttpContext } from '@adonisjs/core/http'
import siteSettingsService from '#services/site_settings_service'
import db from '@adonisjs/lucid/services/db'

export default class SiteSettingsController {
  /**
   * GET /api/site-settings
   */
  async show({ response }: HttpContext) {
    const s = await siteSettingsService.get()
    return response.ok({ data: s })
  }

  /**
   * PATCH /api/site-settings
   * Body: { siteTitle?, defaultMetaDescription?, faviconMediaId?, defaultOgMediaId? }
   */
  async update({ request, response, auth }: HttpContext) {
    const role = (auth.use('web').user as any)?.role
    if (role !== 'admin') return response.forbidden({ error: 'Admin only' })
    const current = await siteSettingsService.get()
    const payload = request.only([
      'siteTitle',
      'defaultMetaDescription',
      'faviconMediaId',
      'defaultOgMediaId',
      'logoLightMediaId',
      'logoDarkMediaId',
      'profileRolesEnabled',
    ])
    const next = await siteSettingsService.upsert({
      siteTitle: payload.siteTitle,
      defaultMetaDescription: payload.defaultMetaDescription,
      faviconMediaId: payload.faviconMediaId,
      defaultOgMediaId: payload.defaultOgMediaId,
      logoLightMediaId: payload.logoLightMediaId,
      logoDarkMediaId: payload.logoDarkMediaId,
      profileRolesEnabled: Array.isArray(payload.profileRolesEnabled)
        ? payload.profileRolesEnabled.filter((r: any) => typeof r === 'string')
        : current.profileRolesEnabled,
    })
    // If some roles were disabled, archive their existing Profiles
    try {
      const prevSet = new Set<string>(current.profileRolesEnabled || [])
      const nextSet = new Set<string>(next.profileRolesEnabled || [])
      const removed: string[] = Array.from(prevSet).filter((r) => !nextSet.has(r))
      if (removed.length > 0) {
        const users = await db.from('users').whereIn('role', removed).select('id')
        const userIds = users.map((u: any) => Number(u.id)).filter((n) => !Number.isNaN(n))
        if (userIds.length > 0) {
          await db.from('posts')
            .where('type', 'profile')
            .whereIn('author_id', userIds)
            .andWhereNot('status', 'archived')
            .update({ status: 'archived', updated_at: new Date() })
        }
      }
    } catch { /* ignore archival errors */ }
    return response.ok({ data: next })
  }
}


