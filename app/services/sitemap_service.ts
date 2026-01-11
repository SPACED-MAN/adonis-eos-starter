import db from '@adonisjs/lucid/services/db'
import { DateTime } from 'luxon'
import localeService from '#services/locale_service'
import postTypeConfigService from '#services/post_type_config_service'
import urlPatternService from '#services/url_pattern_service'

type PostRow = {
  id: string
  parentId: string | null
  orderIndex: number
  slug: string
  locale: string
  type: string
  translationOfId: string | null
  createdAt: Date
  updatedAt: Date | null
  publishedAt: Date | null
  canonicalUrl: string | null
  robotsJson: Record<string, any> | null
  noindex: boolean
}

type SitemapCacheEntry = { xml: string; expiresAt: number }

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

function replaceTokens(pattern: string, values: Record<string, string>): string {
  let out = pattern
  for (const [key, rawVal] of Object.entries(values)) {
    const val = key === 'path' ? rawVal : encodeURIComponent(rawVal)
    out = out.replace(new RegExp(`\\{${key}\\}`, 'g'), val)
  }
  if (!out.startsWith('/')) out = '/' + out
  if (out.length > 1 && out.endsWith('/')) out = out.slice(0, -1)
  return out
}

class SitemapService {
  private cache = new Map<string, SitemapCacheEntry>()
  private ttlMs = 5 * 60 * 1000 // 5 minutes
  private lastBuiltAt = new Map<string, number>()

  private getCache(key: string): string | null {
    const hit = this.cache.get(key)
    if (hit && hit.expiresAt > Date.now()) {
      return hit.xml
    }
    return null
  }

  private setCache(key: string, xml: string) {
    this.cache.set(key, { xml, expiresAt: Date.now() + this.ttlMs })
    this.lastBuiltAt.set(key, Date.now())
  }

  clearCache() {
    this.cache.clear()
    this.lastBuiltAt.clear()
  }

  getLastBuiltAt(key: string): number | null {
    return this.lastBuiltAt.get(key) ?? null
  }

