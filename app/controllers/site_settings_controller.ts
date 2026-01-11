import type { HttpContext } from '@adonisjs/core/http'
import siteSettingsService from '#services/site_settings_service'
import roleRegistry from '#services/role_registry'
import siteCustomFieldsService from '#services/site_custom_fields_service'
import db from '@adonisjs/lucid/services/db'
import MediaAsset from '#models/media_asset'
import storageService from '#services/storage_service'
import mediaService from '#services/media_service'

export default class SiteSettingsController {
  /**
   * GET /api/site-settings
   */
  async show({ response, auth }: HttpContext) {
    const user = auth.use('web').user
    const isAdminOrEditor = !!(user && ['admin', 'editor_admin', 'editor'].includes((user as any).role))

    const s = await siteSettingsService.get()
    const defs = siteCustomFieldsService.listDefinitions()
    const vals = await siteCustomFieldsService.getValues()

    // Filter sensitive custom fields
    const publicCustomFields = { ...vals }
    delete publicCustomFields.protected_access_username
    delete publicCustomFields.protected_access_password

    // Resolve media IDs in site settings
    const mediaIds = new Set<string>()
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

    if (s.logoMediaId && uuidRegex.test(s.logoMediaId)) mediaIds.add(s.logoMediaId)
    if (s.faviconMediaId && uuidRegex.test(s.faviconMediaId)) mediaIds.add(s.faviconMediaId)
    if (s.defaultOgMediaId && uuidRegex.test(s.defaultOgMediaId)) mediaIds.add(s.defaultOgMediaId)

    const resolvedMedia = new Map<string, any>()
    if (mediaIds.size > 0) {
      const assets = await MediaAsset.query().whereIn('id', Array.from(mediaIds))
      assets.forEach((a) => {
        resolvedMedia.set(String(a.id), {
          id: a.id,
          url: storageService.resolvePublicUrl(a.url),
          mimeType: a.mimeType,
          metadata: mediaService.resolveMetadataUrls(a.metadata),
          altText: a.altText,
        })
      })
    }

    const data = {
      ...s,
      logoMedia: (s.logoMediaId && resolvedMedia.get(s.logoMediaId)) || s.logoMediaId || null,
      faviconMedia:
        (s.faviconMediaId && resolvedMedia.get(s.faviconMediaId)) || s.faviconMediaId || null,
      defaultOgMedia:
        (s.defaultOgMediaId && resolvedMedia.get(s.defaultOgMediaId)) || s.defaultOgMediaId || null,
      customFieldDefs: isAdminOrEditor ? defs : [],
      customFields: isAdminOrEditor ? vals : publicCustomFields,
    }

    return response.ok({ data })
  }

  /**
   * PATCH /api/site-settings
   * Body: { siteTitle?, defaultMetaDescription?, faviconMediaId?, defaultOgMediaId? }
   */
  async update({ request, response, auth }: HttpContext) {
    const role = (auth.use('web').user as any)?.role
    if (!roleRegistry.hasPermission(role, 'admin.settings.update')) {
      return response.forbidden({ error: 'Not allowed to update site settings' })
    }
    const current = await siteSettingsService.get()
    const payload = request.only([
      'siteTitle',
      'defaultMetaDescription',
      'faviconMediaId',
      'defaultOgMediaId',
      'logoMediaId',
      'isMaintenanceMode',
      'profileRolesEnabled',
      'socialSettings',
      'defaultThemeMode',
    ])
    const next = await siteSettingsService.upsert({
      siteTitle: payload.siteTitle,
      defaultMetaDescription: payload.defaultMetaDescription,
      faviconMediaId: payload.faviconMediaId,
      defaultOgMediaId: payload.defaultOgMediaId,
      logoMediaId: payload.logoMediaId,
      isMaintenanceMode:
        payload.isMaintenanceMode !== undefined ? !!payload.isMaintenanceMode : undefined,
      profileRolesEnabled: Array.isArray(payload.profileRolesEnabled)
        ? payload.profileRolesEnabled.filter((r: any) => typeof r === 'string')
        : current.profileRolesEnabled,
      socialSettings: payload.socialSettings,
    })
    // Upsert site-level custom fields if provided
    const customFields = request.input('customFields')
    if (customFields && typeof customFields === 'object') {
      await siteCustomFieldsService.upsertValues(customFields)
    }
    // Clear site settings cache after updating custom fields
    siteSettingsService.clearCache()

    // If some roles were disabled, archive their existing Profiles
    try {
      const prevSet = new Set<string>(current.profileRolesEnabled || [])
      const nextSet = new Set<string>(next.profileRolesEnabled || [])
      const removed: string[] = Array.from(prevSet).filter((r) => !nextSet.has(r))
      if (removed.length > 0) {
        const users = await db.from('users').whereIn('role', removed).select('id')
        const userIds = users.map((u: any) => Number(u.id)).filter((n) => !Number.isNaN(n))
        if (userIds.length > 0) {
          await db
            .from('posts')
            .where('type', 'profile')
            .whereIn('author_id', userIds)
            .andWhereNot('status', 'archived')
            .update({ status: 'archived', updated_at: new Date() })
        }
      }
    } catch {
      /* ignore archival errors */
    }
    const defs = siteCustomFieldsService.listDefinitions()
    const vals = await siteCustomFieldsService.getValues()
    return response.ok({ data: { ...next, customFieldDefs: defs, customFields: vals } })
  }
}
