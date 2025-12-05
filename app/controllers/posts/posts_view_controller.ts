import type { HttpContext } from '@adonisjs/core/http'
import Post from '#models/post'
import db from '@adonisjs/lucid/services/db'
import urlPatternService from '#services/url_pattern_service'
import postTypeConfigService from '#services/post_type_config_service'
import postRenderingService from '#services/post_rendering_service'
import previewService from '#services/preview_service'
import postTypeViewService from '#services/post_type_view_service'
import BasePostsController from './base_posts_controller.js'

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

      // Load translations
      const baseId = post.translationOfId || post.id
      const family = await Post.query().where((q) => {
        q.where('translationOfId', baseId).orWhere('id', baseId)
      })
      const translations = family.map((p) => ({ id: p.id, locale: p.locale }))

      // Build public path (use hierarchical path if post has parents)
      const publicPath = await urlPatternService.buildPostPathForPost(post.id)

      // Load author
      const author = await postRenderingService.loadAuthor(post.authorId)

      // Load custom fields
      const uiCfg = postTypeConfigService.getUiConfig(post.type)
      const fields = Array.isArray(uiCfg.fields) ? uiCfg.fields : []
      const slugs = fields.map((f: any) => String(f.slug))

      let valuesBySlug = new Map<string, any>()
      if (slugs.length > 0) {
        const vals = await db
          .from('post_custom_field_values')
          .where('post_id', post.id)
          .whereIn('field_slug', slugs)
        valuesBySlug = new Map(vals.map((v: any) => [String(v.field_slug), v.value]))
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
        modules: postModules.map((pm) => ({
          id: pm.postModuleId,
          type: pm.type,
          scope: pm.scope,
          props: pm.props || {},
          reviewProps: pm.review_props || null,
          overrides: pm.overrides || null,
          reviewOverrides: pm.review_overrides || null,
          reviewAdded: pm.reviewAdded || false,
          reviewDeleted: pm.reviewDeleted || false,
          locked: pm.locked,
          orderIndex: pm.orderIndex,
          globalSlug: pm.globalSlug || null,
          globalLabel: pm.globalLabel || null,
        })),
        translations,
        customFields,
        uiConfig: uiCfg,
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
      wantReview: true, // Always show review version in preview
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
        if (uiConfig.permalinksEnabled === false) {
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