  /**
   * Generate sitemap XML (single file). Respects:
   * - published posts only
   * - robots index=false exclusions
   * - custom hierarchical ordering (order_index + parent)
   */
  async generate(options: { protocol: string; host: string }): Promise<string> {
    const cacheKey = `${options.protocol}://${options.host}`
    const cached = this.getCache(cacheKey)
    if (cached) return cached

    const nowSql = DateTime.now().toSQL()
    const rowsRaw = await db
      .from('posts')
      .select(
        'id',
        'slug',
        'type',
        'locale',
        db.raw('translation_of_id as "translationOfId"'),
        db.raw('parent_id as "parentId"'),
        db.raw('order_index as "orderIndex"'),
        db.raw('created_at as "createdAt"'),
        db.raw('updated_at as "updatedAt"'),
        db.raw('published_at as "publishedAt"'),
        db.raw('canonical_url as "canonicalUrl"'),
        db.raw('robots_json as "robotsJson"'),
        'noindex'
      )
      .where('status', 'published')
      .andWhere((q) => {
        q.whereNull('published_at').orWhere('published_at', '<=', nowSql)
      })
      .whereNull('deleted_at')

    const rows: PostRow[] = rowsRaw.map((r: any) => ({
      id: String(r.id),
      parentId: r.parentId ? String(r.parentId) : null,
      orderIndex: typeof r.orderIndex === 'number' ? r.orderIndex : 0,
      slug: String(r.slug),
      locale: String(r.locale),
      type: String(r.type),
      translationOfId: r.translationOfId ? String(r.translationOfId) : null,
      createdAt: r.createdAt instanceof Date ? r.createdAt : new Date(r.createdAt),
      updatedAt: r.updatedAt
        ? r.updatedAt instanceof Date
          ? r.updatedAt
          : new Date(r.updatedAt)
        : null,
      publishedAt: r.publishedAt
        ? r.publishedAt instanceof Date
          ? r.publishedAt
          : new Date(r.publishedAt)
        : null,
      canonicalUrl: r.canonicalUrl ? String(r.canonicalUrl) : null,
      robotsJson: r.robotsJson && typeof r.robotsJson === 'object' ? r.robotsJson : null,
      noindex: Boolean(r.noindex),
    }))

    // Filter out noindex (check both boolean column and robotsJson legacy field)
    const indexable = rows.filter((row) => {
      if (row.noindex) return false
      const robots = row.robotsJson || {}
      return robots.index !== false
    })

    // Preload default patterns for all type+locale combos
    const defaultLocale = localeService.getDefaultLocale()
    const patternCache = new Map<string, string>()
    for (const row of indexable) {
      const key = `${row.type}:${row.locale}`
      if (patternCache.has(key)) continue
      const cfg = postTypeConfigService.getUiConfig(row.type)
      const hierarchical = cfg.hierarchyEnabled
      const seg = hierarchical ? '{path}' : '{slug}'
      const fallback =
        row.locale === defaultLocale ? `/${row.type}/${seg}` : `/{locale}/${row.type}/${seg}`
      try {
        const rec = await urlPatternService.getDefaultPattern(row.type, row.locale)
        patternCache.set(key, rec?.pattern || fallback)
      } catch {
        patternCache.set(key, fallback)
      }
    }

    // Build hierarchy map
    const byId = new Map<string, PostRow>()
    const children = new Map<string | null, PostRow[]>()
    for (const row of indexable) {
      byId.set(row.id, row)
    }
    for (const row of indexable) {
      const parentKey = row.parentId && byId.has(row.parentId) ? row.parentId : null
      const bucket = children.get(parentKey) || []
      bucket.push(row)
      children.set(parentKey, bucket)
    }

    const memoPath = new Map<string, string>()
    const getPattern = (row: PostRow) => {
      const key = `${row.type}:${row.locale}`
      return patternCache.get(key)!
    }

    const buildPath = (row: PostRow): string => {
      if (memoPath.has(row.id)) return memoPath.get(row.id)!
      const pattern = getPattern(row)
      const yyyy = String(row.createdAt.getUTCFullYear())
      const mm = String(row.createdAt.getUTCMonth() + 1).padStart(2, '0')
      const dd = String(row.createdAt.getUTCDate()).padStart(2, '0')
      const parentPath =
        row.parentId && byId.has(row.parentId) ? buildPath(byId.get(row.parentId)!) : ''
      const slugPath = parentPath ? `${parentPath}/${row.slug}` : row.slug
      const path = replaceTokens(pattern, {
        slug: row.slug,
        path: slugPath,
        locale: row.locale,
        yyyy,
        mm,
        dd,
      })
      memoPath.set(row.id, path)
      return path
    }

    const ordered: PostRow[] = []
    const sortChildren = (list: PostRow[]) =>
      list.sort((a, b) => {
        if (a.orderIndex !== b.orderIndex) return a.orderIndex - b.orderIndex
        return a.createdAt.getTime() - b.createdAt.getTime()
      })

    const walk = (parentId: string | null) => {
      const list = children.get(parentId)
      if (!list || list.length === 0) return
      sortChildren(list)
      for (const child of list) {
        ordered.push(child)
        walk(child.id)
      }
    }
    walk(null)

    const baseIdForRow = (row: PostRow) => row.translationOfId || row.id
    const locById = new Map<string, string>()
    const groupByBase = new Map<string, PostRow[]>()
    for (const row of ordered) {
      const baseId = baseIdForRow(row)
      const bucket = groupByBase.get(baseId) || []
      bucket.push(row)
      groupByBase.set(baseId, bucket)
    }

    const entries = ordered.map((row) => {
      const path = buildPath(row)
      const locRaw =
        row.canonicalUrl && row.canonicalUrl.trim()
          ? row.canonicalUrl.trim()
          : `${options.protocol}://${options.host}${path}`
      const loc = locRaw.startsWith('http')
        ? locRaw
        : `${options.protocol}://${options.host}${locRaw}`
      locById.set(row.id, loc)
      const lastDate = row.updatedAt || row.publishedAt || row.createdAt
      const lastmod = lastDate ? new Date(lastDate).toISOString() : null
      return { id: row.id, baseId: baseIdForRow(row), locale: row.locale, loc, lastmod }
    })

    const xmlBody = entries
      .map((u) => {
        const lastmodLine = u.lastmod ? `    <lastmod>${escapeXml(u.lastmod)}</lastmod>` : ''
        const alternates = groupByBase.get(u.baseId) || []
        const altLinkLines = alternates.map((alt) => {
          const href = locById.get(alt.id) || u.loc
          return `    <xhtml:link rel="alternate" hreflang="${escapeXml(alt.locale)}" href="${escapeXml(href)}" />`
        })
        // x-default points to default locale variant if present
        const defaultAlt = alternates.find((a) => a.locale === defaultLocale) || alternates[0]
        const xDefaultLine =
          defaultAlt && locById.get(defaultAlt.id)
            ? `    <xhtml:link rel="alternate" hreflang="x-default" href="${escapeXml(
              locById.get(defaultAlt.id)!
            )}" />`
            : null

        const lines = ['  <url>', `    <loc>${escapeXml(u.loc)}</loc>`]
        if (lastmodLine) lines.push(lastmodLine)
        lines.push(...altLinkLines)
        if (xDefaultLine) lines.push(xDefaultLine)
        lines.push('  </url>')
        return lines.join('\n')
      })
      .join('\n')

    const xml = [
      '<?xml version="1.0" encoding="UTF-8"?>',
      '<?xml-stylesheet type="text/xsl" href="/sitemap.xsl"?>',
      '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">',
      xmlBody,
      '</urlset>',
    ]
      .join('\n')
      .trim()
    this.setCache(cacheKey, xml)
    return xml
  }
}

const sitemapService = new SitemapService()
export default sitemapService
