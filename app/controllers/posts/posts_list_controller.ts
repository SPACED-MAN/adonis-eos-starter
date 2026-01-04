import fs from 'node:fs'
import path from 'node:path'
import type { HttpContext } from '@adonisjs/core/http'
import Post from '#models/post'
import BasePostsController from './base_posts_controller.js'
import cmsConfig from '#config/cms'
import PostListItemDto from '#dtos/post_list_item_dto'
import postTypeConfigService from '#services/post_type_config_service'
import postTypeRegistry from '#services/post_type_registry'

/**
 * Posts List Controller
 *
 * Handles listing and querying posts.
 */
export default class PostsListController extends BasePostsController {
  /**
   * GET /api/posts
   * List posts with optional search, filters, sorting, and pagination
   */
  async index({ request, response }: HttpContext) {
    const q = String(request.input('q', '')).trim()
    const type = String(request.input('type', '')).trim()
    const idsParam = request.input('ids')
    let ids: string[] = []
    if (Array.isArray(idsParam)) {
      ids = idsParam.map((id) => String(id).trim()).filter(Boolean)
    } else if (typeof idsParam === 'string' && idsParam.trim()) {
      ids = idsParam
        .split(',')
        .map((id) => id.trim())
        .filter(Boolean)
    }

    const inReviewParam = String(request.input('inReview', '')).trim()
    const inReview = inReviewParam === '1' || inReviewParam.toLowerCase() === 'true'
    const hasFeedbackParam = String(request.input('hasFeedback', '')).trim()
    const hasFeedback = hasFeedbackParam === '1' || hasFeedbackParam.toLowerCase() === 'true'
    const statusParam = request.input('status')
    const locale = String(request.input('locale', '')).trim()
    const termIdRaw = String(request.input('termId', '')).trim()
    const includeDescendants = String(request.input('includeDescendants', '1')).trim() === '1'
    const sortByRaw = String(request.input('sortBy', 'updated_at')).trim()
    const sortOrderRaw = String(request.input('sortOrder', 'desc')).trim()
    const page = Math.max(1, Number(request.input('page', 1)) || 1)
    const limit = Math.min(
      cmsConfig.pagination.maxLimit,
      Math.max(
        1,
        Number(request.input('limit', cmsConfig.pagination.defaultLimit)) ||
          cmsConfig.pagination.defaultLimit
      )
    )

    // Support multiple statuses
    let statuses: string[] = []
    if (Array.isArray(request.qs().status)) {
      statuses = (request.qs().status as string[]).map((s) => String(s).trim()).filter(Boolean)
    } else if (typeof statusParam === 'string' && statusParam.trim()) {
      statuses = statusParam
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
    }

    // Include deleted posts if requested (admin only)
    const includeDeleted = String(request.input('includeDeleted', '')).trim() === '1'

    const allowedSort = new Set([
      'title',
      'slug',
      'status',
      'locale',
      'updated_at',
      'created_at',
      'published_at',
      'order_index',
    ])
    const sortBy = allowedSort.has(sortByRaw) ? sortByRaw : 'updated_at'
    const sortOrder = sortOrderRaw.toLowerCase() === 'asc' ? 'asc' : 'desc'

    // Support multiple post types
    const typesParam = request.input('types')
    let types: string[] = []
    if (Array.isArray(request.qs().type)) {
      types = (request.qs().type as string[]).map((t) => String(t).trim()).filter(Boolean)
    } else if (typeof typesParam === 'string' && typesParam.trim()) {
      types = typesParam
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean)
    }

    const parentId = String(request.input('parentId', '')).trim()
    const rootsOnly = String(request.input('roots', '')).trim()
    const wantRoots = rootsOnly === '1' || rootsOnly.toLowerCase() === 'true'

    const hasPermalinksOnly =
      String(request.input('hasPermalinks', '')).trim() === '1' ||
      String(request.input('hasPermalinks', '')).toLowerCase() === 'true'

