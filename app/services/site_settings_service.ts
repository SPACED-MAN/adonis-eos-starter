import db from '@adonisjs/lucid/services/db'

type SiteSettings = {
  siteTitle: string
  defaultMetaDescription: string | null
  faviconMediaId: string | null
  defaultOgMediaId: string | null
  logoLightMediaId: string | null
  logoDarkMediaId: string | null
  profileRolesEnabled: string[]
}

class SiteSettingsService {
  private cache: SiteSettings | null = null
  private lastLoadedAt = 0
  private ttlMs = 10000

  async get(): Promise<SiteSettings> {
    const now = Date.now()
    if (this.cache && now - this.lastLoadedAt < this.ttlMs) {
      return this.cache
    }
    const row = await db.from('site_settings').first()
    const settings: SiteSettings = {
      siteTitle: row?.site_title || 'My Site',
      defaultMetaDescription: row?.default_meta_description || null,
      faviconMediaId: row?.favicon_media_id || null,
      defaultOgMediaId: row?.default_og_media_id || null,
      logoLightMediaId: row?.logo_light_media_id || null,
      logoDarkMediaId: row?.logo_dark_media_id || null,
      profileRolesEnabled: Array.isArray(row?.profile_roles_enabled)
        ? row.profile_roles_enabled
        : [],
    }
    this.cache = settings
    this.lastLoadedAt = now
    return settings
  }

  async upsert(payload: Partial<SiteSettings>): Promise<SiteSettings> {
    const current = await this.get()
    const next: SiteSettings = {
      siteTitle: payload.siteTitle ?? current.siteTitle,
      defaultMetaDescription: payload.defaultMetaDescription ?? current.defaultMetaDescription,
      faviconMediaId: payload.faviconMediaId ?? current.faviconMediaId,
      defaultOgMediaId: payload.defaultOgMediaId ?? current.defaultOgMediaId,
      logoLightMediaId: payload.logoLightMediaId ?? current.logoLightMediaId,
      logoDarkMediaId: payload.logoDarkMediaId ?? current.logoDarkMediaId,
      profileRolesEnabled: payload.profileRolesEnabled ?? current.profileRolesEnabled ?? [],
    }
    const exists = await db.from('site_settings').count('* as c')
    const count = Number((exists?.[0] as any)?.c || 0)
    if (count === 0) {
      await db.table('site_settings').insert({
        site_title: next.siteTitle,
        default_meta_description: next.defaultMetaDescription,
        favicon_media_id: next.faviconMediaId,
        default_og_media_id: next.defaultOgMediaId,
        logo_light_media_id: next.logoLightMediaId,
        logo_dark_media_id: next.logoDarkMediaId,
        profile_roles_enabled: next.profileRolesEnabled,
        created_at: new Date(),
        updated_at: new Date(),
      })
    } else {
      await db.from('site_settings').update({
        site_title: next.siteTitle,
        default_meta_description: next.defaultMetaDescription,
        favicon_media_id: next.faviconMediaId,
        default_og_media_id: next.defaultOgMediaId,
        logo_light_media_id: next.logoLightMediaId,
        logo_dark_media_id: next.logoDarkMediaId,
        profile_roles_enabled: next.profileRolesEnabled,
        updated_at: new Date(),
      })
    }
    this.cache = next
    this.lastLoadedAt = Date.now()
    return next
  }
}

const siteSettingsService = new SiteSettingsService()
export default siteSettingsService
