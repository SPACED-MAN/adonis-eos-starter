import type { HttpContext } from '@adonisjs/core/http'
import Post from '#models/post'
import urlPatternService from '#services/url_pattern_service'
import postTypeConfigService from '#services/post_type_config_service'
import postRenderingService from '#services/post_rendering_service'
import previewService from '#services/preview_service'
import postTypeViewService from '#services/post_type_view_service'
import taxonomyService from '#services/taxonomy_service'
import BasePostsController from './base_posts_controller.js'
import PostModule from '#models/post_module'
import ModuleInstance from '#models/module_instance'
import PostCustomFieldValue from '#models/post_custom_field_value'
import Taxonomy from '#models/taxonomy'
import TaxonomyTerm from '#models/taxonomy_term'
import ModuleGroupModule from '#models/module_group_module'

/**
 * Posts View Controller
 *
 * Handles public and admin viewing of posts.
 */
export default class PostsViewController extends BasePostsController {
  /**
   * GET /admin/posts/:id/edit
   * Show the post editor
   */
  async edit({ params, inertia }: HttpContext) {
    try {
      const post = await Post.findOrFail(params.id)

      const uiCfg = postTypeConfigService.getUiConfig(post.type)
      const hasPermalinks = uiCfg.permalinksEnabled !== false && uiCfg.urlPatterns.length > 0
      const modulesEnabled = uiCfg.modulesEnabled !== false && uiCfg.urlPatterns.length > 0

      // Load post modules for editor
      const postModules = modulesEnabled
        ? await PostModule.query()
          .where('postId', post.id)
          .orderBy('orderIndex', 'asc')
          .orderBy('createdAt', 'asc')
          .preload('moduleInstance')
        : []

      // If the post has a module group template, but the post modules all share the same orderIndex
      // (common when older/generated posts were seeded with a bad order_index), fall back to the
      // module group ordering so the editor respects the template order.
      if (modulesEnabled && post.moduleGroupId && postModules.length > 1) {
        const uniq = new Set(postModules.map((pm) => Number((pm as any).orderIndex ?? 0)))
        if (uniq.size <= 1) {
          const groupRows = await ModuleGroupModule.query()
            .where('moduleGroupId', post.moduleGroupId)
            .orderBy('orderIndex', 'asc')
            .orderBy('createdAt', 'asc')

          const rank = new Map<string, number>()
          groupRows.forEach((gm, idx) => {
            const scope = String((gm as any).scope || 'post')
            const globalSlug = String((gm as any).globalSlug || '')
            const key = `${gm.type}|${scope}|${globalSlug}`
            if (!rank.has(key)) rank.set(key, idx)
          })

          const getKeyForPm = (pm: any) => {
            const mi = pm.moduleInstance as any as ModuleInstance
            const scope = String(mi?.scope || 'post') // 'post' or 'global'
            const globalSlug = String(mi?.globalSlug || '')
            return `${String(mi?.type || '')}|${scope}|${globalSlug}`
          }

          postModules.sort((a: any, b: any) => {
            const ra = rank.get(getKeyForPm(a))
            const rb = rank.get(getKeyForPm(b))
            if (ra !== undefined && rb !== undefined) return ra - rb
            if (ra !== undefined) return -1
            if (rb !== undefined) return 1
            // fallback: keep deterministic
            return String(a.id).localeCompare(String(b.id))
          })
        }
      }

      // Load translations
      const baseId = post.translationOfId || post.id
      const family = await Post.query().where((q) => {
        q.where('translationOfId', baseId).orWhere('id', baseId)
      })
      const translations = family.map((p) => ({ id: p.id, locale: p.locale }))

      // Build public path (use hierarchical path if post has parents)
      const publicPath = hasPermalinks ? await urlPatternService.buildPostPathForPost(post.id) : ''

      // Load author
      const author = await postRenderingService.loadAuthor(post.authorId)

      // Load custom fields
      const fields = Array.isArray(uiCfg.fields) ? uiCfg.fields : []
      const slugs = fields.map((f: any) => String(f.slug))

      let valuesBySlug = new Map<string, any>()
      if (slugs.length > 0) {
        const vals = await PostCustomFieldValue.query()
          .where('postId', post.id)
          .whereIn('fieldSlug', slugs)
        valuesBySlug = new Map(vals.map((v: any) => [String(v.fieldSlug), v.value]))
      }

      const customFields = fields.map((f: any) => ({
        id: f.slug,
        slug: f.slug,
        label: f.label,
        fieldType: f.type,
        config: f.config || {},
        translatable: !!f.translatable,
        value: valuesBySlug.get(String(f.slug)) ?? null,
      }))

      // Load taxonomies (by slug) configured for this post type
      const taxonomySlugs = Array.isArray((uiCfg as any).taxonomies)
        ? (uiCfg as any).taxonomies
        : []
      let taxonomyData: Array<{
        slug: string
        name: string
        terms: any[]
        hierarchical: boolean
        freeTagging: boolean
        maxSelections: number | null
      }> = []
      let selectedTaxonomyTermIds: string[] = []

      if (taxonomySlugs.length > 0) {
        const taxonomies = await Taxonomy.query().whereIn('slug', taxonomySlugs)
        taxonomyData = await Promise.all(
          (taxonomies as any[]).map(async (t: any) => {
            const cfg = taxonomyService.getConfig(t.slug)
            const terms = await taxonomyService.getTermsTreeBySlug(t.slug)
            return {
              slug: t.slug,
              name: t.name,
              terms,
              hierarchical: !!cfg?.hierarchical,
              freeTagging: !!cfg?.freeTagging,
              maxSelections:
                cfg?.maxSelections === null || cfg?.maxSelections === undefined
                  ? null
                  : Number(cfg.maxSelections),
            }
          })
        )

        const assignedTerms = await TaxonomyTerm.query()
          .join('post_taxonomy_terms as ptt', 'ptt.taxonomy_term_id', 'taxonomy_terms.id')
          .join('taxonomies as t', 'taxonomy_terms.taxonomy_id', 't.id')
          .where('ptt.post_id', post.id)
          .whereIn('t.slug', taxonomySlugs)
          .select('ptt.taxonomy_term_id as termId')

        selectedTaxonomyTermIds = assignedTerms.map((r: any) => String(r.termId))
      }

      return inertia.render('admin/posts/editor', {
        post: {
          id: post.id,
          type: post.type,
          slug: post.slug,
          title: post.title,
          excerpt: post.excerpt,
          status: post.status,
          locale: post.locale,
          parentId: post.parentId || null,
          metaTitle: post.metaTitle,
          metaDescription: post.metaDescription,
          canonicalUrl: post.canonicalUrl,
          robotsJson: post.robotsJson,
          jsonldOverrides: post.jsonldOverrides,
          featuredImageId: (post as any).featuredImageId || (post as any).featured_image_id || null,
          createdAt: post.createdAt.toISO(),
          updatedAt: post.updatedAt.toISO(),
          publicPath,
          author,
        },
        reviewDraft: post.reviewDraft || null,
        aiReviewDraft: post.aiReviewDraft || null,
        modules: modulesEnabled
          ? postModules.map((pm) => {
            const mi = pm.moduleInstance as any as ModuleInstance
            return {
              id: pm.id,
              type: mi?.type,
              scope: mi?.scope,
              props: mi?.props || {},
              reviewProps: (mi as any)?.reviewProps || (mi as any)?.review_props || null,
              aiReviewProps: (mi as any)?.aiReviewProps || (mi as any)?.ai_review_props || null,
              overrides: pm.overrides || null,
              reviewOverrides:
                (pm as any).reviewOverrides || (pm as any).review_overrides || null,
              aiReviewOverrides:
                (pm as any).aiReviewOverrides || (pm as any).ai_review_overrides || null,
              reviewAdded: (pm as any).reviewAdded || false,
              reviewDeleted: (pm as any).reviewDeleted || false,
              aiReviewAdded: (pm as any).aiReviewAdded || (pm as any).ai_review_added || false,
              aiReviewDeleted: (pm as any).aiReviewDeleted || (pm as any).ai_review_deleted || false,
              locked: pm.locked,
              orderIndex: pm.orderIndex,
              globalSlug: mi?.globalSlug || null,
              globalLabel: mi?.globalLabel || null,
            }
          })
          : [],
        translations,
        customFields,
        uiConfig: { ...uiCfg, modulesEnabled, hasPermalinks },
        taxonomies: taxonomyData,
        selectedTaxonomyTermIds,
      })
    } catch {
      return inertia.render('admin/errors/not_found')
    }
  }

