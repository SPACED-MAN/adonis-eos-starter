import { BaseModel, column } from '@adonisjs/lucid/orm'
import { DateTime } from 'luxon'

/**
 * SiteCustomFieldValue
 */
export default class SiteCustomFieldValue extends BaseModel {
  public static table = 'site_custom_field_values'

  @column({ isPrimary: true })
  declare id: string

  @column({ columnName: 'field_slug' })
  declare fieldSlug: string

  @column()
  declare value: any

  @column.dateTime({ autoCreate: true, columnName: 'created_at' })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true, columnName: 'updated_at' })
  declare updatedAt: DateTime
}

