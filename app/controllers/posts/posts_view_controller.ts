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
import { coerceJsonObject } from '../../helpers/jsonb.js'
import { getSiteInertiaOverrideForPost } from '#services/site_inertia_overrides_service'

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
  async edit({ params, inertia, request }: HttpContext) {
    try {
      // Temporarily disable soft deletes to allow editing soft-deleted posts
      Post.softDeleteEnabled = false
      const post = await Post.findOrFail(params.id)
      Post.softDeleteEnabled = true

      const uiCfg = postTypeConfigService.getUiConfig(post.type)
      const hasPermalinks = uiCfg.permalinksEnabled !== false && uiCfg.urlPatterns.length > 0
      const modulesEnabled = uiCfg.modulesEnabled !== false && uiCfg.urlPatterns.length > 0

      // Load post modules for editor
      let postModules = modulesEnabled
        ? await PostModule.query()
          .where('postId', post.id)
          .orderBy('orderIndex', 'asc')
          .orderBy('createdAt', 'asc')
          .preload('moduleInstance')
        : []

      // Atomic Draft support: if we're in review/ai-review mode and the draft has modules, use them
      const viewParam = request.input('view', '').toLowerCase()
      const draftToUse =
        viewParam === 'ai-review'
          ? coerceJsonObject(post.aiReviewDraft)
          : viewParam === 'review'
            ? coerceJsonObject(post.reviewDraft)
            : null
      const draftModules = (draftToUse as any)?.modules

      const editorModules = modulesEnabled
        ? postModules.map((pm) => {
          const mi = pm.moduleInstance as any as ModuleInstance

          // Check if this specific module has a newer version in the atomic draft
          const draftModule = Array.isArray(draftModules)
            ? draftModules.find((dm: any) => dm.id === pm.id)
            : null

          return {
            id: pm.id,
            moduleInstanceId: pm.moduleId,
            type: mi?.type,
            scope: mi?.scope,
            props: coerceJsonObject(mi?.props),
            reviewProps: (() => {
              if (draftModule && draftModule.props && mi?.scope === 'post') return draftModule.props
              const obj = coerceJsonObject((mi as any)?.reviewProps || (mi as any)?.review_props)
              return Object.keys(obj).length > 0 ? obj : null
            })(),
            aiReviewProps: (() => {
              if (draftModule && draftModule.props && mi?.scope === 'post' && viewParam === 'ai-review') return draftModule.props
              const obj = coerceJsonObject((mi as any)?.aiReviewProps || (mi as any)?.ai_review_props)
              return Object.keys(obj).length > 0 ? obj : null
            })(),
            overrides: coerceJsonObject(pm.overrides),
            reviewOverrides: (() => {
              if (draftModule && draftModule.overrides && mi?.scope !== 'post') return draftModule.overrides
              const obj = coerceJsonObject((pm as any).reviewOverrides || (pm as any).review_overrides)
              return Object.keys(obj).length > 0 ? obj : null
            })(),
            aiReviewOverrides: (() => {
              if (draftModule && draftModule.overrides && mi?.scope !== 'post' && viewParam === 'ai-review') return draftModule.overrides
              const obj = coerceJsonObject((pm as any).aiReviewOverrides || (pm as any).ai_review_overrides)
              return Object.keys(obj).length > 0 ? obj : null
            })(),
            reviewAdded: (pm as any).reviewAdded || false,
            reviewDeleted: (pm as any).reviewDeleted || false,
            aiReviewAdded: (pm as any).aiReviewAdded || (pm as any).ai_review_added || false,
            aiReviewDeleted:
              (pm as any).aiReviewDeleted || (pm as any).ai_review_deleted || false,
            locked: pm.locked,
            orderIndex: pm.orderIndex,
            globalSlug: mi?.globalSlug || null,
            globalLabel: mi?.globalLabel || null,
            adminLabel: (() => {
              // Priority 1: Label from the draft snapshot (Review/AI Review)
              if ((draftModule as any)?.adminLabel !== undefined) {
                return (draftModule as any).adminLabel
              }
              // Priority 2: Label from the dedicated database column
              if (pm.adminLabel !== null && pm.adminLabel !== undefined) {
                return pm.adminLabel
              }
              // Priority 3: Legacy label from JSON props (local) or overrides (global)
              const props = coerceJsonObject(mi?.props)
              const overrides = coerceJsonObject(pm.overrides)
              return (props as any)?._adminLabel || (overrides as any)?._adminLabel || null
            })(),
          }
        })
        : []

      // (No debug logging)

      // If the post has a module group template, but the post modules all share the same orderIndex
      // (common when older/generated posts were seeded with a bad order_index), fall back to the
      // module group ordering so the editor respects the template order.
      if (modulesEnabled && post.moduleGroupId && editorModules.length > 1) {
        const uniq = new Set(editorModules.map((pm) => Number((pm as any).orderIndex ?? 0)))
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
            return `${String(pm.type || '')}|${pm.scope}|${pm.globalSlug || ''}`
          }

          editorModules.sort((a: any, b: any) => {
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

      // Load variations if A/B testing is enabled
      let variations: Array<{ id: string; variation: string; status: string }> = []
      if (uiCfg.abTesting.enabled) {
        const abGroupId = post.abGroupId || post.id
        const locale = post.locale
        // We only want variations for the current locale to keep the switcher clean
        const variationRows = await Post.query()
          .where('abGroupId', abGroupId)
          .where('locale', locale)
          .select('id', 'ab_variation as variation', 'status')
        variations = variationRows.map((v: any) => ({
          id: String(v.id),
          variation: String(v.variation || 'A'),
          status: String(v.status),
        }))

        // Ensure current post is correctly represented in the list if it's missing abGroupId
        if (!post.abGroupId && !variations.some(v => v.id === post.id)) {
           variations.push({ id: post.id, variation: 'A', status: post.status })
        }
      }

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

      // For link fields with post references, resolve the URL dynamically using postId
      // This ensures links work even if the slug changes (like menus do)
      const customFields = await Promise.all(
        fields.map(async (f: any) => {
          const rawValue = valuesBySlug.get(String(f.slug)) ?? null
          let resolvedValue = rawValue

          // Resolve post references in link field values by adding the resolved URL
          // We keep the postId so links work even if slug changes
          if (f.type === 'link' && rawValue && typeof rawValue === 'object' && rawValue.kind === 'post' && rawValue.postId) {
            try {
              const url = await urlPatternService.buildPostPathForPost(rawValue.postId)
              // Add the resolved URL while keeping the postId for future resolution
              resolvedValue = {
                ...rawValue,
                url, // Add resolved URL from server
              }
            } catch (error) {
              // If resolution fails, keep the original value
              console.warn(`Failed to resolve post reference for ${rawValue.postId}:`, error)
            }
          }

          return {
            id: f.slug,
            slug: f.slug,
            label: f.label,
            fieldType: f.type,
            config: f.config || {},
            translatable: !!f.translatable,
            value: resolvedValue,
          }
        })
      )

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
        modules: editorModules,
        translations,
        customFields,
        uiConfig: { ...uiCfg, modulesEnabled, hasPermalinks },
        variations,
        taxonomies: taxonomyData,
        selectedTaxonomyTermIds,
      })
    } catch (error) {
      // Log the error for debugging
      console.error('Error loading post editor:', error)
      // If it's a ModelNotFoundException (post not found), return 404
      if (error && typeof error === 'object' && 'code' in error && error.code === 'E_ROW_NOT_FOUND') {
        return inertia.render('admin/errors/not_found')
      }
      // For other errors, re-throw to see the actual error
      throw error
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
      // Query by slug to find the primary post match
      let post = await Post.query()
        .where('slug', slug)
        .where('locale', locale)
        .where('type', postType)
        .first()

      if (!post) {
        return inertia.render('site/errors/not_found')
      }

      // A/B Testing Logic: if enabled, we may swap this post for another variation in the same group
      const uiCfg = postTypeConfigService.getUiConfig(postType)
      if (uiCfg.abTesting?.enabled && post.status === 'published') {
        const abGroupId = post.abGroupId || post.id
        const publishedVariations = await Post.query()
          .where('abGroupId', abGroupId)
          .where('locale', locale)
          .where('status', 'published')
          .select('id', 'ab_variation as variation')

        if (publishedVariations.length > 1) {
          const cookieName = `ab_group_${abGroupId}`
          let chosenVariation = request.cookie(cookieName)

          // If no variation chosen yet or chosen variation is no longer available, pick one
          if (!chosenVariation || !publishedVariations.some((v) => v.variation === chosenVariation)) {
            const configVariations = uiCfg.abTesting.variations || []
            if (configVariations.length > 0) {
              // Weighted random choice
              const totalWeight = configVariations.reduce((sum, v) => sum + (v.weight || 1), 0)
              let random = Math.random() * totalWeight
              for (const v of configVariations) {
                random -= v.weight || 1
                if (random <= 0) {
                  chosenVariation = v.value
                  break
                }
              }
            } else {
              // Simple random choice from available published variations
              const idx = Math.floor(Math.random() * publishedVariations.length)
              chosenVariation = publishedVariations[idx].variation
            }

            // Persist choice if strategy is cookie
            if (uiCfg.abTesting.strategy === 'cookie' || !uiCfg.abTesting.strategy) {
              response.cookie(cookieName, chosenVariation, { maxAge: '30d', path: '/' })
            }
          }

          // Swap post if the chosen variation is different from the matched one
          const match = publishedVariations.find((v) => v.variation === chosenVariation)
          if (match && match.id !== post.id) {
            post = await Post.findOrFail(match.id)
          }
        }
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

      // Check if user is authenticated using the web guard
      const isAuthenticated = await auth.use('web').check()

      // Draft and archived posts are not visible to unauthenticated users
      if ((post.status === 'draft' || post.status === 'archived') && !isAuthenticated) {
        return inertia.render('site/errors/not_found')
      }

      // Handle protected/private statuses
      if (post.status === 'private') {
        if (!isAuthenticated) {
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

      const overrideComponent = getSiteInertiaOverrideForPost(post.type, post.slug)

      return inertia.render(overrideComponent || 'site/post', {
        post: pageData.post,
        hasReviewDraft: pageData.hasReviewDraft,
        siteSettings: pageData.siteSettings,
        modules: pageData.modules,
        seo: pageData.seo,
        breadcrumbTrail: pageData.breadcrumbTrail,
        inertiaOverride: overrideComponent ? { key: `${post.type}:${post.slug}` } : null,
        ...additionalProps,
      })
    } catch (error) {
      console.error('Error loading post editor:', error)
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