  /**
   * GET /preview/:id
   * Preview a post using a signed token
   */
  async preview({ params, request, response, inertia }: HttpContext) {
    const { id } = params
    const token = String(request.input('token', ''))
    const signature = String(request.input('sig', ''))
    const expiresAt = String(request.input('exp', ''))

    // Validate preview token
    const isValid = await previewService.validatePreviewToken(id, token, signature, expiresAt)
    if (!isValid) {
      return this.response.forbidden(response, 'Invalid or expired preview link')
    }

    // Load post (include soft-deleted)
    Post.softDeleteEnabled = false
    const post = await Post.find(id)
    Post.softDeleteEnabled = true

    if (!post) {
      return this.response.notFound(response, 'Post not found')
    }

    const protocol = postRenderingService.getProtocolFromRequest(request)
    const host = postRenderingService.getHostFromRequest(request)

    const pageData = await postRenderingService.buildPageData(post, {
      protocol,
      host,
      wantReview: true, // Always show latest draft version in preview
      draftMode: 'auto', // Prefer reviewDraft; otherwise fall back to AI Review
    })

    // Get post-type-specific additional props (delegated to service)
    const additionalProps = await postTypeViewService.getAdditionalProps(post)

    return inertia.render('site/post', {
      post: pageData.post,
      hasReviewDraft: pageData.hasReviewDraft,
      siteSettings: pageData.siteSettings,
      seo: pageData.seo,
      modules: pageData.modules,
      breadcrumbTrail: pageData.breadcrumbTrail,
      isPreview: true,
      ...additionalProps,
    })
  }

