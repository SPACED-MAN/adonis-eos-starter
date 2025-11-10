import { DateTime } from 'luxon'
import { BaseModel, column, belongsTo, hasMany, scope } from '@adonisjs/lucid/orm'
import type { BelongsTo, HasMany } from '@adonisjs/lucid/types/relations'

export default class Post extends BaseModel {
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

  @column()
  declare status: 'draft' | 'review' | 'scheduled' | 'published' | 'archived'

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
  declare robotsJson: Record<string, any> | null

  @column()
  declare jsonldOverrides: Record<string, any> | null

  @column()
  declare templateId: string | null

  @column()
  declare userId: number

  @column.dateTime()
  declare publishedAt: DateTime | null

  @column.dateTime()
  declare scheduledAt: DateTime | null

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime

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
   * Query scope: Get posts by locale
   */
  static byLocale = scope((query, locale: string) => {
    query.where('locale', locale)
  })

  /**
   * Query scope: Get published posts
   */
  static published = scope((query) => {
    query.where('status', 'published')
      .whereNotNull('publishedAt')
      .where('publishedAt', '<=', DateTime.now().toSQL())
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
    return Post.query()
      .where('translationOfId', this.id)
      .orWhere('id', this.id)
  }

  /**
   * Get translation for a specific locale
   */
  async getTranslation(locale: string): Promise<Post | null> {
    const baseId = this.translationOfId || this.id

    return Post.query()
      .where('translationOfId', baseId)
      .where('locale', locale)
      .first()
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
