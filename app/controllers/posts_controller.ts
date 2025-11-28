import type { HttpContext } from '@adonisjs/core/http'
import Post from '#models/post'
import CreatePost, { CreatePostException } from '#actions/posts/create_post'
import UpdatePost, { UpdatePostException } from '#actions/posts/update_post'
import AddModuleToPost, { AddModuleToPostException } from '#actions/posts/add_module_to_post'
import UpdatePostModule, { UpdatePostModuleException } from '#actions/posts/update_post_module'
import CreateTranslation, { CreateTranslationException } from '#actions/translations/create_translation'
import BulkPostsAction from '#actions/posts/bulk_action'
import db from '@adonisjs/lucid/services/db'
import urlPatternService from '#services/url_pattern_service'
import postTypeConfigService from '#services/post_type_config_service'
import authorizationService from '#services/authorization_service'
import RevisionService from '#services/revision_service'
import PostSerializerService from '#services/post_serializer_service'
import siteSettingsService from '#services/site_settings_service'

/**
 * Posts Controller
 *
 * Handles CRUD operations for posts and their modules.
 */
export default class PostsController {
  private normalizeJsonb(value: any): any {
    if (value === undefined) return null
    if (typeof value === 'string') return JSON.stringify(value)
    return value
  }
  /**
   * PATCH /api/posts/:id/author
   * Admin-only: reassign post author
   */
  async updateAuthor({ params, request, response }: HttpContext) {
    const { id } = params
    const authorIdRaw = request.input('authorId')
    const authorId = Number(authorIdRaw)
    if (!authorId || Number.isNaN(authorId)) {
      return response.badRequest({ error: 'authorId must be a valid user id' })
    }
    const post = await Post.find(id)
    if (!post) return response.notFound({ error: 'Post not found' })
    // Ensure target user exists
    const exists = await db.from('users').where('id', authorId).first()
    if (!exists) return response.notFound({ error: 'User not found' })
    // Extra check: prevent assigning multiple profiles to one user
    if (post.type === 'profile') {
      const existing = await db.from('posts').where({ type: 'profile', author_id: authorId }).andWhereNot('id', id).first()
      if (existing) {
        return response.status(409).json({ error: 'Target user already has a profile' })
      }
    }
    await db.from('posts').where('id', id).update({ author_id: authorId, updated_at: new Date() })
    try {
      await (await import('#services/activity_log_service')).default.log({
        action: 'post.author.update',
        entityType: 'post',
        entityId: id,
        metadata: { authorId },
      })
    } catch { }
    return response.ok({ message: 'Author updated' })
  }
  /**
   * GET /api/posts
   * List posts with optional search, filters, sorting, and pagination
   * Query: q, status, locale, sortBy, sortOrder, page, limit
   */
  async index({ request, response }: HttpContext) {
    const q = String(request.input('q', '')).trim()
    const type = String(request.input('type', '')).trim()
    const status = String(request.input('status', '')).trim()
    const inReviewParam = String(request.input('inReview', '')).trim()
    const inReview = inReviewParam === '1' || inReviewParam.toLowerCase() === 'true'
    const locale = String(request.input('locale', '')).trim()
    const sortByRaw = String(request.input('sortBy', 'updated_at')).trim()
    const sortOrderRaw = String(request.input('sortOrder', 'desc')).trim()
    const page = Math.max(1, Number(request.input('page', 1)) || 1)
    const limit = Math.min(1000, Math.max(1, Number(request.input('limit', 20)) || 20))

    const allowedSort = new Set(['title', 'slug', 'status', 'locale', 'updated_at', 'created_at', 'published_at', 'order_index'])
    const sortBy = allowedSort.has(sortByRaw) ? sortByRaw : 'updated_at'
    const sortOrder = sortOrderRaw.toLowerCase() === 'asc' ? 'asc' : 'desc'

    // Support multiple post types (?types=blog,page or repeated ?type=blog&type=page)
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
    if (parentId) {
      query.where('parent_id', parentId)
    } else if (wantRoots) {
      query.whereNull('parent_id')
    }
    const countQuery = db.from('posts')
    if (q) {
      countQuery.where((b) => b.whereILike('title', `%${q}%`).orWhereILike('slug', `%${q}%`))
    }
    if (type) {
      countQuery.where('type', type)
    }
    if (!type && types.length > 0) {
      countQuery.whereIn('type', types)
    }
    if (status) {
      countQuery.where('status', status)
    }
    if (inReview) {
      countQuery.whereNotNull('review_draft')
    }
    if (locale) {
      countQuery.where('locale', locale)
    }
    if (parentId) {
      countQuery.where('parent_id', parentId)
    } else if (wantRoots) {
      countQuery.whereNull('parent_id')
    }
    const countRows = await countQuery.count('* as total')
    const total = Number((countRows?.[0] as any)?.total || 0)
    const rows = await query.orderBy(sortBy, sortOrder).forPage(page, limit)

    // Optional: include translation family locales when requested
    const withTranslations = String(request.input('withTranslations', '0')).trim() === '1'
    let baseIdToLocales: Map<string, Set<string>> | undefined
    if (withTranslations && rows.length > 0) {
      const baseIds = Array.from(
        new Set(rows.map((p) => (p as any).translationOfId || p.id))
      )
      const familyPosts = await Post.query()
        .whereIn('translation_of_id', baseIds)
        .orWhereIn('id', baseIds)
      baseIdToLocales = new Map()
      familyPosts.forEach((fp: any) => {
        const baseId = fp.translationOfId || fp.id
        if (!baseIdToLocales!.has(baseId)) baseIdToLocales!.set(baseId, new Set())
        baseIdToLocales!.get(baseId)!.add(fp.locale)
      })
    }

    return response.ok({
      data: rows.map((p: any) => {
        const baseId = p.translationOfId || p.id
        const familyLocales = withTranslations
          ? Array.from(baseIdToLocales?.get(baseId) || new Set<string>([p.locale]))
          : undefined
        return {
          id: p.id,
          type: p.type,
          title: p.title,
          slug: p.slug,
          status: p.status,
          locale: p.locale,
          excerpt: p.excerpt,
          orderIndex: (p as any).orderIndex ?? (p as any).order_index ?? 0,
          parentId: (p as any).parentId || (p as any).parent_id || null,
          updatedAt: p?.updatedAt?.toISO ? p.updatedAt.toISO() : p.updatedAt,
          translationOfId: p.translationOfId || null,
          familyLocales,
          hasReviewDraft: Boolean((p as any).reviewDraft || (p as any).review_draft),
        }
      }),
      meta: {
        total,
        page,
        limit,
        sortBy,
        sortOrder,
      },
    })
  }

