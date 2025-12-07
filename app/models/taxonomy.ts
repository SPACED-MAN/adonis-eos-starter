import { BaseModel, column, hasMany } from '@adonisjs/lucid/orm'
import { DateTime } from 'luxon'
import type { HasMany } from '@adonisjs/lucid/types/relations'
import TaxonomyTerm from './taxonomy_term.js'

/**
 * Taxonomy model
 *
 * Minimal mapping to make taxonomy access more discoverable.
 * Domain rules (hierarchical/freeTagging) stay in taxonomy_registry.
 */
export default class Taxonomy extends BaseModel {
  public static table = 'taxonomies'

  @column({ isPrimary: true })
  declare id: string

  @column()
  declare slug: string

  @column()
  declare name: string

  @column.dateTime({ autoCreate: true, columnName: 'created_at' })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true, columnName: 'updated_at' })
  declare updatedAt: DateTime

  @hasMany(() => TaxonomyTerm, { foreignKey: 'taxonomyId' })
  declare terms: HasMany<typeof TaxonomyTerm>
}

