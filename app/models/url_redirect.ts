import { BaseModel, column } from '@adonisjs/lucid/orm'
import { DateTime } from 'luxon'

/**
 * UrlRedirect
 */
export default class UrlRedirect extends BaseModel {
  public static table = 'url_redirects'

  @column({ isPrimary: true })
  declare id: string

  @column({ columnName: 'from_path' })
  declare fromPath: string

  @column({ columnName: 'to_path' })
  declare toPath: string

  @column()
  declare locale: string | null

  @column({ columnName: 'post_id' })
  declare postId: string | null

  @column({ columnName: 'http_status' })
  declare httpStatus: number

  @column.dateTime({ columnName: 'active_from' })
  declare activeFrom: DateTime | null

  @column.dateTime({ columnName: 'active_to' })
  declare activeTo: DateTime | null

  @column.dateTime({ autoCreate: true, columnName: 'created_at' })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true, columnName: 'updated_at' })
  declare updatedAt: DateTime
}
