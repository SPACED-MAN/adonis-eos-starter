import db from '@adonisjs/lucid/services/db'

type UrlPatternData = {
  id: string
  postType: string
  locale: string
  pattern: string
  isDefault: boolean
  createdAt: Date
  updatedAt: Date
}

class UrlPatternService {
  /**
   * Replace tokens in a pattern string with provided values.
   * Supports both {token} and :token syntaxes.
   */
  private replaceTokens(pattern: string, values: Record<string, string>): string {
    let out = pattern
    for (const [key, rawVal] of Object.entries(values)) {
      const val = encodeURIComponent(rawVal)
      // Brace syntax
      out = out.replace(new RegExp(`\\{${key}\\}`, 'g'), val)
      // Colon syntax
      out = out.replace(new RegExp(`:${key}\\b`, 'g'), val)
    }
    if (!out.startsWith('/')) out = '/' + out
    return out
  }

  /**
   * Get default pattern for postType+locale.
   */
  async getDefaultPattern(postType: string, locale: string): Promise<UrlPatternData | null> {
    const rec = await db
      .from('url_patterns')
      .where({ post_type: postType, locale, is_default: true })
      .first()
    if (!rec) return null
    return {
      id: rec.id,
      postType: rec.post_type,
      locale: rec.locale,
      pattern: rec.pattern,
      isDefault: rec.is_default,
      createdAt: rec.created_at,
      updatedAt: rec.updated_at,
    }
  }

  /**
   * Build path using default pattern for postType+locale.
   */
  async buildPostPath(postType: string, slug: string, locale: string): Promise<string> {
    const defaultPattern =
      (await this.getDefaultPattern(postType, locale))?.pattern ||
      '/{locale}/posts/{slug}'
    return this.replaceTokens(defaultPattern, { slug, locale })
  }

  async buildPostUrl(postType: string, slug: string, locale: string, protocol: string, host: string): Promise<string> {
    const path = await this.buildPostPath(postType, slug, locale)
    return `${protocol}://${host}${path}`
  }

  async getAllPatterns(): Promise<UrlPatternData[]> {
    const rows = await db.from('url_patterns').select('*').orderBy('updated_at', 'desc')
    return rows.map((rec) => ({
      id: rec.id,
      postType: rec.post_type,
      locale: rec.locale,
      pattern: rec.pattern,
      isDefault: rec.is_default,
      createdAt: rec.created_at,
      updatedAt: rec.updated_at,
    }))
  }

  /**
   * Ensure default patterns exist for a postType across all supported locales.
   */
  async ensureDefaultsForPostType(postType: string, locales: string[], defaultPattern = '/{locale}/posts/{slug}'): Promise<void> {
    const existing = await db.from('url_patterns').where({ post_type: postType }).select('locale')
    const existingLocales = new Set(existing.map((r) => r.locale))
    const missing = locales.filter((l) => !existingLocales.has(l))
    if (missing.length === 0) return
    const now = new Date()
    const rows = missing.map((locale) => ({
      post_type: postType,
      locale,
      pattern: defaultPattern,
      is_default: true,
      created_at: now,
      updated_at: now,
    }))
    await db.table('url_patterns').insert(rows)
  }

  /**
   * Ensure defaults for all post types found in posts table across provided locales.
   */
  async ensureDefaultsForAll(locales: string[], defaultPattern = '/{locale}/posts/{slug}'): Promise<void> {
    const rows = await db.from('posts').distinct('type as post_type')
    const types = rows.map((r) => r.post_type as string)
    for (const t of types) {
      await this.ensureDefaultsForPostType(t, locales, defaultPattern)
    }
  }

  async updatePattern(id: string, data: { pattern: string; isDefault?: boolean }): Promise<UrlPatternData> {
    const [rec] = await db
      .from('url_patterns')
      .where('id', id)
      .update({
        pattern: data.pattern,
        is_default: data.isDefault ?? true,
        updated_at: new Date(),
      })
      .returning('*')
    return {
      id: rec.id,
      postType: rec.post_type,
      locale: rec.locale,
      pattern: rec.pattern,
      isDefault: rec.is_default,
      createdAt: rec.created_at,
      updatedAt: rec.updated_at,
    }
  }

  async createPattern(postType: string, locale: string, pattern: string, isDefault: boolean = true): Promise<UrlPatternData> {
    const [rec] = await db
      .table('url_patterns')
      .insert({
        post_type: postType,
        locale,
        pattern,
        is_default: isDefault,
        created_at: new Date(),
        updated_at: new Date(),
      })
      .returning('*')
    return {
      id: rec.id,
      postType: rec.post_type,
      locale: rec.locale,
      pattern: rec.pattern,
      isDefault: rec.is_default,
      createdAt: rec.created_at,
      updatedAt: rec.updated_at,
    }
  }
}

const urlPatternService = new UrlPatternService()
export default urlPatternService


