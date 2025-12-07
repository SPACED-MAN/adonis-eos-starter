import { BaseModel, column } from '@adonisjs/lucid/orm'
import { DateTime } from 'luxon'

/**
 * UrlPattern
 *
 * Stores permalink patterns per post type and locale.
 */
export default class UrlPattern extends BaseModel {
  public static table = 'url_patterns'

  @column({ isPrimary: true })
  declare id: string

  @column({ columnName: 'post_type' })
  declare postType: string

  @column()
  declare locale: string

  @column()
  declare pattern: string

  @column({ columnName: 'is_default' })
  declare isDefault: boolean

  @column.dateTime({ autoCreate: true, columnName: 'created_at' })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true, columnName: 'updated_at' })
  declare updatedAt: DateTime
}