    // Temporarily disable soft delete filter if requested
    if (includeDeleted) {
      Post.softDeleteEnabled = false
    }

    try {
      // If filtering by permalinks, resolve the set of allowed types first
      let permalinkEnabledTypes: string[] | null = null
      if (hasPermalinksOnly) {
        try {
          // Also include types from directory scan
          const dirScan = await (async () => {
            try {
              const dir = path.join(process.cwd(), 'app', 'post_types')
              const exists = await fs.promises.access(dir).then(() => true).catch(() => false)
              if (exists) {
                const files = await fs.promises.readdir(dir)
                return files
                  .filter((f: string) => f.endsWith('.ts') || f.endsWith('.js'))
                  .map((f: string) => f.replace(/\.ts$|\.js$/g, ''))
              }
              return []
            } catch {
              return []
            }
          })()

          const allTypes: string[] = Array.from(
            new Set([
              ...(Array.isArray(postTypeRegistry.list?.()) ? postTypeRegistry.list() : []),
              ...dirScan,
            ])
          )

          permalinkEnabledTypes = allTypes.filter((t) => {
            const cfg = postTypeConfigService.getUiConfig(t)
            return cfg.permalinksEnabled && cfg.urlPatterns.length > 0
          })
        } catch (e) {
          console.error('[PostsListController] Failed to resolve permalink types:', e)
        }
      }

      // Build base query with filters
      const query = Post.query()

      if (q) {
        query.where((builder) => {
          builder.whereILike('title', `%${q}%`).orWhereILike('slug', `%${q}%`)
        })
      }
      if (ids.length > 0) {
        query.whereIn('id', ids)
      }

      // Type filtering
      if (type) {
        // If specific type requested, check if it fits permalink filter
        if (permalinkEnabledTypes && !permalinkEnabledTypes.includes(type)) {
          return this.response.paginated(response, [], { total: 0, page, limit, sortBy, sortOrder })
        }
        query.where('type', type)
      } else if (types.length > 0) {
        // If list of types requested, intersect with permalink filter
        const effectiveTypes = permalinkEnabledTypes
          ? types.filter((t) => permalinkEnabledTypes!.includes(t))
          : types
        if (effectiveTypes.length === 0) {
          return this.response.paginated(response, [], { total: 0, page, limit, sortBy, sortOrder })
        }
        query.whereIn('type', effectiveTypes)
      } else if (permalinkEnabledTypes) {
        // No types requested, but permalink filter active: restrict to enabled types
        query.whereIn('type', permalinkEnabledTypes)
      }
      if (statuses.length > 0) {
        query.whereIn('status', statuses)
      }
      if (inReview) {
        query.whereNotNull('review_draft')
      }
      if (hasFeedback) {
        query.has('feedbacks')
      }
      if (locale) {
        query.where('locale', locale)
      }

      // Taxonomy filtering
      let termIdsForFilter: string[] | null = null
      if (termIdRaw) {
        termIdsForFilter = [termIdRaw]
        if (includeDescendants) {
          try {
            const taxonomyModule = await import('#services/taxonomy_service')
            const taxonomyService = taxonomyModule.default
            const descendants = await taxonomyService.getDescendantIds(termIdRaw)
            termIdsForFilter = termIdsForFilter.concat(descendants)
          } catch {
            /* ignore */
          }
        }
        query.join('post_taxonomy_terms as ptt', 'ptt.post_id', 'posts.id')
        query.whereIn('ptt.taxonomy_term_id', termIdsForFilter)
      }

      if (parentId) {
        query.where('parent_id', parentId)
      } else if (wantRoots) {
        query.whereNull('parent_id')
      }

      // Apply sorting and paginate in one go
      const result = await query.orderBy(sortBy, sortOrder).withCount('feedbacks').paginate(page, limit)
      const rows = result.all()
      const total = result.getMeta().total

      // Resolve paths for all rows if requested or if it's a list view
      const urlPatternService = (await import('#services/url_pattern_service')).default
      const urlMap = await urlPatternService.buildPostPaths(rows.map((r) => r.id))

      // Optional: include translation family locales
      const withTranslations = String(request.input('withTranslations', '0')).trim() === '1'
      let baseIdToLocales: Map<string, Set<string>> | undefined

      if (withTranslations && rows.length > 0) {
        const baseIds = Array.from(new Set(rows.map((p) => p.translationOfId || p.id)))
        const familyPosts = await Post.query()
          .where((builder) => {
            builder.whereIn('translation_of_id', baseIds).orWhereIn('id', baseIds)
          })
          .select('id', 'translation_of_id', 'locale') // Optimized select

        baseIdToLocales = new Map()
        familyPosts.forEach((fp) => {
          const baseId = fp.translationOfId || fp.id
          if (!baseIdToLocales!.has(baseId)) baseIdToLocales!.set(baseId, new Set())
          baseIdToLocales!.get(baseId)!.add(fp.locale)
        })
      }

      const items = rows.map((p) => {
        const baseId = p.translationOfId || p.id
        const familyLocales = withTranslations
          ? Array.from(baseIdToLocales?.get(baseId) || new Set<string>([p.locale]))
          : undefined

        return new PostListItemDto(p, {
          url: urlMap.get(p.id) || null,
          familyLocales,
          hasReviewDraft: Boolean((p as any).reviewDraft),
          isDeleted: (p as any).deletedAt !== null,
        })
      })

      return this.response.paginated(response, items, { total, page, limit, sortBy, sortOrder })
    } finally {
      // Re-enable soft delete filter
      if (includeDeleted) {
        Post.softDeleteEnabled = true
      }
    }
  }

  /**
   * GET /api/public/posts
   * Public endpoint for resolving post info (links, basic metadata).
   * Restricted to published posts only.
   */
  async publicIndex({ request, response }: HttpContext) {
    const idsParam = request.input('ids')
    let ids: string[] = []
    if (Array.isArray(idsParam)) {
      ids = idsParam.map((id) => String(id).trim()).filter(Boolean)
    } else if (typeof idsParam === 'string' && idsParam.trim()) {
      ids = idsParam
        .split(',')
        .map((id) => id.trim())
        .filter(Boolean)
    }

    if (ids.length === 0) {
      return response.badRequest({ error: 'ids parameter is required' })
    }

    const posts = await Post.query()
      .whereIn('id', ids)
      .where('status', 'published')
      .select('id', 'title', 'slug', 'type', 'locale', 'canonical_url')

    const postIdsForUrl = posts.filter((p) => !p.canonicalUrl).map((p) => p.id)
    const urlPatternService = (await import('#services/url_pattern_service')).default
    const resolvedPaths = await urlPatternService.buildPostPaths(postIdsForUrl)

    const items = posts.map((p) => {
      const url = p.canonicalUrl || resolvedPaths.get(String(p.id)) || '/'
      return {
        id: p.id,
        title: p.title,
        slug: p.slug,
        type: p.type,
        locale: p.locale,
        url,
      }
    })

    return response.ok({ data: items })
  }

  /**
   * GET /api/post-types
   * List available post types from code definitions
   */
  async types({ response }: HttpContext) {
    const out = new Set<string>()

    try {
      const regList: string[] = Array.isArray(postTypeRegistry.list?.())
        ? postTypeRegistry.list()
        : []
      regList.forEach((t) => t && out.add(String(t)))
    } catch {
      /* ignore */
    }

    try {
      const dir = path.join(process.cwd(), 'app', 'post_types')
      if (fs.existsSync(dir)) {
        const list = await fs.promises.readdir(dir)
        list
          .filter((f: string) => f.endsWith('.ts') || f.endsWith('.js'))
          .map((f: string) => f.replace(/\.ts$|\.js$/g, ''))
          .forEach((s: string) => s && out.add(s))
      }
    } catch {
      /* ignore */
    }

    return response.ok({ data: Array.from(out).sort() })
  }
}
