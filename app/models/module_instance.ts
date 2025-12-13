import { BaseModel, column, hasMany } from '@adonisjs/lucid/orm'
import { DateTime } from 'luxon'
import type { HasMany } from '@adonisjs/lucid/types/relations'
import PostModule from './post_module.js'

/**
 * ModuleInstance
 *
 * Thin Lucid model over `module_instances`.
 * Business logic remains in services; this is mainly for discoverability
 * and to reduce raw SQL usage.
 */
export default class ModuleInstance extends BaseModel {
  public static table = 'module_instances'

  @column({ isPrimary: true })
  declare id: string

  @column()
  declare scope: 'post' | 'global' | 'static'

  @column()
  declare type: string

  @column({ columnName: 'post_id' })
  declare postId: string | null

  @column({ columnName: 'global_slug' })
  declare globalSlug: string | null

  @column({ columnName: 'global_label' })
  declare globalLabel: string | null

  @column()
  declare props: Record<string, unknown> | null

  @column({ columnName: 'review_props' })
  declare reviewProps: Record<string, unknown> | null

  @column({ columnName: 'ai_review_props' })
  declare aiReviewProps: Record<string, unknown> | null

  @column({ columnName: 'render_cache_html' })
  declare renderCacheHtml: string | null

  @column({ columnName: 'render_etag' })
  declare renderEtag: string | null

  @column.dateTime({ autoCreate: true, columnName: 'created_at' })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true, columnName: 'updated_at' })
  declare updatedAt: DateTime

  @hasMany(() => PostModule, { foreignKey: 'moduleId' })
  declare postModules: HasMany<typeof PostModule>
}

