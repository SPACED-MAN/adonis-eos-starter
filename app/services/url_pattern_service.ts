import postTypeConfigService from '#services/post_type_config_service'
import localeService from '#services/locale_service'
import UrlPattern from '#models/url_pattern'
import Post from '#models/post'
import ModuleGroup from '#models/module_group'

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
    const rec = await UrlPattern.query().where({ postType, locale, isDefault: true }).first()
    if (!rec) return null
    return {
      id: rec.id,
      postType: rec.postType,
      locale: rec.locale,
      pattern: rec.pattern,
      isDefault: rec.isDefault,
      createdAt: rec.createdAt.toJSDate(),
      updatedAt: rec.updatedAt.toJSDate(),
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
    const rows = await UrlPattern.query()
    const patterns = rows.map((rec) => ({
      id: rec.id,
      postType: rec.postType,
      locale: rec.locale,
      pattern: rec.pattern,
      isDefault: rec.isDefault,
      createdAt: rec.createdAt.toJSDate(),
      updatedAt: rec.updatedAt.toJSDate(),
    }))

    // Sort by specificity: more specific patterns first
    // Specificity is determined by:
    // 1. Number of static path segments (higher is more specific)
    // 2. Number of tokens (fewer is more specific)
    // 3. Pattern length (longer is more specific)
    return patterns.sort((a, b) => {
      const aSegments = a.pattern.split('/').filter((s) => s && !s.includes('{'))
      const bSegments = b.pattern.split('/').filter((s) => s && !s.includes('{'))
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
  async matchPath(path: string): Promise<{
    postType: string
    locale: string
    slug: string
    fullPath?: string
    usesPath: boolean
  } | null> {
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
            usesPath,
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
    const postTypeConfig = postTypeConfigService.getUiConfig(postType)
    const hasPermalinks =
      postTypeConfig.permalinksEnabled !== false && postTypeConfig.urlPatterns.length > 0
    if (!hasPermalinks) return

    const existing = await UrlPattern.query().where({ postType }).select('locale')
    const existingLocales = new Set(existing.map((r) => r.locale as string))
    const missing = locales.filter((l) => !existingLocales.has(l))
    if (missing.length === 0) return
    // Get URL patterns from post type definition
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
        : locale === defaultLocale
          ? `/${postType}/${seg}`
          : `/{locale}/${postType}/${seg}`
      
      return {
        postType,
        locale,
        pattern: pat,
        isDefault: true,
      }
    })
    await UrlPattern.createMany(rows)
  }

  /**
   * Compute hierarchical parent path for a post: "parent1/parent2".
   * Only includes parents with same type and locale.
   */
  async getParentPathForPost(postId: string): Promise<string> {
    // Load the post to get type/locale/parent_id
    const root = await Post.query()
      .where('id', postId)
      .select('id', 'parentId', 'type', 'locale', 'slug')
      .first()
    if (!root) return ''
    const type = String(root.type)
    const locale = String(root.locale)
    let nextParent: string | null = (root as any).parentId ?? null
    const chain: string[] = []
    const guard = new Set<string>([String(root.id)])
    while (nextParent) {
      const row = await Post.query()
        .where('id', nextParent)
        .select('id', 'parentId', 'slug', 'type', 'locale')
        .first()
      if (!row) break
      if (String(row.type) !== type || String(row.locale) !== locale) break
      const slug = String((row as any).slug || '')
      if (slug) chain.push(slug)
      const candidate = (row as any).parentId ?? null
      if (candidate && guard.has(String(row.id))) break
      if (candidate) guard.add(String(candidate))
      nextParent = candidate
    }
    return chain.reverse().join('/')
  }

  /**
   * Build hierarchical path for a post using its current slug from the database.
   * Uses {path} token when present, otherwise {slug}.
   */
  async buildPostPathForPost(postId: string): Promise<string> {
    const row = await Post.query()
      .where('id', postId)
      .select('id', 'parentId', 'type', 'locale', 'slug', 'createdAt')
      .first()
    if (!row) return '/'
    return this.buildPostPathForRow(row)
  }

  /**
   * Internal helper: build path for a given post row, with optional slug override.
   *
   * This lets callers generate a new URL for a post BEFORE the slug is persisted
   * to the database, by passing a slugOverride.
   */
  private async buildPostPathForRow(row: any, slugOverride?: string): Promise<string> {
    const patternRec = await this.getDefaultPattern(String(row.type), String(row.locale))
    const pattern = patternRec?.pattern || '/{locale}/posts/{slug}'
    const d = (row as any).createdAt ? new Date((row as any).createdAt) : new Date()
    const yyyy = String(d.getUTCFullYear())
    const mm = String(d.getUTCMonth() + 1).padStart(2, '0')
    const dd = String(d.getUTCDate()).padStart(2, '0')
    const parentPath = await this.getParentPathForPost(String(row.id))
    const slug = slugOverride ?? String(row.slug)
    const path = parentPath ? `${parentPath}/${slug}` : slug
    return this.replaceTokens(pattern, {
      slug,
      path,
      locale: String(row.locale),
      yyyy,
      mm,
      dd,
    })
  }

  /**
   * Build hierarchical path for a post, but with an explicit slug override.
   *
   * This is used when generating redirects BEFORE a slug change is persisted.
   */
  async buildPostPathForPostWithSlug(postId: string, slug: string): Promise<string> {
    const row = await Post.query()
      .where('id', postId)
      .select('id', 'parentId', 'type', 'locale', 'slug', 'createdAt')
      .first()
    if (!row) return '/'
    return this.buildPostPathForRow(row, slug)
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
    const rows = await Post.query().distinct('type')
    const types = rows.map((r: any) => r.type as string)
    for (const t of types) {
      await this.ensureDefaultsForPostType(t, locales, defaultPattern)
    }
  }

  /**
   * Get distinct post types from module_groups table.
   */
  async getPostTypesFromModuleGroups(): Promise<string[]> {
    const rows = await ModuleGroup.query().distinct('postType')
    return rows.map((r: any) => r.postType as string)
  }

  /**
   * Get distinct post types from posts table.
   */
  async getPostTypesFromPosts(): Promise<string[]> {
    const rows = await Post.query().distinct('type')
    return rows.map((r: any) => r.type as string)
  }

  /**
   * Ensure a specific locale has default patterns across all known post types.
   * Known post types are derived from module_groups + posts union.
   */
  async ensureLocaleForAllPostTypes(
    locale: string,
    _defaultPattern = '/{locale}/posts/{slug}'
  ): Promise<void> {
    const [fromModuleGroups, fromPosts] = await Promise.all([
      this.getPostTypesFromModuleGroups(),
      this.getPostTypesFromPosts(),
    ])
    const types = Array.from(new Set<string>([...fromModuleGroups, ...fromPosts]))
    if (types.length === 0) return
    const existing = await UrlPattern.query().whereIn('postType', types).andWhere('locale', locale)
    const existingByType = new Set(existing.map((r) => r.postType as string))
    const defaultLocale = localeService.getDefaultLocale()
    const rows = types
      .filter((t) => !existingByType.has(t))
      .map((t) => {
        const hierarchical = postTypeConfigService.getUiConfig(t).hierarchyEnabled
        const seg = hierarchical ? '{path}' : '{slug}'
        const pat = locale === defaultLocale ? `/${t}/${seg}` : `/{locale}/${t}/${seg}`
        return {
          postType: t,
          locale,
          pattern: pat,
          isDefault: true,
        }
      })
    if (rows.length) {
      await UrlPattern.createMany(rows)
    }
  }

  /**
   * Prune default url patterns for post types that are no longer recognized.
   * Allowed post types = module_groups.post_type ∪ posts.type
   */
  async pruneDefaultsForUnknownPostTypes(): Promise<number> {
    const [fromModuleGroups, fromPosts] = await Promise.all([
      this.getPostTypesFromModuleGroups(),
      this.getPostTypesFromPosts(),
    ])
    const allowed = new Set<string>([...fromModuleGroups, ...fromPosts])
    const allPatterns = await UrlPattern.query().distinct('postType')
    const toRemove = allPatterns
      .map((r: any) => r.postType as string)
      .filter((t: string) => !allowed.has(t))
    if (toRemove.length === 0) return 0
    const deletedCount = await UrlPattern.query().whereIn('postType', toRemove).delete()
    return Number(deletedCount || 0)
  }

  async updatePattern(
    id: string,
    data: { pattern: string; isDefault?: boolean }
  ): Promise<UrlPatternData> {
    const rec = await UrlPattern.findOrFail(id)
    rec.merge({
        pattern: data.pattern,
      isDefault: data.isDefault ?? true,
      })
    await rec.save()
    return {
      id: rec.id,
      postType: rec.postType,
      locale: rec.locale,
      pattern: rec.pattern,
      isDefault: rec.isDefault,
      createdAt: rec.createdAt.toJSDate(),
      updatedAt: rec.updatedAt.toJSDate(),
    }
  }

  async createPattern(
    postType: string,
    locale: string,
    pattern: string,
    isDefault: boolean = true
  ): Promise<UrlPatternData> {
    const rec = await UrlPattern.create({
      postType,
        locale,
        pattern,
      isDefault,
      })
    return {
      id: rec.id,
      postType: rec.postType,
      locale: rec.locale,
      pattern: rec.pattern,
      isDefault: rec.isDefault,
      createdAt: rec.createdAt.toJSDate(),
      updatedAt: rec.updatedAt.toJSDate(),
    }
  }
}

const urlPatternService = new UrlPatternService()
export default urlPatternService
