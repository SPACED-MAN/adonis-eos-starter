import { DateTime } from 'luxon'
import { BaseModel, column } from '@adonisjs/lucid/orm'

export default class AnalyticsEvent extends BaseModel {
  @column({ isPrimary: true })
  declare id: string

  @column()
  declare postId: string | null

  @column()
  declare eventType: string

  @column()
  declare x: number | null

  @column()
  declare y: number | null

  @column()
  declare viewportWidth: number | null

  @column()
  declare metadata: any

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime
}
