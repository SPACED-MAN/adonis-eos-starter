import { BaseModel, column } from '@adonisjs/lucid/orm'
import { DateTime } from 'luxon'

/**
 * CustomField
 */
export default class CustomField extends BaseModel {
  public static table = 'custom_fields'

  @column({ isPrimary: true })
  declare id: string

  @column()
  declare slug: string

  @column()
  declare label: string

  @column({ columnName: 'field_type' })
  declare fieldType: string

  @column()
  declare config: Record<string, unknown> | null

  @column()
  declare translatable: boolean

  @column.dateTime({ autoCreate: true, columnName: 'created_at' })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true, columnName: 'updated_at' })
  declare updatedAt: DateTime
}

