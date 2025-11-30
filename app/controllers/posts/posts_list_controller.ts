import type { HttpContext } from '@adonisjs/core/http'
import Post from '#models/post'
import db from '@adonisjs/lucid/services/db'
import postTypeConfigService from '#services/post_type_config_service'
import BasePostsController from './base_posts_controller.js'
import cmsConfig from '#config/cms'
import PostListItemDto from '#dtos/post_list_item_dto'

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
    const inReviewParam = String(request.input('inReview', '')).trim()
    const inReview = inReviewParam === '1' || inReviewParam.toLowerCase() === 'true'
    const status = String(request.input('status', '')).trim()
    const locale = String(request.input('locale', '')).trim()
    const taxonomySlug = String(request.input('taxonomy', '')).trim()
    const termIdRaw = String(request.input('termId', '')).trim()
    const includeDescendants = String(request.input('includeDescendants', '1')).trim() === '1'
    const sortByRaw = String(request.input('sortBy', 'updated_at')).trim()
    const sortOrderRaw = String(request.input('sortOrder', 'desc')).trim()
    const page = Math.max(1, Number(request.input('page', 1)) || 1)
    const limit = Math.min(
      cmsConfig.pagination.maxLimit,
      Math.max(1, Number(request.input('limit', cmsConfig.pagination.defaultLimit)) || cmsConfig.pagination.defaultLimit)
    )

    // Include deleted posts if requested (admin only)
    const includeDeleted = String(request.input('includeDeleted', '')).trim() === '1'

    const allowedSort = new Set(['title', 'slug', 'status', 'locale', 'updated_at', 'created_at', 'published_at', 'order_index'])
    const sortBy = allowedSort.has(sortByRaw) ? sortByRaw : 'updated_at'
    const sortOrder = sortOrderRaw.toLowerCase() === 'asc' ? 'asc' : 'desc'

    // Support multiple post types
    const typesParam = request.input('types')
    let types: string[] = []
    if (Array.isArray(request.qs().type)) {
      types = (request.qs().type as string[]).map((t) => String(t).trim()).filter(Boolean)
    } else if (typeof typesParam === 'string' && typesParam.trim()) {
      types = typesParam.split(',').map((t) => t.trim()).filter(Boolean)
    }

    const parentId = String(request.input('parentId', '')).trim()
    const rootsOnly = String(request.input('roots', '')).trim()
    const wantRoots = rootsOnly === '1' || rootsOnly.toLowerCase() === 'true'

    // Temporarily disable soft delete filter if requested
    if (includeDeleted) {
      Post.softDeleteEnabled = false
    }

    try {
      const query = Post.query()

      if (q) {
        query.where((builder) => {
          builder.whereILike('title', `%${q}%`).orWhereILike('slug', `%${q}%`)
        })
      }
      if (type) {
        query.where('type', type)
      }
      if (!type && types.length > 0) {
        query.whereIn('type', types)
      }
      if (status) {
        query.where('status', status)
      }
      if (inReview) {
        query.whereNotNull('review_draft')
      }
      if (locale) {
        query.where('locale', locale)
      }

      // Taxonomy filtering
      if (termIdRaw) {
        let termIds: string[] = [termIdRaw]
        if (includeDescendants) {
          try {
            const taxonomyService = (await import('#services/taxonomy_service')).default
            const descendants = await taxonomyService.getDescendantIds(termIdRaw)
            termIds = termIds.concat(descendants)
          } catch { /* ignore */ }
        }
        query.join('post_taxonomy_terms as ptt', 'ptt.post_id', 'posts.id')
        query.whereIn('ptt.taxonomy_term_id', termIds)
      }

      if (parentId) {
        query.where('parent_id', parentId)
      } else if (wantRoots) {
        query.whereNull('parent_id')
      }

      // Use window function for optimized count
      const rows = await query
        .select('*')
        .select(db.raw('COUNT(*) OVER() as total_count'))
        .orderBy(sortBy, sortOrder)
        .forPage(page, limit)

      const total = rows.length > 0 ? Number((rows[0] as any).total_count || 0) : 0

      // Optional: include translation family locales
      const withTranslations = String(request.input('withTranslations', '0')).trim() === '1'
      let baseIdToLocales: Map<string, Set<string>> | undefined

      if (withTranslations && rows.length > 0) {
        const baseIds = Array.from(new Set(rows.map((p) => p.translationOfId || p.id)))
        const familyPosts = await Post.query()
          .whereIn('translation_of_id', baseIds)
          .orWhereIn('id', baseIds)

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
   * GET /api/post-types
   * List available post types from code definitions
   */
  async types({ response }: HttpContext) {
    const out = new Set<string>()

    try {
      const postTypeRegistry = (await import('#services/post_type_registry')).default as any
      const regList: string[] = Array.isArray(postTypeRegistry.list?.()) ? postTypeRegistry.list() : []
      regList.forEach((t) => t && out.add(String(t)))
    } catch { /* ignore */ }

    try {
      const fs = require('node:fs')
      const path = require('node:path')
      const appRoot = process.cwd()
      const dir = path.join(appRoot, 'app', 'post_types')
      const list = fs.existsSync(dir) ? fs.readdirSync(dir) : []
      list
        .filter((f: string) => f.endsWith('.ts') || f.endsWith('.js'))
        .map((f: string) => f.replace(/\.ts$|\.js$/g, ''))
        .forEach((s: string) => s && out.add(s))
    } catch { /* ignore */ }

    return response.ok({ data: Array.from(out).sort() })
  }
}