  /**
   * GET /api/post-types
   * List distinct post types from templates and posts
   */
  async types({ response }: HttpContext) {
    // Strict code-first: prefer registry list + file scan, deduped
    const out = new Set<string>()
    try {
      // 1) Registry (explicitly registered in start/post_types.ts)
      const postTypeRegistry = (await import('#services/post_type_registry')).default as any
      const regList: string[] = Array.isArray(postTypeRegistry.list?.()) ? postTypeRegistry.list() : []
      regList.forEach((t) => t && out.add(String(t)))
    } catch { /* ignore */ }
    try {
      // 2) Filesystem scan (app/post_types/*.ts|*.js)
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
  /**
   * GET /admin/posts/:id/edit
   *
   * Show the post editor
   */
  async edit({ params, inertia }: HttpContext) {
    try {
      const post = await Post.findOrFail(params.id)
      // Load post modules for editor
      const postModules = await db
        .from('post_modules')
        .join('module_instances', 'post_modules.module_id', 'module_instances.id')
        .where('post_modules.post_id', post.id)
        .select(
          'post_modules.id as postModuleId',
          'post_modules.review_added as reviewAdded',
          'post_modules.review_deleted as reviewDeleted',
          'module_instances.type',
          'module_instances.scope',
          'module_instances.props',
          'module_instances.review_props',
          'post_modules.overrides',
          'post_modules.review_overrides',
          'post_modules.locked',
          'post_modules.order_index as orderIndex',
          'module_instances.global_slug as globalSlug',
          'module_instances.global_label as globalLabel'
        )
        .orderBy('post_modules.order_index', 'asc')

      // Load translations for this post family
      const baseId = post.translationOfId || post.id
      const family = await Post.query().where((q) => {
        q.where('translationOfId', baseId).orWhere('id', baseId)
      })
      const translations = family.map((p) => ({ id: p.id, locale: p.locale }))

      // Build public path using pattern (relative URL for environment-agnostic linking)
      const publicPath = await urlPatternService.buildPostPath(
        post.type,
        post.slug,
        post.locale,
        (post.createdAt && post.createdAt.toISO()) ? new Date(post.createdAt.toISO()!) : undefined
      )

      // Load author for editor context
      let author: { id: number; email: string; fullName: string | null } | null = null
      try {
        const arow = await db.from('users').where('id', (post as any).authorId || (post as any).author_id).first()
        if (arow) {
          author = { id: Number((arow as any).id), email: (arow as any).email, fullName: (arow as any).full_name ?? null }
        }
      } catch { /* ignore */ }

      // Load custom fields for this post type from code config and merge with saved values by slug
      let cfRows: any[] = []
      try {
        const uiCfg = postTypeConfigService.getUiConfig(post.type)
        const fields = Array.isArray((uiCfg as any).fields) ? (uiCfg as any).fields : []
        const slugs: string[] = fields.map((f: any) => String(f.slug))
        let valuesBySlug = new Map<string, any>()
        if (slugs.length > 0) {
          const vals = await db.from('post_custom_field_values').where('post_id', post.id).whereIn('field_slug', slugs)
          valuesBySlug = new Map<string, any>(vals.map((v: any) => [String(v.field_slug), v.value]))
        }
        cfRows = fields.map((f: any) => ({
          id: f.slug,
          slug: f.slug,
          label: f.label,
          fieldType: f.type,
          config: f.config || {},
          translatable: !!(f as any).translatable,
          value: valuesBySlug.get(String(f.slug)) ?? null,
        }))
      } catch (e) {
        cfRows = []
      }

      const uiConfig = postTypeConfigService.getUiConfig(post.type)
      return inertia.render('admin/posts/editor', {
        post: {
          id: post.id,
          type: post.type,
          slug: post.slug,
          title: post.title,
          excerpt: post.excerpt,
          status: post.status,
          locale: post.locale,
          parentId: (post as any).parentId || null,
          metaTitle: post.metaTitle,
          metaDescription: post.metaDescription,
          canonicalUrl: post.canonicalUrl,
          robotsJson: post.robotsJson,
          jsonldOverrides: post.jsonldOverrides,
          createdAt: post.createdAt.toISO(),
          updatedAt: post.updatedAt.toISO(),
          publicPath,
          author,
        },
        reviewDraft: (post as any).reviewDraft || (post as any).review_draft || null,
        modules: postModules.map((pm) => ({
          id: pm.postModuleId,
          type: pm.type,
          scope: pm.scope,
          props: pm.props || {},
          reviewProps: (pm as any).review_props || null,
          overrides: pm.overrides || null,
          reviewOverrides: (pm as any).review_overrides || null,
          reviewAdded: (pm as any).reviewAdded || false,
          reviewDeleted: (pm as any).reviewDeleted || false,
          locked: pm.locked,
          orderIndex: pm.orderIndex,
          globalSlug: (pm as any).globalSlug || null,
          globalLabel: (pm as any).globalLabel || null,
        })),
        translations,
        customFields: (cfRows || []).map((f: any) => ({
          id: f.id,
          slug: f.slug,
          label: f.label,
          fieldType: f.fieldtype || f.fieldType,
          config: f.config || {},
          translatable: !!(f as any).translatable,
          value: (f as any).value ?? null,
        })),
        uiConfig,
      })
    } catch (error) {
      // Return an Inertia 404 page instead of JSON to satisfy Inertia expectations
      return inertia.render('admin/errors/not_found')
    }
  }

  /**
   * POST /api/posts
   *
   * Create a new post, optionally with a template.
   */
  async store({ request, response, auth }: HttpContext) {
    const { type, locale, slug, title, status, excerpt, metaTitle, metaDescription, templateId } =
      request.only([
        'type',
        'locale',
        'slug',
        'title',
        'status',
        'excerpt',
        'metaTitle',
        'metaDescription',
        'templateId',
      ])

    try {
      // Authorization: translators cannot create posts
      const role = (auth.use('web').user as any)?.role as 'admin' | 'editor' | 'translator' | undefined
      if (!authorizationService.canCreatePost(role)) {
        return response.forbidden({ error: 'Not allowed to create posts' })
      }
      const post = await CreatePost.handle({
        type,
        locale,
        slug,
        title,
        status,
        excerpt,
        metaTitle,
        metaDescription,
        templateId,
        userId: auth.user!.id,
      })

      // Activity log
      try {
        await (await import('#services/activity_log_service')).default.log({
          action: 'post.create',
          userId: (auth.use('web').user as any)?.id ?? null,
          entityType: 'post',
          entityId: (post as any).id,
          metadata: { type, locale, slug, title, status },
        })
      } catch { }
      return response.created({
        data: {
          id: post.id,
          type: post.type,
          locale: post.locale,
          slug: post.slug,
          title: post.title,
          status: post.status,
          createdAt: post.createdAt,
        },
        message: 'Post created successfully',
      })
    } catch (error) {
      if (error instanceof CreatePostException) {
        return response.status(error.statusCode).json({
          error: error.message,
          ...error.meta,
        })
      }
      throw error
    }
  }

  /**
   * POST /api/posts/:id/translations
   *
   * Create a translation for the given post family in the specified locale.
   */
  async createTranslation({ params, request, response }: HttpContext) {
    const { id } = params
    const { locale, slug, title, metaTitle, metaDescription } = request.only([
      'locale',
      'slug',
      'title',
      'metaTitle',
      'metaDescription',
    ])
    if (!locale) return response.badRequest({ error: 'locale is required' })
    try {
      const translation = await CreateTranslation.handle({
        postId: id,
        locale,
        slug,
        title,
        metaTitle,
        metaDescription,
      })
      if (request.header('x-inertia')) {
        return response.redirect().toPath(`/admin/posts/${translation.id}/edit`)
      }
      return response.created({ id: translation.id })
    } catch (error) {
      if (error instanceof CreateTranslationException) {
        return response.status(error.statusCode).json({
          error: error.message,
          ...error.meta,
        })
      }
      throw error
    }
  }

  /**
   * PUT /api/posts/:id
   *
   * Update an existing post.
   */
  async update({ params, request, response, auth }: HttpContext) {
    const { id } = params
    const {
      slug,
      title,
      status,
      excerpt,
      parentId,
      orderIndex,
      metaTitle,
      metaDescription,
      canonicalUrl,
      robotsJson,
      jsonldOverrides,
      scheduledAt,
      mode,
      customFields,
    } = request.only([
      'slug',
      'title',
      'status',
      'excerpt',
      'parentId',
      'orderIndex',
      'metaTitle',
      'metaDescription',
      'canonicalUrl',
      'robotsJson',
      'jsonldOverrides',
      'scheduledAt',
      'mode',
      'customFields',
    ])

    try {
      const saveMode = String(mode || 'publish').toLowerCase()
      if (saveMode === 'review') {
        const reviewModuleRemovals = request.input('reviewModuleRemovals', [])
        const reviewCustomFields = request.input('customFields', undefined)
        const draftPayload: Record<string, any> = {
          slug,
          title,
          status,
          excerpt,
          parentId,
          orderIndex,
          metaTitle,
          metaDescription,
          canonicalUrl,
          robotsJson,
          jsonldOverrides,
          customFields: Array.isArray(reviewCustomFields) ? reviewCustomFields : undefined,
          removedModuleIds: Array.isArray(reviewModuleRemovals) ? reviewModuleRemovals : [],
          savedAt: new Date().toISOString(),
          savedBy: (auth.use('web').user as any)?.email || null,
        }
        // Use snake_case column name created by migration
        await Post.query().where('id', id).update({ review_draft: draftPayload } as any)
        // Mark review deletions in post_modules so they persist across reloads
        if (Array.isArray(reviewModuleRemovals) && reviewModuleRemovals.length > 0) {
          await db.from('post_modules').whereIn('id', reviewModuleRemovals).update({ review_deleted: true, updated_at: new Date() } as any)
        }
        // Record a review-draft revision
        await RevisionService.record({
          postId: id,
          mode: 'review',
          snapshot: draftPayload,
          userId: (auth.use('web').user as any)?.id,
        })
        // Activity log
        try {
          await (await import('#services/activity_log_service')).default.log({
            action: 'post.review.save',
            userId: (auth.use('web').user as any)?.id ?? null,
            entityType: 'post',
            entityId: id,
            metadata: { fields: Object.keys(draftPayload || {}) },
          })
        } catch { }
        // For XHR/API clients, return JSON; avoid redirect which can confuse fetch()
        return response.ok({ message: 'Saved for review' })
      }
      if (saveMode === 'approve') {
        // Load current post to get persisted review_draft and status
        try {
          const current = await Post.findOrFail(id)
          const rd: any = (current as any).reviewDraft || (current as any).review_draft
          if (!rd) {
            return response.badRequest({ error: 'No review draft to approve' })
          }
          // Prepare fields from review draft, but DO NOT alter status
          const nextSlug = rd.slug ?? current.slug
          const nextTitle = rd.title ?? current.title
          const nextExcerpt = rd.excerpt ?? current.excerpt
          const nextParentId = rd.parentId ?? (current as any).parentId ?? null
          const nextOrderIndex = typeof rd.orderIndex === 'number' ? rd.orderIndex : ((current as any).orderIndex ?? 0)
          const nextMetaTitle = rd.metaTitle ?? current.metaTitle
          const nextMetaDescription = rd.metaDescription ?? current.metaDescription
          const nextCanonicalUrl = rd.canonicalUrl ?? current.canonicalUrl
          const nextRobots =
            typeof rd.robotsJson === 'string'
              ? (() => {
                try {
                  return JSON.parse(rd.robotsJson)
                } catch {
                  return null
                }
              })()
              : rd.robotsJson ?? current.robotsJson
          const nextJsonLd =
            typeof rd.jsonldOverrides === 'string'
              ? (() => {
                try {
                  return JSON.parse(rd.jsonldOverrides)
                } catch {
                  return null
                }
              })()
              : rd.jsonldOverrides ?? current.jsonldOverrides

          await UpdatePost.handle({
            postId: id,
            slug: nextSlug,
            title: nextTitle,
            status: current.status, // preserve status
            excerpt: nextExcerpt,
            parentId: nextParentId || undefined,
            orderIndex: nextOrderIndex,
            metaTitle: nextMetaTitle,
            metaDescription: nextMetaDescription,
            canonicalUrl: nextCanonicalUrl,
            robotsJson: nextRobots,
            jsonldOverrides: nextJsonLd,
          })
          // Promote review custom fields to live values (by slug)
          if (Array.isArray((rd as any)?.customFields)) {
            const now = new Date()
            for (const cf of ((rd as any).customFields as Array<{ slug?: string; value: any }>)) {
              if (!cf) continue
              const fieldSlug = String((cf as any).slug || '').trim()
              if (!fieldSlug) continue
              const valueRaw = (cf as any).value === undefined ? null : (cf as any).value
              const value = this.normalizeJsonb(valueRaw)
              const updated = await db.from('post_custom_field_values').where({ post_id: id, field_slug: fieldSlug }).update({ value, updated_at: now } as any)
              if (!updated) {
                await db.table('post_custom_field_values').insert({
                  id: (await import('node:crypto')).randomUUID(),
                  post_id: id,
                  field_slug: fieldSlug,
                  value,
                  created_at: now,
                  updated_at: now,
                })
              }
            }
          }
          // Promote review module changes to approved
          // 1) Local modules: review_props -> props
          await db
            .from('module_instances')
            .where('scope', 'post')
            .andWhereIn(
              'id',
              db.from('post_modules').where('post_id', id).select('module_id')
            )
            .update({
              props: db.raw('COALESCE(review_props, props)'),
              review_props: null,
              updated_at: new Date(),
            } as any)
          // 2) Global/static overrides: review_overrides -> overrides
          await db
            .from('post_modules')
            .where('post_id', id)
            .update({
              overrides: db.raw('COALESCE(review_overrides, overrides)'),
              review_overrides: null,
              updated_at: new Date(),
            } as any)
          // 3) Delete modules marked review_deleted
          await db.from('post_modules').where('post_id', id).andWhere('review_deleted', true).delete()
          // 4) Finalize review_added (make visible)
          await db.from('post_modules').where('post_id', id).andWhere('review_added', true).update({ review_added: false, updated_at: new Date() } as any)
          // Apply module removals captured in review draft (if any)
          const toRemove: string[] = Array.isArray((rd as any).removedModuleIds) ? (rd as any).removedModuleIds : []
          if (toRemove.length > 0) {
            await db.from('post_modules').whereIn('id', toRemove).delete()
          }
          // Record an approved revision snapshot (post-live)
          await RevisionService.record({
            postId: id,
            mode: 'approved',
            snapshot: {
              slug: nextSlug,
              title: nextTitle,
              status: current.status,
              excerpt: nextExcerpt,
              metaTitle: nextMetaTitle,
              metaDescription: nextMetaDescription,
              canonicalUrl: nextCanonicalUrl,
              robotsJson: nextRobots,
              jsonldOverrides: nextJsonLd,
              customFields: Array.isArray((rd as any)?.customFields) ? (rd as any).customFields : undefined,
            },
            userId: (auth.use('web').user as any)?.id,
          })
          // Activity log
          try {
            await (await import('#services/activity_log_service')).default.log({
              action: 'post.review.approve',
              userId: (auth.use('web').user as any)?.id ?? null,
              entityType: 'post',
              entityId: id,
            })
          } catch { }
          // Clear review draft
          await Post.query().where('id', id).update({ review_draft: null } as any)
          return response.ok({ message: 'Review approved' })
        } catch (e: any) {
          return response.badRequest({ error: e?.message || 'Failed to approve review' })
        }
      }
      // Authorization: translators cannot set status to non-draft
      const role = (auth.use('web').user as any)?.role as 'admin' | 'editor' | 'translator' | undefined
      if (!authorizationService.canUpdateStatus(role, status)) {
        return response.forbidden({ error: 'Not allowed to set status' })
      }
      // Parse JSON fields when provided as strings
      let robotsJsonParsed: Record<string, any> | null | undefined
      if (robotsJson !== undefined) {
        if (typeof robotsJson === 'string' && robotsJson.trim() !== '') {
          try {
            robotsJsonParsed = JSON.parse(robotsJson)
          } catch {
            robotsJsonParsed = null
          }
        } else if (robotsJson === '') {
          robotsJsonParsed = null
        } else {
          robotsJsonParsed = robotsJson
        }
      }
      let jsonldOverridesParsed: Record<string, any> | null | undefined
      if (jsonldOverrides !== undefined) {
        if (typeof jsonldOverrides === 'string' && jsonldOverrides.trim() !== '') {
          try {
            jsonldOverridesParsed = JSON.parse(jsonldOverrides)
          } catch {
            jsonldOverridesParsed = null
          }
        } else if (jsonldOverrides === '') {
          jsonldOverridesParsed = null
        } else {
          jsonldOverridesParsed = jsonldOverrides
        }
      }

      // Enforce hierarchy if parentId is being set
      if (parentId !== undefined) {
        try {
          const current = await Post.findOrFail(id)
          const enabled = postTypeConfigService.getUiConfig(current.type).hierarchyEnabled
          if (!enabled && (parentId || parentId === '')) {
            // Disallow any parent changes when hierarchy disabled
            return response.badRequest({ error: 'Hierarchy is disabled for this post type' })
          }
        } catch {
          // ignore; fall through to update attempt
        }
      }
      // Load current values to detect changes
      const currentForDiff = await Post.findOrFail(id)
      await UpdatePost.handle({
        postId: id,
        slug,
        title,
        status,
        excerpt,
        parentId: parentId || undefined,
        orderIndex: orderIndex !== undefined ? Number(orderIndex) : undefined,
        metaTitle,
        metaDescription,
        canonicalUrl,
        robotsJson: robotsJsonParsed,
        jsonldOverrides: jsonldOverridesParsed,
      })
      // Handle schedule/publish timestamps
      try {
        const now = new Date()
        if (status === 'published') {
          await db.from('posts').where('id', id).update({ published_at: now, scheduled_at: null, updated_at: now } as any)
        } else if (status === 'scheduled') {
          let ts: Date | null = null
          if (scheduledAt) {
            const s = new Date(String(scheduledAt))
            if (!Number.isNaN(s.getTime())) ts = s
          }
          await db.from('posts').where('id', id).update({ scheduled_at: ts, updated_at: now } as any)
        } else if (status === 'draft') {
          await db.from('posts').where('id', id).update({ scheduled_at: null, updated_at: now } as any)
        }
      } catch { }
      // Upsert custom fields (approved save only) by field_slug and track only changed slugs
      const customFieldSlugsChanged: string[] = []
      if (Array.isArray(customFields)) {
        const slugs = (customFields as Array<{ slug?: string }>).map((cf) => String((cf as any).slug || '').trim()).filter(Boolean)
        let existingMap = new Map<string, any>()
        if (slugs.length > 0) {
          const rows = await db.from('post_custom_field_values').where({ post_id: id }).whereIn('field_slug', slugs)
          existingMap = new Map<string, any>(rows.map((r: any) => [String(r.field_slug), r.value]))
        }
        const toComparable = (v: any) => {
          if (typeof v === 'string') {
            try { return JSON.parse(v) } catch { return v }
          }
          return v
        }
        for (const cf of customFields as Array<{ slug?: string; value: any }>) {
          if (!cf) continue
          const fieldSlug = String((cf as any).slug || '').trim()
          if (!fieldSlug) continue
          const now = new Date()
          const valueRaw = (cf as any).value === undefined ? null : (cf as any).value
          const value = this.normalizeJsonb(valueRaw)
          const prev = existingMap.get(fieldSlug)
          const changed = JSON.stringify(toComparable(value)) !== JSON.stringify(toComparable(prev))
          if (changed) {
            customFieldSlugsChanged.push(fieldSlug)
            const updated = await db.from('post_custom_field_values').where({ post_id: id, field_slug: fieldSlug }).update({ value, updated_at: now } as any)
            if (!updated) {
              await db.table('post_custom_field_values').insert({
                id: (await import('node:crypto')).randomUUID(),
                post_id: id,
                field_slug: fieldSlug,
                value,
                created_at: now,
                updated_at: now,
              })
            }
          }
        }
      }
      // Record an approved revision snapshot (post-live)
      await RevisionService.record({
        postId: id,
        mode: 'approved',
        snapshot: {
          slug,
          title,
          status,
          excerpt,
          metaTitle,
          metaDescription,
          canonicalUrl,
          robotsJson: robotsJsonParsed,
          jsonldOverrides: jsonldOverridesParsed,
          customFields: Array.isArray(customFields) ? customFields : undefined,
        },
        userId: (auth.use('web').user as any)?.id,
      })

      // Activity log (approved update)
      try {
        const changed: string[] = []
        if (slug !== undefined && slug !== currentForDiff.slug) changed.push('slug')
        if (title !== undefined && title !== currentForDiff.title) changed.push('title')
        if (status !== undefined && status !== currentForDiff.status) changed.push('status')
        if (excerpt !== undefined && excerpt !== (currentForDiff as any).excerpt) changed.push('excerpt')
        if (parentId !== undefined && (parentId || null) !== ((currentForDiff as any).parentId || null)) changed.push('parentId')
        if (orderIndex !== undefined && Number(orderIndex) !== (((currentForDiff as any).orderIndex ?? 0))) changed.push('orderIndex')
        if (metaTitle !== undefined && metaTitle !== currentForDiff.metaTitle) changed.push('metaTitle')
        if (metaDescription !== undefined && metaDescription !== currentForDiff.metaDescription) changed.push('metaDescription')
        if (canonicalUrl !== undefined && canonicalUrl !== currentForDiff.canonicalUrl) changed.push('canonicalUrl')
        const stringify = (v: any) => v === undefined ? '∅' : JSON.stringify(v)
        if (robotsJson !== undefined && stringify(robotsJsonParsed) !== stringify((currentForDiff as any).robotsJson)) changed.push('robotsJson')
        if (jsonldOverrides !== undefined && stringify(jsonldOverridesParsed) !== stringify((currentForDiff as any).jsonldOverrides)) changed.push('jsonldOverrides')
        await (await import('#services/activity_log_service')).default.log({
          action: 'post.update',
          userId: (auth.use('web').user as any)?.id ?? null,
          entityType: 'post',
          entityId: id,
          metadata: {
            changed,
            customFieldSlugs: customFieldSlugsChanged.length ? customFieldSlugsChanged : undefined,
          },
        })
      } catch { }
      // For Inertia requests, redirect back to editor
      // Toast notification is handled client-side
      return response.redirect().back()
    } catch (error) {
      if (error instanceof UpdatePostException) {
        // Return error for Inertia to handle
        return response.redirect().back()
      }
      throw error
    }
  }

  /**
   * POST /api/review/posts/:id/save
   *
   * Save review-stage changes to a post and its modules.
   * Body:
   * {
   *   post?: { slug?, title?, excerpt?, parentId?, metaTitle?, metaDescription?, canonicalUrl?, robotsJson?, jsonldOverrides? },
   *   moduleOps?: {
   *     add?: Array<{ type: string; scope?: 'local'|'global'|'static'; props?: any; globalSlug?: string|null }>,
   *     update?: Array<{ postModuleId: string; overrides?: any }>,
   *     remove?: string[],
   *     reorder?: Array<{ postModuleId: string; orderIndex: number }>
   *   }
   * }
   */
  async reviewSave({ params, request, response, auth }: HttpContext) {
    const { id } = params
    const moduleOps = request.input('moduleOps') || {}
    try {
      // 1) Save review-draft post fields
      await this.update({
        ...({} as any),
        params: { id },
        request: {
          ...request,
          only: (..._keys: any[]) => ({} as any),
          input: (key: string, _def?: any) => {
            if (key === 'mode') return 'review'
            return undefined
          },
        } as any,
        response,
        auth,
      } as any)
      // update() returns response; we proceed to module ops regardless
      // 2) Module removals (stage)
      const toRemove: string[] = Array.isArray(moduleOps.remove) ? moduleOps.remove : []
      if (toRemove.length > 0) {
        await db.from('post_modules').whereIn('id', toRemove).update({ review_deleted: true, updated_at: new Date() } as any)
      }
      // 3) Module updates (review overrides/props)
      const updates: Array<{ postModuleId: string; overrides?: any }> = Array.isArray(moduleOps.update) ? moduleOps.update : []
      for (const u of updates) {
        if (!u?.postModuleId) continue
        await UpdatePostModule.handle({
          postModuleId: u.postModuleId,
          overrides: u.overrides ?? null,
          mode: 'review',
        })
      }
      // 4) Module adds (stage as review_added)
      const adds: Array<{ type: string; scope?: 'local' | 'global' | 'static'; props?: any; globalSlug?: string | null }> =
        Array.isArray(moduleOps.add) ? moduleOps.add : []
      for (const a of adds) {
        if (!a?.type) continue
        await AddModuleToPost.handle({
          postId: id,
          moduleType: a.type,
          scope: (a.scope as any) || 'local',
          props: a.props || {},
          globalSlug: a.globalSlug ?? null,
          orderIndex: undefined,
          locked: false,
          mode: 'review',
        })
      }
      // 5) Reorder (ignored in review for now)
      return response.ok({ message: 'Saved review changes' })
    } catch (e: any) {
      return response.badRequest({ error: e?.message || 'Failed to save review' })
    }
  }

  /**
   * POST /api/review/posts/:id/approve
   *
   * Promote review changes to approved/live. Clears review fields/flags.
   */
  async reviewApprove({ params, response, auth }: HttpContext) {
    const { id } = params
    try {
      const current = await Post.findOrFail(id)
      const rd: any = (current as any).reviewDraft || (current as any).review_draft
      if (!rd) {
        return response.badRequest({ error: 'No review draft to approve' })
      }
      const nextSlug = rd.slug ?? current.slug
      const nextTitle = rd.title ?? current.title
      const nextExcerpt = rd.excerpt ?? current.excerpt
      const nextParentId = rd.parentId ?? (current as any).parentId ?? null
      const nextMetaTitle = rd.metaTitle ?? current.metaTitle
      const nextMetaDescription = rd.metaDescription ?? current.metaDescription
      const nextCanonicalUrl = rd.canonicalUrl ?? current.canonicalUrl
      const nextRobots = typeof rd.robotsJson === 'string' ? (() => { try { return JSON.parse(rd.robotsJson) } catch { return null } })() : rd.robotsJson ?? current.robotsJson
      const nextJsonLd = typeof rd.jsonldOverrides === 'string' ? (() => { try { return JSON.parse(rd.jsonldOverrides) } catch { return null } })() : rd.jsonldOverrides ?? current.jsonldOverrides

      await UpdatePost.handle({
        postId: id,
        slug: nextSlug,
        title: nextTitle,
        status: current.status,
        excerpt: nextExcerpt,
        parentId: nextParentId || undefined,
        metaTitle: nextMetaTitle,
        metaDescription: nextMetaDescription,
        canonicalUrl: nextCanonicalUrl,
        robotsJson: nextRobots,
        jsonldOverrides: nextJsonLd,
      })
      // Promote review module changes to approved
      await db
        .from('module_instances')
        .where('scope', 'post')
        .andWhereIn('id', db.from('post_modules').where('post_id', id).select('module_id'))
        .update({
          props: db.raw('COALESCE(review_props, props)'),
          review_props: null,
          updated_at: new Date(),
        } as any)
      await db
        .from('post_modules')
        .where('post_id', id)
        .update({
          overrides: db.raw('COALESCE(review_overrides, overrides)'),
          review_overrides: null,
          updated_at: new Date(),
        } as any)
      await db.from('post_modules').where('post_id', id).andWhere('review_deleted', true).delete()
      await db.from('post_modules').where('post_id', id).andWhere('review_added', true).update({ review_added: false, updated_at: new Date() } as any)
      await Post.query().where('id', id).update({ review_draft: null } as any)

      await RevisionService.record({
        postId: id,
        mode: 'approved',
        snapshot: {
          slug: nextSlug,
          title: nextTitle,
          status: current.status,
          excerpt: nextExcerpt,
          metaTitle: nextMetaTitle,
          metaDescription: nextMetaDescription,
          canonicalUrl: nextCanonicalUrl,
          robotsJson: nextRobots,
          jsonldOverrides: nextJsonLd,
        },
        userId: (auth.use('web').user as any)?.id,
      })
      return response.ok({ message: 'Review approved' })
    } catch (e: any) {
      return response.badRequest({ error: e?.message || 'Failed to approve review' })
    }
  }

  /**
   * DELETE /api/posts/:id
   * Delete a single post (allowed only when archived)
   */
  async destroy({ params, response }: HttpContext) {
    const { id } = params
    const post = await Post.find(id)
    if (!post) {
      return response.notFound({ error: 'Post not found' })
    }
    if (post.status !== 'archived') {
      return response.badRequest({ error: 'Only archived posts can be deleted' })
    }
    await post.delete()
    try {
      await (await import('#services/activity_log_service')).default.log({
        action: 'post.delete',
        entityType: 'post',
        entityId: id,
        metadata: { type: post.type, slug: post.slug, locale: post.locale },
      })
    } catch { }
    return response.noContent()
  }

  /**
   * POST /api/posts/bulk
   * Perform bulk actions on posts
   * Body: { action: 'publish'|'draft'|'archive'|'delete', ids: string[] }
   */
  async bulk({ request, response, auth }: HttpContext) {
    const { action, ids } = request.only(['action', 'ids'])
    if (!Array.isArray(ids) || ids.length === 0) {
      return response.badRequest({ error: 'ids must be a non-empty array' })
    }
    const role = (auth.use('web').user as any)?.role as 'admin' | 'editor' | 'translator' | undefined
    try {
      const result = await BulkPostsAction.handle({
        action: action as any,
        ids,
        role,
      })
      try {
        await (await import('#services/activity_log_service')).default.log({
          action: `post.bulk.${String(action)}`,
          userId: (auth.use('web').user as any)?.id ?? null,
          entityType: 'post',
          entityId: 'bulk',
          metadata: { count: ids.length },
        })
      } catch { }
      return response.ok(result)
    } catch (e: any) {
      const status = e?.statusCode || 400
      if (e?.meta) {
        return response.status(status).json({ error: e.message, ...e.meta })
      }
      return response.status(status).json({ error: e?.message || 'Bulk action failed' })
    }
  }

  /**
   * POST /api/posts/reorder
   * Bulk update order_index for posts within a strict scope.
   * Body: {
   *   scope: { type: string; locale: string; parentId: string | null },
   *   items: Array<{ id: string; orderIndex: number; parentId?: string | null }>
   * }
   */
  async reorder({ request, response, auth }: HttpContext) {
    const role = (auth.use('web').user as any)?.role as 'admin' | 'editor' | 'translator' | undefined
    // Only admin/editor can reorder posts
    if (!(role === 'admin' || role === 'editor')) {
      return response.forbidden({ error: 'Not allowed to reorder posts' })
    }
    const scopeRaw = request.input('scope')
    const scopeType = String(scopeRaw?.type || '').trim()
    const scopeLocale = String(scopeRaw?.locale || '').trim()
    const scopeParentIdRaw = (scopeRaw as any)?.parentId
    const scopeParentId =
      scopeRaw && (scopeRaw as any).hasOwnProperty('parentId')
        ? (scopeParentIdRaw === null || scopeParentIdRaw === '' ? null : String(scopeParentIdRaw).trim())
        : null
    if (!scopeType || !scopeLocale) {
      return response.badRequest({ error: 'scope.type and scope.locale are required' })
    }
    const items: Array<{ id: string; orderIndex: number; parentId?: string | null }> =
      Array.isArray(request.input('items')) ? request.input('items') : []
    if (!Array.isArray(items) || items.length === 0) {
      return response.badRequest({ error: 'items must be a non-empty array' })
    }
    // Validate payload
    const sanitized: Array<{ id: string; orderIndex: number; parentId?: string | null }> = []
    for (const it of items) {
      const id = String((it as any)?.id || '').trim()
      const oiRaw = (it as any)?.orderIndex
      const orderIndex = Number(oiRaw)
      const parentIdRaw = (it as any)?.parentId
      const hasParent = (it as any)?.hasOwnProperty('parentId')
      const parentId =
        hasParent
          ? (parentIdRaw === null || parentIdRaw === '' ? null : String(parentIdRaw).trim())
          : undefined
      if (!id || Number.isNaN(orderIndex)) {
        return response.badRequest({ error: 'Each item must include valid id and orderIndex' })
      }
      if (parentId !== undefined && parentId === id) {
        return response.badRequest({ error: 'Cannot set a post as its own parent' })
      }
      sanitized.push({ id, orderIndex, parentId })
    }
    try {
      const now = new Date()
      await db.transaction(async (trx) => {
        // Preload rows once for validation
        const ids = sanitized.map((s) => s.id)
        const rows = await trx.from('posts').whereIn('id', ids)
        const idToRow = new Map<string, any>()
        for (const r of rows) idToRow.set(String((r as any).id), r)
        // Validate scope for each item
        for (const it of sanitized) {
          const row = idToRow.get(it.id)
          if (!row) {
            throw new Error(`Post not found: ${it.id}`)
          }
          if (String((row as any).type) !== scopeType || String((row as any).locale) !== scopeLocale) {
            throw new Error('Reorder items must match scope type/locale')
          }
          // Determine effective parent after this change
          const currentParent: string | null = (row as any).parent_id ?? null
          const effectiveParent =
            (it as any).hasOwnProperty('parentId')
              ? (it.parentId === undefined ? currentParent : (it.parentId ?? null))
              : currentParent
          if ((effectiveParent ?? null) !== (scopeParentId ?? null)) {
            throw new Error('Reorder items must be in the same parent group as scope')
          }
          // If parent change requested, ensure hierarchy enabled
          if ((it as any).hasOwnProperty('parentId')) {
            const enabled = postTypeConfigService.getUiConfig(String((row as any).type)).hierarchyEnabled
            if (!enabled) {
              throw new Error('Hierarchy is disabled for this post type')
            }
          }
        }
        for (const it of sanitized) {
          const update: any = { order_index: it.orderIndex, updated_at: now }
          if ((it as any).hasOwnProperty('parentId')) {
            update.parent_id = it.parentId === undefined ? undefined : it.parentId
          }
          await trx.from('posts').where('id', it.id).update(update)
        }
      })
      try {
        await (await import('#services/activity_log_service')).default.log({
          action: 'post.reorder',
          userId: (auth.use('web').user as any)?.id ?? null,
          entityType: 'post',
          entityId: 'bulk',
          metadata: { count: sanitized.length },
        })
      } catch { }
      return response.ok({ updated: sanitized.length })
    } catch (e: any) {
      return response.badRequest({ error: e?.message || 'Failed to reorder posts' })
    }
  }

  /**
   * GET /api/posts/:slug
   *
   * Get a post by slug with rendered modules.
   */
  async show({ params, request, response, inertia }: HttpContext) {
    const { slug } = params
    const locale = request.input('locale', 'en')
    const viewParam = String(request.input('view', '')).toLowerCase()
    // Only allow review preview when authenticated (middleware shares auth globally; here we check header)
    const wantReview = viewParam === 'review' && Boolean(request.header('cookie')) // coarse check; real check happens when selecting fields

    try {
      // Find post by slug and locale
      const post = await Post.query().where('slug', slug).where('locale', locale).first()

      if (!post) {
        return response.notFound({
          error: 'Post not found',
          slug,
          locale,
        })
      }
      // Block public rendering if permalinks are disabled for this post type
      try {
        const uiConfig = postTypeConfigService.getUiConfig(post.type)
        if (uiConfig.permalinksEnabled === false) {
          return response.notFound({ error: 'Permalinks disabled for this post type' })
        }
      } catch { /* ignore and proceed */ }

      // Fetch modules with potential review fields
      const modulesRows = await db
        .from('post_modules')
        .join('module_instances', 'post_modules.module_id', 'module_instances.id')
        .where('post_modules.post_id', post.id)
        .select(
          'post_modules.id as postModuleId',
          'module_instances.type',
          'module_instances.scope',
          'module_instances.props',
          'module_instances.review_props',
          'post_modules.overrides',
          'post_modules.review_overrides',
          'post_modules.order_index as orderIndex',
          'module_instances.global_slug as globalSlug',
          'module_instances.global_label as globalLabel'
        )
        .orderBy('post_modules.order_index', 'asc')

      // Load translations for hreflang/alternate
      const baseId = post.translationOfId || post.id
      const family = await Post.query().where((q) => {
        q.where('translationOfId', baseId).orWhere('id', baseId)
      })
      const protocol = (request as any).protocol ? (request as any).protocol() : ((request as any).secure ? (request as any).secure() ? 'https' : 'http' : 'http')
      const host = (request as any).host ? (request as any).host() : request.header('host')
      const alternates = family.map((p) => ({
        locale: p.locale,
        href: '',
      }))
      // Build URLs (async)
      const alternatesBuilt = await Promise.all(
        alternates.map(async (_a, idx) => ({
          locale: family[idx].locale,
          href: await urlPatternService.buildPostUrlForPost(family[idx].id, protocol, host),
        }))
      )
      const canonical = await urlPatternService.buildPostUrlForPost(post.id, protocol, host)
      // Robots: noindex,nofollow for non-published, else index,follow
      const robotsContent = post.status === 'published' ? 'index,follow' : 'noindex,nofollow'
      // Merge default JSON-LD with post-level overrides (if any)
      const defaultJsonLd: Record<string, any> = {
        '@context': 'https://schema.org',
        '@type': 'BlogPosting',
        headline: post.metaTitle || post.title,
        inLanguage: post.locale,
        mainEntityOfPage: canonical,
        description: post.metaDescription || undefined,
      }
      const jsonLd = { ...defaultJsonLd, ...(post.jsonldOverrides || {}) }

      // (modulesRows already loaded above for computing rendered modules)

      // Exclude modules marked for removal in review view
      const reviewDraft: any = (post as any).reviewDraft || (post as any).review_draft || null
      const removedInReview: Set<string> =
        wantReview && reviewDraft && Array.isArray(reviewDraft.removedModuleIds)
          ? new Set(reviewDraft.removedModuleIds)
          : new Set()

      const modules = modulesRows
        .filter((pm: any) => !removedInReview.has(pm.postModuleId))
        .filter((pm: any) => !(wantReview && pm.reviewDeleted === true))
        .filter((pm: any) => (wantReview ? true : pm.reviewAdded !== true))
        .map((pm: any) => {
          const isLocal = pm.scope === 'post'
          const useReview = wantReview && ((post as any).reviewDraft || (post as any).review_draft)
          if (useReview) {
            if (isLocal) {
              const baseProps = pm.review_props || pm.props || {}
              const overrides = pm.overrides || {}
              return { id: pm.postModuleId, type: pm.type, props: { ...baseProps, ...overrides } }
            } else {
              const baseProps = pm.props || {}
              const overrides = pm.review_overrides || pm.overrides || {}
              return { id: pm.postModuleId, type: pm.type, props: { ...baseProps, ...overrides } }
            }
          } else {
            const baseProps = pm.props || {}
            const overrides = pm.overrides || {}
            return { id: pm.postModuleId, type: pm.type, props: { ...baseProps, ...overrides } }
          }
        })

      // Return as Inertia page for public viewing
      const useReviewPost = wantReview && reviewDraft
      const siteSettings = await siteSettingsService.get()
      // Load author
      let author: { id: number; email: string; fullName: string | null } | null = null
      try {
        const arow = await db.from('users').where('id', (post as any).authorId || (post as any).author_id).first()
        if (arow) {
          author = { id: Number((arow as any).id), email: (arow as any).email, fullName: (arow as any).full_name ?? null }
        }
      } catch { /* ignore */ }
      return inertia.render('site/post', {
        post: {
          id: post.id,
          type: post.type,
          locale: post.locale,
          slug: useReviewPost ? (reviewDraft.slug ?? post.slug) : post.slug,
          title: useReviewPost ? (reviewDraft.title ?? post.title) : post.title,
          excerpt: useReviewPost ? (reviewDraft.excerpt ?? post.excerpt) : post.excerpt,
          metaTitle: useReviewPost ? (reviewDraft.metaTitle ?? post.metaTitle) : post.metaTitle,
          metaDescription: useReviewPost ? (reviewDraft.metaDescription ?? post.metaDescription) : post.metaDescription,
          status: post.status,
          author,
        },
        hasReviewDraft: Boolean(reviewDraft),
        siteSettings,
        seo: {
          canonical,
          alternates: alternatesBuilt,
          robots: robotsContent,
          jsonLd,
          og: {
            title: post.metaTitle || post.title,
            description: post.metaDescription || undefined,
            url: canonical,
            type: 'article',
          },
          twitter: {
            card: 'summary_large_image',
            title: post.metaTitle || post.title,
            description: post.metaDescription || undefined,
          },
        },
        modules,
      })
    } catch (error) {
      return response.internalServerError({
        error: 'Failed to load post',
        message: error.message,
      })
    }
  }

  /**
   * DELETE /api/post-modules/:id
   *
   * Remove a module from a post.
   */
  async deleteModule({ params, response }: HttpContext) {
    const { id } = params
    const row = await db.from('post_modules').where('id', id).first()
    if (!row) {
      return response.notFound({ error: 'Post module not found' })
    }
    await db.from('post_modules').where('id', id).delete()
    return response.noContent()
  }

  /**
   * GET /api/posts/:id/export
   * Export canonical JSON for a post (auth required)
   */
  async exportJson({ params, response, auth, request }: HttpContext) {
    const { id } = params
    if (!auth.use('web').isAuthenticated) return response.unauthorized({ error: 'Auth required' })
    try {
      const data = await PostSerializerService.serialize(id)
      const asDownload = String(request.input('download', '1')) !== '0'
      response.header('Content-Type', 'application/json; charset=utf-8')
      if (asDownload) {
        response.header('Content-Disposition', `attachment; filename="post-${id}.json"`)
      }
      return response.ok(data)
    } catch (e: any) {
      return response.badRequest({ error: e?.message || 'Failed to export' })
    }
  }

  /**
   * POST /api/posts/import
   * Create a new post from canonical JSON (admin/editor)
   * Body: { data: CanonicalPost }
   */
  async importCreate({ request, response, auth }: HttpContext) {
    const role = (auth.use('web').user as any)?.role as 'admin' | 'editor' | 'translator' | undefined
    if (!authorizationService.canCreatePost(role)) {
      return response.forbidden({ error: 'Not allowed to import' })
    }
    const { data } = request.only(['data'])
    if (!data) return response.badRequest({ error: 'Missing data' })
    try {
      const post = await PostSerializerService.importCreate(data, (auth.use('web').user as any)?.id)
      return response.created({ id: post.id })
    } catch (e: any) {
      return response.badRequest({ error: e?.message || 'Failed to import' })
    }
  }

  /**
   * POST /api/posts/:id/import
   * Import canonical JSON into an existing post.
   * Body: { data: CanonicalPost, mode?: 'replace' | 'review' }
   */
  async importInto({ params, request, response, auth }: HttpContext) {
    const { id } = params
    const { data, mode } = request.only(['data', 'mode'])
    if (!data) return response.badRequest({ error: 'Missing data' })
    const importMode = String(mode || 'replace').toLowerCase()
    try {
      if (importMode === 'review') {
        // Only set top-level review draft; modules left unchanged in review mode
        await Post.query().where('id', id).update({ review_draft: data.post } as any)
        await RevisionService.record({
          postId: id,
          mode: 'review',
          snapshot: data.post,
          userId: (auth.use('web').user as any)?.id,
        })
        return response.ok({ message: 'Imported into review draft' })
      }
      // replace live content, enforce status permission
      const role = (auth.use('web').user as any)?.role as 'admin' | 'editor' | 'translator' | undefined
      if (!authorizationService.canUpdateStatus(role, data?.post?.status)) {
        return response.forbidden({ error: 'Not allowed to set target status' })
      }
      await PostSerializerService.importReplace(id, data)
      await RevisionService.record({
        postId: id,
        mode: 'approved',
        snapshot: data.post,
        userId: (auth.use('web').user as any)?.id,
      })
      return response.ok({ message: 'Imported and replaced live content' })
    } catch (e: any) {
      return response.badRequest({ error: e?.message || 'Failed to import' })
    }
  }

  /**
   * GET /api/posts/:id/revisions
   * List recent revisions for a post (auth required)
   */
  async revisions({ params, response, request }: HttpContext) {
    const { id } = params
    // Everyone authenticated can view revisions; reverting is restricted separately
    const limit = Math.min(50, Math.max(1, Number(request.input('limit', 20)) || 20))
    const rows = await db
      .from('post_revisions')
      .leftJoin('users', 'post_revisions.user_id', 'users.id')
      .where('post_revisions.post_id', id)
      .orderBy('post_revisions.created_at', 'desc')
      .limit(limit)
      .select(
        'post_revisions.id',
        'post_revisions.mode',
        'post_revisions.created_at as createdAt',
        'post_revisions.user_id as userId',
        'users.email as userEmail'
      )
    return response.ok({
      data: rows.map((r: any) => ({
        id: r.id,
        mode: r.mode,
        createdAt: r.createdat || r.createdAt,
        user: r.useremail ? { email: r.useremail, id: r.userid } : null,
      })),
    })
  }

  /**
   * POST /api/posts/:id/revisions/:revId/revert
   * Revert a post to a given revision (admin/editor for approved; review revisions write to review_draft)
   */
  async revertRevision({ params, response, auth }: HttpContext) {
    const { id, revId } = params
    const role = (auth.use('web').user as any)?.role as 'admin' | 'editor' | 'translator' | undefined

    const rev = await db.from('post_revisions').where('id', revId).andWhere('post_id', id).first()
    if (!rev) {
      return response.notFound({ error: 'Revision not found' })
    }
    const snapshot = (rev as any).snapshot || {}
    const mode: 'approved' | 'review' = (rev as any).mode || 'approved'

    if (mode === 'review') {
      await Post.query().where('id', id).update({ review_draft: snapshot } as any)
      return response.ok({ message: 'Reverted review draft' })
    }

    // Approved (live) revert requires permission to set target status
    if (!authorizationService.canRevertRevision(role) || !authorizationService.canUpdateStatus(role, snapshot?.status)) {
      return response.forbidden({ error: 'Not allowed to revert to this revision' })
    }

    await UpdatePost.handle({
      postId: id,
      slug: snapshot?.slug,
      title: snapshot?.title,
      status: snapshot?.status,
      excerpt: snapshot?.excerpt ?? null,
      metaTitle: snapshot?.metaTitle ?? null,
      metaDescription: snapshot?.metaDescription ?? null,
      canonicalUrl: snapshot?.canonicalUrl ?? null,
      robotsJson: snapshot?.robotsJson ?? null,
      jsonldOverrides: snapshot?.jsonldOverrides ?? null,
    })
    return response.ok({ message: 'Reverted to revision' })
  }

  /**
   * Resolve public post by matching URL patterns (catch-all route).
   */
  async resolve({ request, response, inertia }: HttpContext) {
    const path = request.url().split('?')[0]
    const match = await urlPatternService.matchPath(path)
    if (!match) {
      return response.notFound({ error: 'Not found' })
    }
    const { slug, locale } = match
    // Early: prevent resolving if post type has permalinks disabled
    if (match.postType) {
      try {
        const uiConfig = postTypeConfigService.getUiConfig(match.postType)
        if (uiConfig.permalinksEnabled === false) {
          return response.notFound({ error: 'Permalinks disabled for this post type' })
        }
      } catch { /* continue */ }
    }
    const viewParam = String(request.input('view', '')).toLowerCase()
    const wantReview = viewParam === 'review' && Boolean(request.header('cookie'))
    try {
      const post = await Post.query().where('slug', slug).where('locale', locale).first()
      if (!post) {
        return response.notFound({ error: 'Post not found', slug, locale })
      }
      const postModules = await db
        .from('post_modules')
        .join('module_instances', 'post_modules.module_id', 'module_instances.id')
        .where('post_modules.post_id', post.id)
        .select(
          'post_modules.id as postModuleId',
          'post_modules.review_added as reviewAdded',
          'post_modules.review_deleted as reviewDeleted',
          'module_instances.type',
          'module_instances.scope',
          'module_instances.props',
          'module_instances.review_props',
          'post_modules.overrides',
          'post_modules.review_overrides',
          'post_modules.locked',
          'post_modules.order_index as orderIndex'
        )
        .orderBy('post_modules.order_index', 'asc')
      const modules = postModules
        .filter((pm: any) => (wantReview ? true : pm.reviewAdded !== true))
        .filter((pm: any) => !(wantReview && pm.reviewDeleted === true))
        .map((pm: any) => {
          const isLocal = pm.scope === 'post'
          const reviewDraft: any = (post as any).reviewDraft || (post as any).review_draft
          const useReview = wantReview && reviewDraft
          if (useReview) {
            if (isLocal) {
              const baseProps = pm.review_props || pm.props || {}
              const overrides = pm.overrides || {}
              return { id: pm.postModuleId, type: pm.type, props: { ...baseProps, ...overrides } }
            } else {
              const baseProps = pm.props || {}
              const overrides = pm.review_overrides || pm.overrides || {}
              return { id: pm.postModuleId, type: pm.type, props: { ...baseProps, ...overrides } }
            }
          }
          return {
            id: pm.postModuleId,
            type: pm.type,
            props: { ...(pm.props || {}), ...(pm.overrides || {}) },
          }
        })
      const protocol = (request as any).protocol ? (request as any).protocol() : ((request as any).secure ? (request as any).secure() ? 'https' : 'http' : 'http')
      const host = (request as any).host ? (request as any).host() : request.header('host')
      const reviewDraft: any = (post as any).reviewDraft || (post as any).review_draft || null
      const useReviewPost = wantReview && reviewDraft
      const canonical = await urlPatternService.buildPostUrlForPost(post.id, protocol, host)
      const baseId = post.translationOfId || post.id
      const family = await Post.query().where((q) => {
        q.where('translationOfId', baseId).orWhere('id', baseId)
      })
      const alternates = await Promise.all(family.map((p) => urlPatternService.buildPostUrlForPost(p.id, protocol, host)))
      const siteSettings = await siteSettingsService.get()
      // Load author
      let author: { id: number; email: string; fullName: string | null } | null = null
      try {
        const arow = await db.from('users').where('id', (post as any).authorId || (post as any).author_id).first()
        if (arow) {
          author = { id: Number((arow as any).id), email: (arow as any).email, fullName: (arow as any).full_name ?? null }
        }
      } catch { /* ignore */ }
      return inertia.render('site/post', {
        post: {
          id: post.id,
          type: post.type,
          locale: post.locale,
          slug: useReviewPost ? (reviewDraft.slug ?? post.slug) : post.slug,
          title: useReviewPost ? (reviewDraft.title ?? post.title) : post.title,
          excerpt: useReviewPost ? (reviewDraft.excerpt ?? post.excerpt) : post.excerpt,
          metaTitle: useReviewPost ? (reviewDraft.metaTitle ?? post.metaTitle) : post.metaTitle,
          metaDescription: useReviewPost ? (reviewDraft.metaDescription ?? post.metaDescription) : post.metaDescription,
          status: post.status,
          author,
        },
        hasReviewDraft: Boolean(reviewDraft),
        siteSettings,
        modules,
        seo: {
          canonical,
          alternates: family.map((p, i) => ({ locale: p.locale, href: alternates[i] })),
          robots: post.status === 'published' ? 'index,follow' : 'noindex,nofollow',
        },
      })
    } catch (error) {
      return response.internalServerError({ error: 'Failed to resolve post', message: error.message })
    }
  }

  /**
   * POST /api/posts/:id/modules
   *
   * Add a module to a post.
   */
  async storeModule({ params, request, response }: HttpContext) {
    const { id } = params
    const { moduleType, scope, props, globalSlug, orderIndex, locked, mode } = request.only([
      'moduleType',
      'scope',
      'props',
      'globalSlug',
      'orderIndex',
      'locked',
      'mode',
    ])

    try {
      const result = await AddModuleToPost.handle({
        postId: id,
        moduleType,
        scope,
        props,
        globalSlug,
        orderIndex,
        locked,
        mode: mode === 'review' ? 'review' : 'publish',
      })

      // If this is an Inertia request, redirect back to the editor
      if (request.header('x-inertia')) {
        // Optional: flash success (editor toasts can read shared flash)
        // request.session.flash({ success: 'Module added to post successfully' })
        return response.redirect().back()
      }

      // Fallback for non-Inertia/API clients
      return response.created({
        data: {
          postModuleId: result.postModule.id,
          moduleInstanceId: result.moduleInstanceId,
          orderIndex: result.postModule.order_index,
        },
        message: 'Module added to post successfully',
      })
    } catch (error) {
      if (error instanceof AddModuleToPostException) {
        // For Inertia requests, redirect back (optionally with flash)
        if (request.header('x-inertia')) {
          // request.session.flash({ error: error.message })
          return response.redirect().back()
        }
        // For API clients, return JSON error
        return response.status(error.statusCode).json({
          error: error.message,
          ...error.meta,
        })
      }
      throw error
    }
  }

  /**
   * PUT /api/post-modules/:id
   *
   * Update a post module (reorder, update overrides, lock/unlock).
   */
  async updateModule({ params, request, response }: HttpContext) {
    const { id } = params
    const { orderIndex, overrides, locked, mode } = request.only(['orderIndex', 'overrides', 'locked', 'mode'])

    try {
      const updated = await UpdatePostModule.handle({
        postModuleId: id,
        orderIndex,
        overrides,
        locked,
        mode: mode === 'review' ? 'review' : 'publish',
      })

      return response.ok({
        data: {
          id: updated.id,
          orderIndex: updated.order_index,
          overrides: (mode === 'review' ? (updated as any).review_overrides : updated.overrides),
          reviewOverrides: (updated as any).review_overrides ?? null,
          locked: updated.locked,
          updatedAt: updated.updated_at,
        },
        message: 'Post module updated successfully',
      })
    } catch (error) {
      if (error instanceof UpdatePostModuleException) {
        return response.status(error.statusCode).json({
          error: error.message,
          ...error.meta,
        })
      }
      throw error
    }
  }
}
