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
   * Supports {token} syntax only.
   */
  private replaceTokens(pattern: string, values: Record<string, string>): string {
    let out = pattern
    for (const [key, rawVal] of Object.entries(values)) {
      const val = encodeURIComponent(rawVal)
      out = out.replace(new RegExp(`\\{${key}\\}`, 'g'), val)
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
  async buildPostPath(postType: string, slug: string, locale: string, createdAt?: Date): Promise<string> {
    const defaultPattern =
      (await this.getDefaultPattern(postType, locale))?.pattern ||
      '/{locale}/posts/{slug}'
    const d = createdAt ? new Date(createdAt) : new Date()
    const yyyy = String(d.getUTCFullYear())
    const mm = String(d.getUTCMonth() + 1).padStart(2, '0')
    const dd = String(d.getUTCDate()).padStart(2, '0')
    return this.replaceTokens(defaultPattern, { slug, locale, yyyy, mm, dd })
  }

  async buildPostUrl(
    postType: string,
    slug: string,
    locale: string,
    protocol: string,
    host: string,
    createdAt?: Date
  ): Promise<string> {
    const path = await this.buildPostPath(postType, slug, locale, createdAt)
    return `${protocol}://${host}${path}`
  }

  /**
   * Build path using an explicit pattern string.
   */
  buildPathWithPattern(pattern: string, slug: string, locale: string, createdAt?: Date): string {
    const d = createdAt ? new Date(createdAt) : new Date()
    const yyyy = String(d.getUTCFullYear())
    const mm = String(d.getUTCMonth() + 1).padStart(2, '0')
    const dd = String(d.getUTCDate()).padStart(2, '0')
    return this.replaceTokens(pattern, { slug, locale, yyyy, mm, dd })
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
   * Compile a stored pattern into a RegExp with named groups.
   * Supports tokens: {locale},{yyyy},{mm},{dd},{slug}
   */
  private compilePattern(pattern: string): RegExp {
    let source = pattern
    if (!source.startsWith('/')) source = '/' + source
    source = source
      .replace(/\//g, '\\/')
      .replace(/\{locale\}/g, '(?<locale>[a-z]{2}(?:-[a-z]{2})?)')
      .replace(/\{yyyy\}/g, '(?<yyyy>\\d{4})')
      .replace(/\{mm\}/g, '(?<mm>\\d{2})')
      .replace(/\{dd\}/g, '(?<dd>\\d{2})')
      .replace(/\{slug\}/g, '(?<slug>[^\\/]+)')
    return new RegExp('^' + source + '$', 'i')
  }

  /**
   * Try to match an incoming path to a stored pattern.
   * Returns { postType, locale, slug } or null.
   */
  async matchPath(path: string): Promise<{ postType: string; locale: string; slug: string } | null> {
    const patterns = await this.getAllPatterns()
    for (const p of patterns) {
      const re = this.compilePattern(p.pattern)
      const m = re.exec(path)
      if (m && m.groups) {
        const locale = (m.groups['locale'] as string) || p.locale
        const slug = m.groups['slug'] as string
        if (slug) {
          return { postType: p.postType, locale, slug: decodeURIComponent(slug) }
        }
      }
    }
    return null
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

  /**
   * Get distinct post types from templates table.
   */
  async getPostTypesFromTemplates(): Promise<string[]> {
    const rows = await db.from('templates').distinct('post_type')
    return rows.map((r) => r.post_type as string)
  }

  /**
   * Get distinct post types from posts table.
   */
  async getPostTypesFromPosts(): Promise<string[]> {
    const rows = await db.from('posts').distinct('type as post_type')
    return rows.map((r) => r.post_type as string)
  }

  /**
   * Ensure a specific locale has default patterns across all known post types.
   * Known post types are derived from templates + posts union.
   */
  async ensureLocaleForAllPostTypes(locale: string, defaultPattern = '/{locale}/posts/{slug}'): Promise<void> {
    const [fromTemplates, fromPosts] = await Promise.all([
      this.getPostTypesFromTemplates(),
      this.getPostTypesFromPosts(),
    ])
    const types = Array.from(new Set<string>([...fromTemplates, ...fromPosts]))
    if (types.length === 0) return
    const now = new Date()
    const existing = await db.from('url_patterns').whereIn('post_type', types).andWhere('locale', locale)
    const existingByType = new Set(existing.map((r) => r.post_type as string))
    const rows = types
      .filter((t) => !existingByType.has(t))
      .map((t) => ({
        post_type: t,
        locale,
        pattern: defaultPattern,
        is_default: true,
        created_at: now,
        updated_at: now,
      }))
    if (rows.length) {
      await db.table('url_patterns').insert(rows)
    }
  }

  /**
   * Prune default url patterns for post types that are no longer recognized.
   * Allowed post types = templates.post_type ∪ posts.type
   */
  async pruneDefaultsForUnknownPostTypes(): Promise<number> {
    const [fromTemplates, fromPosts] = await Promise.all([
      this.getPostTypesFromTemplates(),
      this.getPostTypesFromPosts(),
    ])
    const allowed = new Set<string>([...fromTemplates, ...fromPosts])
    const allPatterns = await db.from('url_patterns').distinct('post_type')
    const toRemove = allPatterns.map((r) => r.post_type as string).filter((t) => !allowed.has(t))
    if (toRemove.length === 0) return 0
    const { rowCount } = await db.from('url_patterns').whereIn('post_type', toRemove).delete()
    return rowCount || 0
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


