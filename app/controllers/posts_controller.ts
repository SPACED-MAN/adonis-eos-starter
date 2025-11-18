import type { HttpContext } from '@adonisjs/core/http'
import Post from '#models/post'
import CreatePost, { CreatePostException } from '#actions/posts/create_post'
import UpdatePost, { UpdatePostException } from '#actions/posts/update_post'
import AddModuleToPost, { AddModuleToPostException } from '#actions/posts/add_module_to_post'
import UpdatePostModule, { UpdatePostModuleException } from '#actions/posts/update_post_module'
import db from '@adonisjs/lucid/services/db'
import urlPatternService from '#services/url_pattern_service'

/**
 * Posts Controller
 *
 * Handles CRUD operations for posts and their modules.
 */
export default class PostsController {
  /**
   * GET /api/posts
   * List posts with optional search, filters, sorting, and pagination
   * Query: q, status, locale, sortBy, sortOrder, page, limit
   */
  async index({ request, response }: HttpContext) {
    const q = String(request.input('q', '')).trim()
    const status = String(request.input('status', '')).trim()
    const locale = String(request.input('locale', '')).trim()
    const sortByRaw = String(request.input('sortBy', 'updated_at')).trim()
    const sortOrderRaw = String(request.input('sortOrder', 'desc')).trim()
    const page = Math.max(1, Number(request.input('page', 1)) || 1)
    const limit = Math.min(100, Math.max(1, Number(request.input('limit', 20)) || 20))

    const allowedSort = new Set(['title', 'slug', 'status', 'locale', 'updated_at', 'created_at'])
    const sortBy = allowedSort.has(sortByRaw) ? sortByRaw : 'updated_at'
    const sortOrder = sortOrderRaw.toLowerCase() === 'asc' ? 'asc' : 'desc'

    const query = Post.query()
    if (q) {
      query.where((builder) => {
        builder.whereILike('title', `%${q}%`).orWhereILike('slug', `%${q}%`)
      })
    }
    if (status) {
      query.where('status', status)
    }
    if (locale) {
      query.where('locale', locale)
    }
    const countQuery = db.from('posts')
    if (q) {
      countQuery.where((b) => b.whereILike('title', `%${q}%`).orWhereILike('slug', `%${q}%`))
    }
    if (status) {
      countQuery.where('status', status)
    }
    if (locale) {
      countQuery.where('locale', locale)
    }
    const countRows = await countQuery.count('* as total')
    const total = Number((countRows?.[0] as any)?.total || 0)
    const rows = await query.orderBy(sortBy, sortOrder).forPage(page, limit)
    return response.ok({
      data: rows.map((p) => ({
        id: p.id,
        title: p.title,
        slug: p.slug,
        status: p.status,
        locale: p.locale,
        updatedAt: (p as any)?.updatedAt?.toISO ? (p as any).updatedAt.toISO() : (p as any).updatedAt,
      })),
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
   * GET /admin/posts/:id/edit
   *
   * Show the post editor
   */
  async edit({ params, inertia, response, request }: HttpContext) {
    try {
      const post = await Post.findOrFail(params.id)
      // Load post modules for editor
      const postModules = await db
        .from('post_modules')
        .join('module_instances', 'post_modules.module_id', 'module_instances.id')
        .where('post_modules.post_id', post.id)
        .select(
          'post_modules.id as postModuleId',
          'module_instances.type',
          'module_instances.scope',
          'module_instances.props',
          'post_modules.overrides',
          'post_modules.locked',
          'post_modules.order_index as orderIndex'
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
        post.createdAt ? new Date(post.createdAt.toISO()) : undefined
      )

      return inertia.render('admin/posts/editor', {
        post: {
          id: post.id,
          type: post.type,
          slug: post.slug,
          title: post.title,
          excerpt: post.excerpt,
          status: post.status,
          locale: post.locale,
          metaTitle: post.metaTitle,
          metaDescription: post.metaDescription,
          canonicalUrl: post.canonicalUrl,
          robotsJson: post.robotsJson,
          jsonldOverrides: post.jsonldOverrides,
          createdAt: post.createdAt.toISO(),
          updatedAt: post.updatedAt.toISO(),
          publicPath,
        },
        modules: postModules.map((pm) => ({
          id: pm.postModuleId,
          type: pm.type,
          scope: pm.scope,
          props: pm.props || {},
          overrides: pm.overrides || null,
          locked: pm.locked,
          orderIndex: pm.orderIndex,
        })),
        translations,
      })
    } catch (error) {
      return response.notFound({ error: 'Post not found' })
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
  async createTranslation({ params, request, response, auth }: HttpContext) {
    const { id } = params
    const locale = request.input('locale')
    if (!locale) {
      return response.badRequest({ error: 'locale is required' })
    }
    const source = await Post.find(id)
    if (!source) {
      return response.notFound({ error: 'Post not found' })
    }
    if (source.locale === locale) {
      return response.badRequest({ error: 'Translation locale must differ from source locale' })
    }
    // Determine family base
    const baseId = source.translationOfId || source.id
    // Check if translation exists
    const existing = await Post.query()
      .where('translationOfId', baseId)
      .where('locale', locale)
      .first()
    if (existing) {
      // For Inertia, redirect to editor
      if (request.header('x-inertia')) {
        return response.redirect().toPath(`/admin/posts/${existing.id}/edit`)
      }
      return response.conflict({ error: 'Translation already exists', id: existing.id })
    }
    // Create translation (basic fields only for now)
    const newPost = await Post.create({
      type: source.type,
      locale,
      slug: `${source.slug}-${locale}-${Date.now()}`,
      title: source.title,
      status: 'draft',
      excerpt: source.excerpt,
      metaTitle: source.metaTitle,
      metaDescription: source.metaDescription,
      canonicalUrl: source.canonicalUrl,
      robotsJson: source.robotsJson,
      jsonldOverrides: source.jsonldOverrides,
      translationOfId: baseId,
      templateId: source.templateId,
      userId: auth.user!.id,
    })
    // Redirect back to editor for the new translation
    if (request.header('x-inertia')) {
      return response.redirect().toPath(`/admin/posts/${newPost.id}/edit`)
    }
    return response.created({ id: newPost.id })
  }

  /**
   * PUT /api/posts/:id
   *
   * Update an existing post.
   */
  async update({ params, request, response }: HttpContext) {
    const { id } = params
    const {
      slug,
      title,
      status,
      excerpt,
      metaTitle,
      metaDescription,
      canonicalUrl,
      robotsJson,
      jsonldOverrides,
    } = request.only([
      'slug',
      'title',
      'status',
      'excerpt',
      'metaTitle',
      'metaDescription',
      'canonicalUrl',
      'robotsJson',
      'jsonldOverrides',
    ])

    try {
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

      await UpdatePost.handle({
        postId: id,
        slug,
        title,
        status,
        excerpt,
        metaTitle,
        metaDescription,
        canonicalUrl,
        robotsJson: robotsJsonParsed,
        jsonldOverrides: jsonldOverridesParsed,
      })

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
    return response.noContent()
  }

  /**
   * POST /api/posts/bulk
   * Perform bulk actions on posts
   * Body: { action: 'publish'|'draft'|'archive'|'delete', ids: string[] }
   */
  async bulk({ request, response }: HttpContext) {
    const { action, ids } = request.only(['action', 'ids'])
    const validActions = new Set(['publish', 'draft', 'archive', 'delete'])
    if (!validActions.has(action)) {
      return response.badRequest({ error: 'Invalid action' })
    }
    if (!Array.isArray(ids) || ids.length === 0) {
      return response.badRequest({ error: 'ids must be a non-empty array' })
    }
    // Normalize unique IDs
    const uniqueIds = Array.from(new Set(ids.map((v) => String(v))))

    if (action === 'delete') {
      // Only delete archived
      const notArchived = await Post.query().whereIn('id', uniqueIds).whereNot('status', 'archived').select('id', 'status')
      if (notArchived.length > 0) {
        return response.badRequest({
          error: 'Only archived posts can be deleted',
          notArchived: notArchived.map((p) => ({ id: p.id, status: p.status })),
        })
      }
      await Post.query().whereIn('id', uniqueIds).delete()
      return response.ok({ message: 'Deleted archived posts', count: uniqueIds.length })
    }

    let nextStatus: 'published' | 'draft' | 'archived'
    switch (action) {
      case 'publish':
        nextStatus = 'published'
        break
      case 'draft':
        nextStatus = 'draft'
        break
      case 'archive':
        nextStatus = 'archived'
        break
      default:
        return response.badRequest({ error: 'Invalid action' })
    }
    const now = new Date()
    await Post.query().whereIn('id', uniqueIds).update({ status: nextStatus, updatedAt: now as any })
    return response.ok({ message: `Updated status to ${nextStatus}`, count: uniqueIds.length })
  }

  /**
   * GET /api/posts/:slug
   *
   * Get a post by slug with rendered modules.
   */
  async show({ params, request, response, inertia }: HttpContext) {
    const { slug } = params
    const locale = request.input('locale', 'en')

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

      // Load translations for hreflang/alternate
      const baseId = post.translationOfId || post.id
      const family = await Post.query().where((q) => {
        q.where('translationOfId', baseId).orWhere('id', baseId)
      })
      const protocol = (request as any).protocol ? (request as any).protocol() : (request.secure ? 'https' : 'http')
      const host = (request as any).host ? (request as any).host() : request.header('host')
      const makeUrl = (slug: string, loc: string) =>
        urlPatternService.buildPostUrl(post.type, slug, loc, protocol, host)
      const alternates = family.map((p) => ({
        locale: p.locale,
        href: '',
      }))
      // Build URLs (async)
      const alternatesBuilt = await Promise.all(
        alternates.map(async (a, idx) => ({
          locale: family[idx].locale,
          href: await urlPatternService.buildPostUrl(
            post.type,
            family[idx].slug,
            family[idx].locale,
            protocol,
            host,
            family[idx].createdAt ? new Date(family[idx].createdAt.toISO()) : undefined
          ),
        }))
      )
      const canonical = await urlPatternService.buildPostUrl(
        post.type,
        post.slug,
        post.locale,
        protocol,
        host,
        post.createdAt ? new Date(post.createdAt.toISO()) : undefined
      )
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

      // Load post modules with their data
      const postModules = await db
        .from('post_modules')
        .join('module_instances', 'post_modules.module_id', 'module_instances.id')
        .where('post_modules.post_id', post.id)
        .select(
          'post_modules.id as postModuleId',
          'module_instances.type',
          'module_instances.scope',
          'module_instances.props',
          'post_modules.overrides',
          'post_modules.locked',
          'post_modules.order_index as orderIndex'
        )
        .orderBy('post_modules.order_index', 'asc')

      // Merge props with overrides for each module
      const modules = postModules.map((pm) => {
        const baseProps = pm.props || {}
        const overrides = pm.overrides || {}

        return {
          id: pm.postModuleId,
          type: pm.type,
          props: { ...baseProps, ...overrides }, // Merge base props with overrides
        }
      })

      // Return as Inertia page for public viewing
      return inertia.render('site/post', {
        post: {
          id: post.id,
          type: post.type,
          locale: post.locale,
          slug: post.slug,
          title: post.title,
          excerpt: post.excerpt,
          metaTitle: post.metaTitle,
          metaDescription: post.metaDescription,
          status: post.status,
        },
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
   * Resolve public post by matching URL patterns (catch-all route).
   */
  async resolve({ request, response, inertia }: HttpContext) {
    const path = request.url().split('?')[0]
    const match = await urlPatternService.matchPath(path)
    if (!match) {
      return response.notFound({ error: 'Not found' })
    }
    const { slug, locale } = match
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
          'module_instances.type',
          'module_instances.scope',
          'module_instances.props',
          'post_modules.overrides',
          'post_modules.locked',
          'post_modules.order_index as orderIndex'
        )
        .orderBy('post_modules.order_index', 'asc')
      const modules = postModules.map((pm) => ({
        id: pm.postModuleId,
        type: pm.type,
        props: { ...(pm.props || {}), ...(pm.overrides || {}) },
      }))
      const protocol = (request as any).protocol ? (request as any).protocol() : (request.secure ? 'https' : 'http')
      const host = (request as any).host ? (request as any).host() : request.header('host')
      const canonical = await urlPatternService.buildPostUrl(
        post.type,
        post.slug,
        post.locale,
        protocol,
        host,
        post.createdAt ? new Date(post.createdAt.toISO()) : undefined
      )
      const baseId = post.translationOfId || post.id
      const family = await Post.query().where((q) => {
        q.where('translationOfId', baseId).orWhere('id', baseId)
      })
      const alternates = await Promise.all(
        family.map((p) =>
          urlPatternService.buildPostUrl(p.type, p.slug, p.locale, protocol, host, p.createdAt ? new Date(p.createdAt.toISO()) : undefined)
        )
      )
      return inertia.render('site/post', {
        post: {
          id: post.id,
          type: post.type,
          locale: post.locale,
          slug: post.slug,
          title: post.title,
          excerpt: post.excerpt,
          metaTitle: post.metaTitle,
          metaDescription: post.metaDescription,
          status: post.status,
        },
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
    const { moduleType, scope, props, globalSlug, orderIndex, locked } = request.only([
      'moduleType',
      'scope',
      'props',
      'globalSlug',
      'orderIndex',
      'locked',
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
    const { orderIndex, overrides, locked } = request.only(['orderIndex', 'overrides', 'locked'])

    try {
      const updated = await UpdatePostModule.handle({
        postModuleId: id,
        orderIndex,
        overrides,
        locked,
      })

      return response.ok({
        data: {
          id: updated.id,
          orderIndex: updated.order_index,
          overrides: updated.overrides,
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
