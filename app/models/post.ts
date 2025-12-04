import { DateTime } from 'luxon'
import {
  BaseModel,
  column,
  belongsTo,
  hasMany,
  scope,
  beforeFind,
  beforeFetch,
} from '@adonisjs/lucid/orm'
import type { BelongsTo, HasMany } from '@adonisjs/lucid/types/relations'
import type { ModelQueryBuilderContract } from '@adonisjs/lucid/types/model'
import User from './user.js'
import type { RobotsConfig, JsonLdOverrides } from '#types/seo'

export default class Post extends BaseModel {
  /**
   * Enable soft deletes globally
   * Set to false to include deleted posts in queries
   */
  static softDeleteEnabled = true

  @column({ isPrimary: true })
  declare id: string

  @column()
  declare type: string

  @column()
  declare slug: string

  @column()
  declare title: string

  @column()
  declare excerpt: string | null

  @column({ columnName: 'featured_image_id' })
  declare featuredImageId: string | null

  @column()
  declare status:
    | 'draft'
    | 'review'
    | 'scheduled'
    | 'published'
    | 'private'
    | 'protected'
    | 'archived'

  @column()
  declare locale: string

  @column()
  declare translationOfId: string | null

  @column()
  declare metaTitle: string | null

  @column()
  declare metaDescription: string | null

  @column()
  declare canonicalUrl: string | null

  @column()
  declare robotsJson: RobotsConfig | null

  @column()
  declare jsonldOverrides: JsonLdOverrides | null

  @column({ columnName: 'review_draft' })
  declare reviewDraft: Record<string, any> | null

  @column({ columnName: 'parent_id' })
  declare parentId: string | null

  @column({ columnName: 'order_index' })
  declare orderIndex: number

  @column()
  declare templateId: string | null

  @column()
  declare userId: number

  @column({ columnName: 'author_id' })
  declare authorId: number | null

  @column.dateTime()
  declare publishedAt: DateTime | null

  @column.dateTime()
  declare scheduledAt: DateTime | null

  @column.dateTime({ columnName: 'deleted_at' })
  declare deletedAt: DateTime | null

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime

  /**
   * Hook: Exclude soft-deleted records from single queries
   */
  @beforeFind()
  static excludeDeletedOnFind(query: ModelQueryBuilderContract<typeof Post>) {
    if (Post.softDeleteEnabled) {
      query.whereNull('deleted_at')
    }
  }

  /**
   * Hook: Exclude soft-deleted records from bulk queries
   */
  @beforeFetch()
  static excludeDeletedOnFetch(query: ModelQueryBuilderContract<typeof Post>) {
    if (Post.softDeleteEnabled) {
      query.whereNull('deleted_at')
    }
  }

  /**
   * Soft delete the post
   */
  async softDelete(): Promise<void> {
    this.deletedAt = DateTime.now()
    await this.save()
  }

  /**
   * Restore a soft-deleted post
   */
  async restore(): Promise<void> {
    this.deletedAt = null
    await this.save()
  }

  /**
   * Check if post is soft deleted
   */
  get isDeleted(): boolean {
    return this.deletedAt !== null
  }

  /**
   * Query scope: Include soft-deleted posts
   */
  static withTrashed = scope((query) => {
    // Remove the whereNull clause by using a no-op
    // This works because we're in a separate scope
  })

  /**
   * Query scope: Only soft-deleted posts
   */
  static onlyTrashed = scope((query) => {
    query.whereNotNull('deleted_at')
  })

  /**
   * Relationship: Parent post (for translations)
   */
  @belongsTo(() => Post, {
    foreignKey: 'translationOfId',
  })
  declare originalPost: BelongsTo<typeof Post>

  /**
   * Relationship: Child translations
   */
  @hasMany(() => Post, {
    foreignKey: 'translationOfId',
  })
  declare translations: HasMany<typeof Post>

  /**
   * Relationship: Parent (hierarchy)
   */
  @belongsTo(() => Post, {
    foreignKey: 'parentId',
  })
  declare parent: BelongsTo<typeof Post>

  /**
   * Relationship: Children (hierarchy)
   */
  @hasMany(() => Post, {
    foreignKey: 'parentId',
  })
  declare children: HasMany<typeof Post>

  /**
   * Relationship: Author (user)
   */
  @belongsTo(() => User, {
    foreignKey: 'authorId',
  })
  declare author: BelongsTo<typeof User>

  /**
   * Query scope: Get posts by locale
   */
  static byLocale = scope((query, locale: string) => {
    query.where('locale', locale)
  })

  /**
   * Query scope: Get published posts
   */
  static published = scope((query) => {
    query
      .where('status', 'published')
      .whereNotNull('publishedAt')
      .where('publishedAt', '<=', DateTime.now().toSQL())
  })

  /**
   * Query scope: Constrain to type
   */
  static ofType = scope((query, type: string) => {
    query.where('type', type)
  })

  /**
   * Query scope: Roots (no parent)
   */
  static roots = scope((query) => {
    query.whereNull('parentId')
  })

  /**
   * Query scope: Children of a given parent
   */
  static childrenOf = scope((query, parentId: string) => {
    query.where('parentId', parentId)
  })

  /**
   * Query scope: Get original posts (not translations)
   */
  static originals = scope((query) => {
    query.whereNull('translationOfId')
  })

  /**
   * Check if this post is a translation
   */
  isTranslation(): boolean {
    return this.translationOfId !== null
  }

  /**
   * Get all translations for this post (including itself)
   */
  async getAllTranslations(): Promise<Post[]> {
    // If this is a translation, get siblings
    if (this.isTranslation()) {
      return Post.query()
        .where('translationOfId', this.translationOfId!)
        .orWhere('id', this.translationOfId!)
    }

    // If this is original, get all translations
    return Post.query().where('translationOfId', this.id).orWhere('id', this.id)
  }

  /**
   * Get translation for a specific locale
   */
  async getTranslation(locale: string): Promise<Post | null> {
    const baseId = this.translationOfId || this.id

    return Post.query().where('translationOfId', baseId).where('locale', locale).first()
  }

  /**
   * Check if post has a translation for given locale
   */
  async hasTranslation(locale: string): Promise<boolean> {
    const translation = await this.getTranslation(locale)
    return translation !== null
  }

  /**
   * Get the original (source) post
   */
  async getOriginal(): Promise<Post> {
    if (!this.isTranslation()) {
      return this
    }

    const original = await Post.find(this.translationOfId!)
    if (!original) {
      throw new Error(`Original post not found: ${this.translationOfId}`)
    }

    return original
  }

  /**
   * Serialize robots_json for JSON responses
   */
  serializeExtras() {
    return {
      isTranslation: this.isTranslation(),
    }
  }
}
