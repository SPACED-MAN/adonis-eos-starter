import { BaseModel, column, belongsTo } from '@adonisjs/lucid/orm'
import { DateTime } from 'luxon'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import Taxonomy from './taxonomy.js'

/**
 * TaxonomyTerm model
 */
export default class TaxonomyTerm extends BaseModel {
  public static table = 'taxonomy_terms'

  @column({ isPrimary: true })
  declare id: string

  @column({ columnName: 'taxonomy_id' })
  declare taxonomyId: string

  @column({ columnName: 'parent_id' })
  declare parentId: string | null

  @column()
  declare slug: string

  @column()
  declare name: string

  @column()
  declare description: string | null

  @column({ columnName: 'order_index' })
  declare orderIndex: number

  @column.dateTime({ autoCreate: true, columnName: 'created_at' })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true, columnName: 'updated_at' })
  declare updatedAt: DateTime

  @belongsTo(() => Taxonomy, { foreignKey: 'taxonomyId' })
  declare taxonomy: BelongsTo<typeof Taxonomy>
}

