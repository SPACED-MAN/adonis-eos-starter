import { BaseModel, column, belongsTo } from '@adonisjs/lucid/orm'
import { DateTime } from 'luxon'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import ModuleInstance from './module_instance.js'

/**
 * PostModule
 *
 * Joins posts to module instances and carries ordering/override data.
 */
export default class PostModule extends BaseModel {
  public static table = 'post_modules'

  @column({ isPrimary: true })
  declare id: string

  @column({ columnName: 'post_id' })
  declare postId: string

  @column({ columnName: 'module_id' })
  declare moduleId: string

  @column()
  declare overrides: Record<string, unknown> | null

  @column({ columnName: 'review_overrides' })
  declare reviewOverrides: Record<string, unknown> | null

  @column({ columnName: 'ai_review_overrides' })
  declare aiReviewOverrides: Record<string, unknown> | null

  @column()
  declare locked: boolean

  @column({ columnName: 'order_index' })
  declare orderIndex: number

  @column({ columnName: 'review_added' })
  declare reviewAdded: boolean

  @column({ columnName: 'review_deleted' })
  declare reviewDeleted: boolean

  @column({ columnName: 'ai_review_added' })
  declare aiReviewAdded: boolean

  @column({ columnName: 'ai_review_deleted' })
  declare aiReviewDeleted: boolean

  @column.dateTime({ autoCreate: true, columnName: 'created_at' })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true, columnName: 'updated_at' })
  declare updatedAt: DateTime

  @belongsTo(() => ModuleInstance, { foreignKey: 'moduleId' })
  declare moduleInstance: BelongsTo<typeof ModuleInstance>
}
