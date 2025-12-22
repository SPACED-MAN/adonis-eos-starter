import SiteSetting from '#models/site_setting'

type SiteSettings = {
  siteTitle: string
  defaultMetaDescription: string | null
  faviconMediaId: string | null
  defaultOgMediaId: string | null
  logoMediaId: string | null
  isMaintenanceMode: boolean
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
    const row = await SiteSetting.query().first()
    const settings: SiteSettings = {
      siteTitle: row?.siteTitle || 'EOS',
      defaultMetaDescription: row?.defaultMetaDescription || null,
      faviconMediaId: row?.faviconMediaId || null,
      defaultOgMediaId: row?.defaultOgMediaId || null,
      logoMediaId: row?.logoMediaId || null,
      isMaintenanceMode: !!row?.isMaintenanceMode,
      profileRolesEnabled: Array.isArray(row?.profileRolesEnabled) ? row.profileRolesEnabled : [],
    }
    this.cache = settings
    this.lastLoadedAt = now
    return settings
  }

  async upsert(payload: Partial<SiteSettings>): Promise<SiteSettings> {
    const currentRow = await SiteSetting.query().first()
    const current: SiteSettings = currentRow
      ? {
          siteTitle: currentRow.siteTitle,
          defaultMetaDescription: currentRow.defaultMetaDescription,
          faviconMediaId: currentRow.faviconMediaId,
          defaultOgMediaId: currentRow.defaultOgMediaId,
          logoMediaId: currentRow.logoMediaId,
          isMaintenanceMode: !!currentRow.isMaintenanceMode,
          profileRolesEnabled: currentRow.profileRolesEnabled || [],
        }
      : await this.get()

    const next: SiteSettings = {
      siteTitle: payload.siteTitle ?? current.siteTitle,
      defaultMetaDescription:
        'defaultMetaDescription' in payload
          ? payload.defaultMetaDescription!
          : current.defaultMetaDescription,
      faviconMediaId:
        'faviconMediaId' in payload ? payload.faviconMediaId! : current.faviconMediaId,
      defaultOgMediaId:
        'defaultOgMediaId' in payload ? payload.defaultOgMediaId! : current.defaultOgMediaId,
      logoMediaId: 'logoMediaId' in payload ? payload.logoMediaId! : current.logoMediaId,
      isMaintenanceMode:
        'isMaintenanceMode' in payload ? !!payload.isMaintenanceMode : current.isMaintenanceMode,
      profileRolesEnabled: payload.profileRolesEnabled ?? current.profileRolesEnabled ?? [],
    }
    if (currentRow) {
      currentRow.merge({
        siteTitle: next.siteTitle,
        defaultMetaDescription: next.defaultMetaDescription,
        faviconMediaId: next.faviconMediaId,
        defaultOgMediaId: next.defaultOgMediaId,
        logoMediaId: next.logoMediaId,
        isMaintenanceMode: next.isMaintenanceMode,
        profileRolesEnabled: next.profileRolesEnabled,
      })
      await currentRow.save()
    } else {
      await SiteSetting.create({
        siteTitle: next.siteTitle,
        defaultMetaDescription: next.defaultMetaDescription,
        faviconMediaId: next.faviconMediaId,
        defaultOgMediaId: next.defaultOgMediaId,
        logoMediaId: next.logoMediaId,
        isMaintenanceMode: next.isMaintenanceMode,
        profileRolesEnabled: next.profileRolesEnabled,
      })
    }
    this.cache = next
    this.lastLoadedAt = Date.now()
    return next
  }
}

const siteSettingsService = new SiteSettingsService()
export default siteSettingsService
