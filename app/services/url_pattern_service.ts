import db from '@adonisjs/lucid/services/db'
import postTypeConfigService from '#services/post_type_config_service'
import localeService from '#services/locale_service'

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
   * Note: {path} token is NOT URL-encoded since it contains legitimate slashes.
   */
  private replaceTokens(pattern: string, values: Record<string, string>): string {
    let out = pattern
    for (const [key, rawVal] of Object.entries(values)) {
      // Special case: {path} token contains slashes that should NOT be encoded
      // All other tokens (slug, locale, yyyy, mm, dd) should be encoded
      const val = key === 'path' ? rawVal : encodeURIComponent(rawVal)
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
    const rows = await db.from('url_patterns').select('*')
    const patterns = rows.map((rec) => ({
      id: rec.id,
      postType: rec.post_type,
      locale: rec.locale,
      pattern: rec.pattern,
      isDefault: rec.is_default,
      createdAt: rec.created_at,
      updatedAt: rec.updated_at,
    }))

    // Sort by specificity: more specific patterns first
    // Specificity is determined by:
    // 1. Number of static path segments (higher is more specific)
    // 2. Number of tokens (fewer is more specific)
    // 3. Pattern length (longer is more specific)
    return patterns.sort((a, b) => {
      const aSegments = a.pattern.split('/').filter(s => s && !s.includes('{'))
      const bSegments = b.pattern.split('/').filter(s => s && !s.includes('{'))
      const aTokens = (a.pattern.match(/\{[^}]+\}/g) || []).length
      const bTokens = (b.pattern.match(/\{[^}]+\}/g) || []).length

      // More static segments = more specific
      if (aSegments.length !== bSegments.length) {
        return bSegments.length - aSegments.length
      }

      // Fewer tokens = more specific
      if (aTokens !== bTokens) {
        return aTokens - bTokens
      }

      // Longer pattern = more specific
      return b.pattern.length - a.pattern.length
    })
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
      .replace(/\{path\}/g, '(?<path>.+?)')
    return new RegExp('^' + source + '$', 'i')
  }

  /**
   * Try to match an incoming path to a stored pattern.
   * Returns { postType, locale, slug, fullPath, usesPath } or null.
   * When pattern uses {path}, fullPath contains the hierarchical path for canonical_url matching.
   */
  async matchPath(
    path: string
  ): Promise<{ postType: string; locale: string; slug: string; fullPath?: string; usesPath: boolean } | null> {
    const patterns = await this.getAllPatterns()
    for (const p of patterns) {
      const re = this.compilePattern(p.pattern)
      const m = re.exec(path)
      if (m && m.groups) {
        const locale = (m.groups['locale'] as string) || p.locale
        let slug = m.groups['slug'] as string | undefined
        const pathGroup = m.groups['path'] as string | undefined
        const usesPath = Boolean(pathGroup)

        if (!slug && pathGroup) {
          const parts = pathGroup.split('/').filter(Boolean)
          slug = parts[parts.length - 1]
        }

        if (slug) {
          return {
            postType: p.postType,
            locale,
            slug: decodeURIComponent(slug),
            fullPath: pathGroup || undefined,
            usesPath
          }
        }
      }
    }
    return null
  }

  /**
   * Ensure default patterns exist for a postType across all supported locales.
   */
  async ensureDefaultsForPostType(
    postType: string,
    locales: string[],
    _defaultPattern = '/{locale}/posts/{slug}'
  ): Promise<void> {
    const existing = await db.from('url_patterns').where({ post_type: postType }).select('locale')
    const existingLocales = new Set(existing.map((r) => r.locale))
    const missing = locales.filter((l) => !existingLocales.has(l))
    if (missing.length === 0) return
    const now = new Date()
    
    // Get URL patterns from post type definition
    const postTypeConfig = postTypeConfigService.getUiConfig(postType)
    const definedPatterns = postTypeConfig.urlPatterns || []
    const hierarchical = postTypeConfig.hierarchyEnabled
    const seg = hierarchical ? '{path}' : '{slug}'
    const defaultLocale = localeService.getDefaultLocale()
    
    const rows = missing.map((locale) => {
      // Try to find pattern for this locale in post type definition
      const definedPattern = definedPatterns.find((p) => p.locale === locale)
      
      // If found in definition, use it; otherwise fall back to generic pattern
      const pat = definedPattern 
        ? definedPattern.pattern 
        : (locale === defaultLocale ? `/${postType}/${seg}` : `/{locale}/${postType}/${seg}`)
      
      return {
        post_type: postType,
        locale,
        pattern: pat,
        is_default: true,
        created_at: now,
        updated_at: now,
      }
    })
    await db.table('url_patterns').insert(rows)
  }

  /**
   * Compute hierarchical parent path for a post: "parent1/parent2".
   * Only includes parents with same type and locale.
   */
  async getParentPathForPost(postId: string): Promise<string> {
    // Load the post to get type/locale/parent_id
    const root = await db
      .from('posts')
      .where('id', postId)
      .select('id', 'parent_id as parentId', 'type', 'locale', 'slug')
      .first()
    if (!root) return ''
    const type = String((root as any).type)
    const locale = String((root as any).locale)
    let nextParent: string | null = (root as any).parentId ?? null
    const chain: string[] = []
    const guard = new Set<string>([String((root as any).id)])
    while (nextParent) {
      const row = await db
        .from('posts')
        .where('id', nextParent)
        .select('id', 'parent_id as parentId', 'slug', 'type', 'locale')
        .first()
      if (!row) break
      if (String((row as any).type) !== type || String((row as any).locale) !== locale) break
      const slug = String((row as any).slug || '')
      if (slug) chain.push(slug)
      const candidate = (row as any).parentId ?? null
      if (candidate && guard.has(String((row as any).id))) break
      if (candidate) guard.add(String(candidate))
      nextParent = candidate
    }
    return chain.reverse().join('/')
  }

  /**
   * Build hierarchical path using {path} token when present, otherwise {slug}.
   */
  async buildPostPathForPost(postId: string): Promise<string> {
    const row = await db.from('posts').where('id', postId).first()
    if (!row) return '/'
    const pattern =
      (await this.getDefaultPattern(String(row.type), String(row.locale)))?.pattern ||
      '/{locale}/posts/{slug}'
    const d = (row as any).created_at ? new Date((row as any).created_at) : new Date()
    const yyyy = String(d.getUTCFullYear())
    const mm = String(d.getUTCMonth() + 1).padStart(2, '0')
    const dd = String(d.getUTCDate()).padStart(2, '0')
    const parentPath = await this.getParentPathForPost(String(row.id))
    const path = parentPath ? `${parentPath}/${String(row.slug)}` : String(row.slug)
    return this.replaceTokens(pattern, {
      slug: String(row.slug),
      path,
      locale: String(row.locale),
      yyyy,
      mm,
      dd,
    })
  }

  async buildPostUrlForPost(postId: string, protocol: string, host: string): Promise<string> {
    const path = await this.buildPostPathForPost(postId)
    return `${protocol}://${host}${path}`
  }

  /**
   * Ensure defaults for all post types found in posts table across provided locales.
   */
  async ensureDefaultsForAll(
    locales: string[],
    defaultPattern = '/{locale}/posts/{slug}'
  ): Promise<void> {
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
  async ensureLocaleForAllPostTypes(
    locale: string,
    _defaultPattern = '/{locale}/posts/{slug}'
  ): Promise<void> {
    const [fromTemplates, fromPosts] = await Promise.all([
      this.getPostTypesFromTemplates(),
      this.getPostTypesFromPosts(),
    ])
    const types = Array.from(new Set<string>([...fromTemplates, ...fromPosts]))
    if (types.length === 0) return
    const now = new Date()
    const existing = await db
      .from('url_patterns')
      .whereIn('post_type', types)
      .andWhere('locale', locale)
    const existingByType = new Set(existing.map((r) => r.post_type as string))
    const defaultLocale = localeService.getDefaultLocale()
    const rows = types
      .filter((t) => !existingByType.has(t))
      .map((t) => {
        const hierarchical = postTypeConfigService.getUiConfig(t).hierarchyEnabled
        const seg = hierarchical ? '{path}' : '{slug}'
        const pat = locale === defaultLocale ? `/${t}/${seg}` : `/{locale}/${t}/${seg}`
        return {
          post_type: t,
          locale,
          pattern: pat,
          is_default: true,
          created_at: now,
          updated_at: now,
        }
      })
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

  async updatePattern(
    id: string,
    data: { pattern: string; isDefault?: boolean }
  ): Promise<UrlPatternData> {
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

  async createPattern(
    postType: string,
    locale: string,
    pattern: string,
    isDefault: boolean = true
  ): Promise<UrlPatternData> {
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
