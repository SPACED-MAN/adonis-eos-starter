import { BaseModel, column } from '@adonisjs/lucid/orm'
import { DateTime } from 'luxon'

/**
 * SiteSetting
 *
 * Single-row settings table. Kept minimal; logic lives in service.
 */
export default class SiteSetting extends BaseModel {
  public static table = 'site_settings'

  @column({ isPrimary: true })
  declare id: number

  @column({ columnName: 'site_title' })
  declare siteTitle: string

  @column({ columnName: 'default_meta_description' })
  declare defaultMetaDescription: string | null

  @column({ columnName: 'favicon_media_id' })
  declare faviconMediaId: string | null

  @column({ columnName: 'default_og_media_id' })
  declare defaultOgMediaId: string | null

  @column({ columnName: 'logo_media_id' })
  declare logoMediaId: string | null

  @column({ columnName: 'is_maintenance_mode' })
  declare isMaintenanceMode: boolean

  @column({
    columnName: 'profile_roles_enabled',
    prepare: (value) => (value ? JSON.stringify(value) : value),
    consume: (value) => {
      if (!value) return []
      if (typeof value === 'object') return value
      try {
        return JSON.parse(value)
      } catch {
        return value
      }
    },
  })
  declare profileRolesEnabled: string[]

  @column({
    columnName: 'social_settings',
    prepare: (value) => (value ? JSON.stringify(value) : value),
    consume: (value) => {
      if (!value) return null
      if (typeof value === 'object') return value
      try {
        return JSON.parse(value)
      } catch {
        return value
      }
    },
  })
  declare socialSettings: any | null

  @column.dateTime({ autoCreate: true, columnName: 'created_at' })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true, columnName: 'updated_at' })
  declare updatedAt: DateTime
}