  /**
   * Resolve post by URL pattern (catch-all)
   */
  async resolve({ request, response, inertia, auth }: HttpContext) {
    const path = request.url().split('?')[0]

    const match = await urlPatternService.matchPath(path)

    if (!match) {
      return inertia.render('site/errors/not_found')
    }

    const { slug, locale, postType, usesPath, fullPath } = match

    // Check permalinks
    if (postType) {
      try {
        const uiConfig = postTypeConfigService.getUiConfig(postType)
        const hasPermalinks =
          uiConfig.permalinksEnabled !== false && uiConfig.urlPatterns.length > 0
        if (!hasPermalinks) {
          return inertia.render('site/errors/not_found')
        }
      } catch {
        /* continue */
      }
    }

    const viewParam = String(request.input('view', '')).toLowerCase()
    const wantReview = viewParam === 'review' && Boolean(request.header('cookie'))

    try {
      // Query by slug to find the post
      const post = await Post.query()
        .where('slug', slug)
        .where('locale', locale)
        .where('type', postType)
        .first()

      if (!post) {
        return inertia.render('site/errors/not_found')
      }

      // For hierarchical paths, verify the full path matches
      if (usesPath && fullPath) {
        try {
          // Build the expected canonical path for this post
          const expectedPath = await urlPatternService.buildPostPathForPost(post.id)

          // If the incoming path doesn't match the expected path, it's a 404
          if (path !== expectedPath) {
            return inertia.render('site/errors/not_found')
          }
        } catch {
          // If path building fails, fall back to allowing the request
          // This can happen if URL patterns aren't properly set up
        }
      }

      // Handle protected/private statuses
      if (post.status === 'private') {
        if (!auth?.isAuthenticated) {
          return response.redirect('/admin/login', true)
        }
      } else if (post.status === 'protected') {
        const ok = request.cookie('PROTECTED_AUTH') === '1'
        if (!ok) {
          const red = encodeURIComponent(request.url())
          return response.redirect(`/protected?redirect=${red}`, true)
        }
      }

      const protocol = postRenderingService.getProtocolFromRequest(request)
      const host = postRenderingService.getHostFromRequest(request)

      const pageData = await postRenderingService.buildPageData(post, {
        protocol,
        host,
        wantReview,
      })

      // Get post-type-specific additional props (delegated to service)
      const additionalProps = await postTypeViewService.getAdditionalProps(post)

      return inertia.render('site/post', {
        post: pageData.post,
        hasReviewDraft: pageData.hasReviewDraft,
        siteSettings: pageData.siteSettings,
        modules: pageData.modules,
        seo: pageData.seo,
        breadcrumbTrail: pageData.breadcrumbTrail,
        ...additionalProps,
      })
    } catch (error) {
      return this.response.serverError(response, 'Failed to resolve post', error)
    }
  }

  /**
   * POST /api/posts/:id/preview-link
   * Create a preview link for a post
   */
  async createPreviewLink({ params, response, auth }: HttpContext) {
    const { id } = params

    const post = await Post.find(id)
    if (!post) {
      return this.response.notFound(response, 'Post not found')
    }

    const previewData = await previewService.createPreviewLink(id, auth.user?.id)

    return response.ok({
      token: previewData.token,
      expiresAt: previewData.expiresAt.toISOString(),
      url: previewData.url,
    })
  }

  /**
   * GET /api/posts/:id/preview-links
   * List active preview links for a post
   */
  async listPreviewLinks({ params, response }: HttpContext) {
    const { id } = params

    const links = await previewService.listTokensForPost(id)

    return response.ok({
      data: links.map((l) => ({
        id: l.id,
        expiresAt: l.expiresAt.toISOString(),
        createdBy: l.createdBy,
        createdAt: l.createdAt.toISOString(),
      })),
    })
  }

  /**
   * DELETE /api/posts/:id/preview-links/:token
   * Revoke a preview link
   */
  async revokePreviewLink({ params, response }: HttpContext) {
    const { id, token } = params

    const revoked = await previewService.revokeToken(id, token)
    if (!revoked) {
      return this.response.notFound(response, 'Preview link not found')
    }

    return this.response.noContent(response)
  }
}
