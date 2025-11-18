import { BaseModel, column } from '@adonisjs/lucid/orm'
import { afterCreate } from '@adonisjs/lucid/orm'
import urlPatternService from '#services/url_pattern_service'

export default class Locale extends BaseModel {
  public static table = 'locales'
  @column({ isPrimary: true })
  declare code: string

  @column()
  declare isEnabled: boolean

  @column()
  declare isDefault: boolean

  @afterCreate()
  static async createDefaultUrlPatternsForNewLocale(locale: Locale) {
    try {
      await urlPatternService.ensureLocaleForAllPostTypes(locale.code)
    } catch {
      // best-effort; avoid blocking locale creation
    }
  }
}
