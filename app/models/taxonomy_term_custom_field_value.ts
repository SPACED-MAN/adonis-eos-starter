import { BaseModel, column } from '@adonisjs/lucid/orm'
import { DateTime } from 'luxon'

/**
 * TaxonomyTermCustomFieldValue model
 */
export default class TaxonomyTermCustomFieldValue extends BaseModel {
  public static table = 'taxonomy_term_custom_field_values'

  @column({ isPrimary: true })
  declare id: string

  @column({ columnName: 'term_id' })
  declare termId: string

  @column({ columnName: 'field_slug' })
  declare fieldSlug: string

  @column({
    prepare: (value) => (value !== null && value !== undefined ? JSON.stringify(value) : null),
    consume: (value) => {
      if (value === null || value === undefined) return null
      if (typeof value === 'object') return value
      try {
        return JSON.parse(value)
      } catch {
        return value
      }
    },
  })
  declare value: any

  @column.dateTime({ autoCreate: true, columnName: 'created_at' })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true, columnName: 'updated_at' })
  declare updatedAt: DateTime
}

