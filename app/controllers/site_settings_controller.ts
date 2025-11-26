import type { HttpContext } from '@adonisjs/core/http'
import siteSettingsService from '#services/site_settings_service'

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
    const payload = request.only([
      'siteTitle',
      'defaultMetaDescription',
      'faviconMediaId',
      'defaultOgMediaId',
      'logoLightMediaId',
      'logoDarkMediaId',
    ])
    const next = await siteSettingsService.upsert({
      siteTitle: payload.siteTitle,
      defaultMetaDescription: payload.defaultMetaDescription,
      faviconMediaId: payload.faviconMediaId,
      defaultOgMediaId: payload.defaultOgMediaId,
      logoLightMediaId: payload.logoLightMediaId,
      logoDarkMediaId: payload.logoDarkMediaId,
    })
    return response.ok({ data: next })
  }
}


