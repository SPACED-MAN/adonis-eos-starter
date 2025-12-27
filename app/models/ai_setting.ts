import { BaseModel, column } from '@adonisjs/lucid/orm'
import { DateTime } from 'luxon'

export default class AISetting extends BaseModel {
  public static table = 'ai_settings'

  @column({ isPrimary: true })
  declare id: number

  @column({ columnName: 'default_text_provider' })
  declare defaultTextProvider: string | null

  @column({ columnName: 'default_text_model' })
  declare defaultTextModel: string | null

  @column({ columnName: 'default_media_provider' })
  declare defaultMediaProvider: string | null

  @column({ columnName: 'default_media_model' })
  declare defaultMediaModel: string | null

  @column({
    columnName: 'options',
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
  declare options: any | null

  @column.dateTime({ autoCreate: true, columnName: 'created_at' })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true, columnName: 'updated_at' })
  declare updatedAt: DateTime
}
