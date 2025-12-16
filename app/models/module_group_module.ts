import { BaseModel, column, belongsTo } from '@adonisjs/lucid/orm'
import { DateTime } from 'luxon'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import ModuleGroup from './module_group.js'

/**
 * ModuleGroupModule
 */
export default class ModuleGroupModule extends BaseModel {
  public static table = 'module_group_modules'

  @column({ isPrimary: true })
  declare id: string

  @column({ columnName: 'module_group_id' })
  declare moduleGroupId: string

  @column()
  declare type: string

  @column({ columnName: 'default_props' })
  declare defaultProps: Record<string, unknown> | null

  @column()
  declare scope: string | null

  @column({ columnName: 'global_slug' })
  declare globalSlug: string | null

  @column({ columnName: 'order_index' })
  declare orderIndex: number

  @column()
  declare locked: boolean

  @column.dateTime({ autoCreate: true, columnName: 'created_at' })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true, columnName: 'updated_at' })
  declare updatedAt: DateTime

  @belongsTo(() => ModuleGroup, { foreignKey: 'moduleGroupId' })
  declare moduleGroup: BelongsTo<typeof ModuleGroup>
}
