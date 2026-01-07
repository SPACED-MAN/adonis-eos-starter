import db from '@adonisjs/lucid/services/db'
import type { HttpContext } from '@adonisjs/core/http'
import Post from '#models/post'
import urlPatternService from '#services/url_pattern_service'
import postTypeConfigService from '#services/post_type_config_service'
import postRenderingService from '#services/post_rendering_service'
import previewService from '#services/preview_service'
import postTypeViewService from '#services/post_type_view_service'
import roleRegistry from '#services/role_registry'
import { adminPath } from '#services/admin_path_service'
import taxonomyService from '#services/taxonomy_service'
import activityLogService from '#services/activity_log_service'
import BasePostsController from './base_posts_controller.js'
import PostModule from '#models/post_module'
import ModuleInstance from '#models/module_instance'
import PostCustomFieldValue from '#models/post_custom_field_value'
import moduleRegistry from '#services/module_registry'
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

      // Helper to check if a draft has meaningful content (not just metadata)
      const hasMeaningfulContent = (draft: any) => {
        const obj = coerceJsonObject(draft)
        const keys = Object.keys(obj).filter((k) => k !== 'savedAt' && k !== 'savedBy')
        return keys.length > 0
      }

      // Determine view mode for the editor
      const viewParam = (request.input('view', '') as string).toLowerCase()
      let activeViewMode: 'source' | 'review' | 'ai-review' = 'source'

      const hasRd = hasMeaningfulContent(post.reviewDraft)
      const hasArd = hasMeaningfulContent(post.aiReviewDraft)

      if (viewParam === 'review' && hasRd) activeViewMode = 'review'
      else if (viewParam === 'ai-review' && hasArd) activeViewMode = 'ai-review'
      // If no view param (or invalid requested view), fall back to best available draft
      else if (hasRd) activeViewMode = 'review'
      else if (hasArd) activeViewMode = 'ai-review'
      else activeViewMode = 'source'

      // Determine active drafts for baseline mapping
      const rd = coerceJsonObject(post.reviewDraft)
      const ard = coerceJsonObject(post.aiReviewDraft)
      const rdModules = Array.isArray(rd.modules) ? rd.modules : []
      const ardModules = Array.isArray(ard.modules) ? ard.modules : []

      // Determine the specific draft modules to use for the CURRENT tab's primary props
      const currentDraftModules =
        activeViewMode === 'ai-review' ? ardModules : activeViewMode === 'review' ? rdModules : []

      // Resolve featured media asset for fallback logic in modules
      // Respect the active view mode (draft vs published)
      let activeFeaturedMediaId = post.featuredMediaId
      const currentDraft =
        activeViewMode === 'ai-review' ? ard : activeViewMode === 'review' ? rd : null

      if (currentDraft && (currentDraft as any).featuredMediaId !== undefined) {
        activeFeaturedMediaId = (currentDraft as any).featuredMediaId
      }

      let featuredMediaAsset: any = null
      if (activeFeaturedMediaId) {
        const asset = await db.from('media_assets').where('id', activeFeaturedMediaId).first()
        if (asset) {
          featuredMediaAsset = {
            id: asset.id,
            url: asset.url,
            mimeType: asset.mime_type,
            altText: asset.alt_text,
            metadata: asset.metadata || {},
            optimizedUrl: asset.optimized_url,
            darkSourceUrl: asset.metadata?.darkSourceUrl,
            darkOptimizedUrl: asset.metadata?.darkOptimizedUrl,
          }
        }
      }

      // 3. Modules logic (KISS approach: use versioned props)
      const editorModules = modulesEnabled
        ? postModules
            .map((pm) => {
              const mi = pm.moduleInstance as any as ModuleInstance
              const moduleConfig = moduleRegistry.has(mi?.type)
                ? moduleRegistry.get(mi?.type).getConfig()
                : null
              const defaultProps = moduleConfig?.defaultValues || {}

              // Get atomic draft versions of this module if they exist
              const rdModule = rdModules.find(
                (dm: any) => dm.id === pm.id || dm.postModuleId === pm.id
              )
              const ardModule = ardModules.find(
                (dm: any) => dm.id === pm.id || dm.postModuleId === pm.id
              )
              const currentDraftModule = currentDraftModules.find(
                (dm: any) => dm.id === pm.id || dm.postModuleId === pm.id
              )

              const isLocal = mi?.scope === 'post'

              // Check if deleted in draft
              const isReviewDeleted = activeViewMode === 'review' && Array.isArray(rd.modules) && !rdModule
              const isAiReviewDeleted = activeViewMode === 'ai-review' && Array.isArray(ard.modules) && !ardModule

              // Helper to merge defaults and resolve hero fallbacks
              const prepareProps = (p: any) => {
                const merged = { ...defaultProps, ...coerceJsonObject(p) }
                // Special fallback for hero-with-media using featured media
                if (
                  (mi?.type === 'hero-with-media' || mi?.type === 'HeroWithMedia') &&
                  featuredMediaAsset
                ) {
                  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
                  if (
                    !merged.image ||
                    merged.image === '' ||
                    (typeof merged.image === 'string' && uuidRegex.test(merged.image))
                  ) {
                    merged.image = featuredMediaAsset
                  }
                }
                return merged
              }

              // Resolve props for each mode
              const sourceProps = isLocal ? coerceJsonObject(mi?.props) : {}
              
              const granularRevProps = isLocal ? coerceJsonObject(mi?.reviewProps ?? (mi as any)?.review_props) : {}
              const reviewProps = isLocal
                ? Object.keys(granularRevProps).length > 0 ? granularRevProps : (rdModule?.props || {})
                : {}
                
              const granularAiRevProps = isLocal ? coerceJsonObject(mi?.aiReviewProps ?? (mi as any)?.ai_review_props) : {}
              const aiReviewProps = isLocal
                ? Object.keys(granularAiRevProps).length > 0 ? granularAiRevProps : (ardModule?.props || {})
                : {}

              // Resolve overrides for each mode (global modules only)
              const sourceOverrides = !isLocal ? coerceJsonObject(pm.overrides) : null
              
              const granularRevOverrides = !isLocal ? coerceJsonObject((pm as any).reviewOverrides ?? (pm as any).review_overrides) : null
              const reviewOverrides = !isLocal
                ? (granularRevOverrides && Object.keys(granularRevOverrides).length > 0) ? granularRevOverrides : (rdModule?.overrides || null)
                : null
                
              const granularAiRevOverrides = !isLocal ? coerceJsonObject((pm as any).aiReviewOverrides ?? (pm as any).ai_review_overrides) : null
              const aiReviewOverrides = !isLocal
                ? (granularAiRevOverrides && Object.keys(granularAiRevOverrides).length > 0) ? granularAiRevOverrides : (ardModule?.overrides || null)
                : null

              return {
                id: pm.id,
                moduleInstanceId: pm.moduleId,
                type: mi?.type,
                scope: mi?.scope === 'post' ? 'local' : mi?.scope,
                props: prepareProps(sourceProps),
                reviewProps: Object.keys(reviewProps).length > 0 ? prepareProps(reviewProps) : null,
                aiReviewProps:
                  Object.keys(aiReviewProps).length > 0 ? prepareProps(aiReviewProps) : null,
                overrides: sourceOverrides ? prepareProps(sourceOverrides) : null,
                reviewOverrides:
                  reviewOverrides && Object.keys(reviewOverrides).length > 0
                    ? prepareProps(reviewOverrides)
                    : null,
                aiReviewOverrides:
                  aiReviewOverrides && Object.keys(aiReviewOverrides).length > 0
                    ? prepareProps(aiReviewOverrides)
                    : null,
                reviewAdded: !!((pm as any).reviewAdded || (pm as any).review_added),
                reviewDeleted: isReviewDeleted || !!((pm as any).reviewDeleted || (pm as any).review_deleted),
                aiReviewAdded: !!((pm as any).aiReviewAdded || (pm as any).ai_review_added),
                aiReviewDeleted: isAiReviewDeleted || !!((pm as any).aiReviewDeleted || (pm as any).ai_review_deleted),
                locked: pm.locked,
                orderIndex: pm.orderIndex,
                globalSlug: mi?.globalSlug || (mi as any)?.global_slug || null,
                globalLabel: mi?.globalLabel || (mi as any)?.global_label || null,
                adminLabel: currentDraftModule?.adminLabel ?? pm.adminLabel ?? null,
                name: moduleConfig?.name || mi?.type || 'Unknown Module',
                label: moduleRegistry.getDynamicLabel(mi?.type, sourceProps),
              }
            })
        : []

      // ATOMIC DRAFT ENHANCEMENT:
      // Include modules that ONLY exist in the draft (newly added in Review/AI Review).
      // This ensures they don't disappear from the editor UI after a page refresh.
      if (modulesEnabled && (activeViewMode === 'review' || activeViewMode === 'ai-review')) {
        const existingPmIds = new Set(editorModules.map((m) => m.id))
        const draftOnlyModules = currentDraftModules
          .filter((dm: any) => {
            const id = dm.postModuleId || dm.id
            return id && !existingPmIds.has(id)
          })
          .map((dm: any) => {
            const moduleConfig = moduleRegistry.has(dm.type)
              ? moduleRegistry.get(dm.type).getConfig()
              : null
            const defaultValues = moduleConfig?.defaultValues || {}
            const isLocal = dm.scope === 'post' || dm.scope === 'local'

            const prepareProps = (p: any) => {
              return { ...defaultValues, ...coerceJsonObject(p) }
            }

            return {
              id: dm.postModuleId || dm.id,
              moduleInstanceId: dm.moduleInstanceId || dm.moduleId,
              type: dm.type,
              scope: dm.scope === 'post' ? 'local' : dm.scope,
              props: isLocal ? prepareProps(dm.props) : {},
              reviewProps:
                activeViewMode === 'review' && isLocal ? prepareProps(dm.props) : null,
              aiReviewProps:
                activeViewMode === 'ai-review' && isLocal ? prepareProps(dm.props) : null,
              overrides: !isLocal ? prepareProps(dm.overrides) : null,
              reviewOverrides:
                activeViewMode === 'review' && !isLocal ? prepareProps(dm.overrides) : null,
              aiReviewOverrides:
                activeViewMode === 'ai-review' && !isLocal ? prepareProps(dm.overrides) : null,
              reviewAdded: activeViewMode === 'review',
              reviewDeleted: false,
              aiReviewAdded: activeViewMode === 'ai-review',
              aiReviewDeleted: false,
              locked: !!dm.locked,
              orderIndex: dm.orderIndex,
              globalSlug: dm.globalSlug || null,
              globalLabel: dm.globalLabel || null,
              adminLabel: dm.adminLabel || null,
              name: moduleConfig?.name || dm.type || 'Unknown Module',
              label: moduleRegistry.getDynamicLabel(dm.type, dm.props || {}),
            }
          })

        editorModules.push(...draftOnlyModules)
      }

      // Sort final list
      if (modulesEnabled) {
        editorModules.sort((a, b) => {
          // If in Review/AI Review mode, respect the order in the draft snapshot if it exists
          if (
            (activeViewMode === 'review' || activeViewMode === 'ai-review') &&
            Array.isArray(currentDraftModules) &&
            currentDraftModules.length > 0
          ) {
            const idxA = currentDraftModules.findIndex(
              (dm: any) => dm.id === a.id || dm.postModuleId === a.id
            )
            const idxB = currentDraftModules.findIndex(
              (dm: any) => dm.id === b.id || dm.postModuleId === b.id
            )
            if (idxA >= 0 && idxB >= 0) return idxA - idxB
            if (idxA >= 0) return -1
            if (idxB >= 0) return 1
          }
          return (a.orderIndex ?? 0) - (b.orderIndex ?? 0)
        })
      }

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
          .whereNot('id', post.id)
          .select('id', 'ab_variation', 'status')

        variations = variationRows.map((v) => {
          // Check both the object property and the $extras bucket
          const label = String(
            v.abVariation || (v as any).ab_variation || v.$extras?.ab_variation || 'A'
          )
            .trim()
            .toUpperCase()
          return {
            id: String(v.id),
            variation: label,
            status: String(v.status),
          }
        })

        // Always add the current post explicitly with its correct label
        const currentVarLabel = String(post.abVariation || (post.id === abGroupId ? 'A' : 'A'))
          .trim()
          .toUpperCase()
        if (!variations.some((v) => v.id === post.id)) {
          variations.push({
            id: post.id,
            variation: currentVarLabel,
            status: post.status,
          })
        }

        // Sort variations by label (A, B, C...)
        variations.sort((a, b) => a.variation.localeCompare(b.variation))
      }

      // Build public path (use hierarchical path if post has parents)
      const publicPath = hasPermalinks ? await urlPatternService.buildPostPathForPost(post.id) : ''

      // Load author
      const author = await postRenderingService.loadAuthor(post.authorId)

      // 2. Load custom fields (Draft-aware)
      const fields = Array.isArray(uiCfg.fields) ? uiCfg.fields : []
      const slugs = fields.map((f: any) => String(f.slug))

      let valuesBySlug = new Map<string, any>()
      const draftCustomFields = (currentDraft as any)?.customFields
      if (Array.isArray(draftCustomFields)) {
        // Prefer values from the draft snapshot
        valuesBySlug = new Map(draftCustomFields.map((cf: any) => [String(cf.slug), cf.value]))
      } else if (slugs.length > 0) {
        // Fall back to database values
        const vals = await PostCustomFieldValue.query()
          .where('post_id', post.id)
          .whereIn('field_slug', slugs)
        valuesBySlug = new Map(vals.map((v: any) => [String(v.fieldSlug), v.value]))
      }

      // 1. Identify all needed post references for batch resolution
      const postRefIds = new Set<string>()
      fields.forEach((f: any) => {
        const rawValue = valuesBySlug.get(String(f.slug))
        if (
          f.type === 'link' &&
          rawValue &&
          typeof rawValue === 'object' &&
          rawValue.kind === 'post' &&
          rawValue.postId
        ) {
          postRefIds.add(String(rawValue.postId))
        }
      })

      // 2. Batch resolve all URLs
      const resolvedUrls =
        postRefIds.size > 0
          ? await urlPatternService.buildPostPaths(Array.from(postRefIds))
          : new Map<string, string>()

      // 3. Build custom fields with resolved values
      const customFields = fields.map((f: any) => {
        const rawValue = valuesBySlug.get(String(f.slug)) ?? null
        let resolvedValue = rawValue

        // Resolve post references in link field values by adding the resolved URL
        if (
          f.type === 'link' &&
          rawValue &&
          typeof rawValue === 'object' &&
          rawValue.kind === 'post' &&
          rawValue.postId
        ) {
          const url = resolvedUrls.get(String(rawValue.postId))
          if (url) {
            resolvedValue = {
              ...rawValue,
              url,
            }
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

      // 4. Load taxonomies (Draft-aware)
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

        const draftTaxonomyIds = (currentDraft as any)?.taxonomyTermIds
        if (Array.isArray(draftTaxonomyIds)) {
          // Prefer IDs from the draft snapshot
          selectedTaxonomyTermIds = draftTaxonomyIds.map((id: any) => String(id))
        } else {
          // Fall back to database assignments
          const assignedTerms = await TaxonomyTerm.query()
            .join('post_taxonomy_terms as ptt', 'ptt.taxonomy_term_id', 'taxonomy_terms.id')
            .join('taxonomies as t', 'taxonomy_terms.taxonomy_id', 't.id')
            .where('ptt.post_id', post.id)
            .whereIn('t.slug', taxonomySlugs)
            .select('ptt.taxonomy_term_id as termId')

          selectedTaxonomyTermIds = assignedTerms.map((r: any) => String(r.termId))
        }
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
          featuredMediaId: (post as any).featuredMediaId || (post as any).featured_media_id || null,
          featuredMediaAsset, // Pass the resolved asset object
          createdAt: post.createdAt.toISO(),
          updatedAt: post.updatedAt.toISO(),
          publicPath,
          author,
          abVariation: post.abVariation || (post.abGroupId || variations.length > 0 ? 'A' : null),
          abGroupId: post.abGroupId,
        },
        reviewDraft: hasRd ? rd : null,
        aiReviewDraft: hasArd ? ard : null,
        modules: editorModules,
        translations,
        customFields,
        uiConfig: { ...uiCfg, modulesEnabled, hasPermalinks },
        abVariations: variations,
        taxonomies: taxonomyData,
        selectedTaxonomyTermIds,
      })
    } catch (error) {
      // Log the error for debugging
      console.error('Error loading post editor:', error)
      // If it's a ModelNotFoundException (post not found), return 404
      if (
        error &&
        typeof error === 'object' &&
        'code' in error &&
        error.code === 'E_ROW_NOT_FOUND'
      ) {
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
    const viewParam = String(request.input('view', '')).toLowerCase()

    const pageData = await postRenderingService.buildPageData(post, {
      protocol,
      host,
      wantReview: true, // Always show latest draft version in preview
      draftMode:
        viewParam === 'ai-review' ? 'ai-review' : viewParam === 'review' ? 'review' : 'auto',
    })

    // Get post-type-specific additional props (delegated to service)
    const additionalProps = await postTypeViewService.getAdditionalProps(post)

    return inertia.render('site/post', {
      post: pageData.post,
      hasReviewDraft: pageData.hasReviewDraft,
      siteSettings: pageData.siteSettings,
      customFields: pageData.customFields,
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
    const isAuthenticated = await auth.use('web').check()

    const match = await urlPatternService.matchPath(path)

    if (!match) {
      // Log 404 for SEO monitoring
      await activityLogService.log({
        action: 'system.404',
        ip: request.ip(),
        userAgent: request.header('user-agent'),
        metadata: { path },
      })
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
          await activityLogService.log({
            action: 'system.404',
            ip: request.ip(),
            userAgent: request.header('user-agent'),
            metadata: { path, reason: 'permalinks_disabled', postType },
          })
          return inertia.render('site/errors/not_found')
        }
      } catch {
        /* continue */
      }
    }

    const viewParam = String(request.input('view', '')).toLowerCase()
    const wantReview =
      (viewParam === 'review' || viewParam === 'ai-review') && Boolean(request.header('cookie'))

    let isAbSwapped = false
    try {
      const uiConfig = postTypeConfigService.getUiConfig(postType)

      // Query by slug to find the primary post match
      let post = await Post.query()
        .where('slug', slug)
        .where('locale', locale)
        .where('type', postType)
        .first()

      if (!post) {
        await activityLogService.log({
          action: 'system.404',
          ip: request.ip(),
          userAgent: request.header('user-agent'),
          metadata: { path, reason: 'post_not_found', slug, locale, postType },
        })
        return inertia.render('site/errors/not_found')
      }

      // A/B Testing Logic: if enabled, we may swap this post for another variation in the same group
      if (uiConfig.abTesting?.enabled) {
        const abGroupId = post.abGroupId || post.id
        const cookieName = `ab_group_${abGroupId}`

        // 1. Admin override: allow forcing a variation via query param for editing (even if draft)
        const forcedVariationId = request.input('variation_id')
        const forcedVariationLabel = request.input('variation')

        if (isAuthenticated && (forcedVariationId || forcedVariationLabel)) {
          const match = await Post.query()
            .where('abGroupId', abGroupId)
            .where('locale', locale)
            .where((q) => {
              if (forcedVariationId) q.where('id', forcedVariationId)
              else q.where('abVariation', forcedVariationLabel)
            })
            .first()

          if (match && match.id !== post.id) {
            post = match
            isAbSwapped = true
            // Also update cookie so the choice sticks during the session
            response.cookie(cookieName, post.abVariation || 'A', { maxAge: '1h', path: '/' })
          } else if (match && match.id === post.id) {
            // Already on the right post, but mark as swapped to skip public logic
            isAbSwapped = true
          }
        }

        // 2. Public A/B logic: only for published posts
        if (!isAbSwapped && post.status === 'published') {
          const publishedVariations = await Post.query()
            .where('abGroupId', abGroupId)
            .where('locale', locale)
            .where('status', 'published')
            .select('id', 'ab_variation')

          if (publishedVariations.length > 1) {
            let chosenVariation = request.cookie(cookieName)

            // If no variation chosen yet or chosen variation is no longer available, pick one
            const variationLabels = publishedVariations.map((v) => v.abVariation).filter(Boolean)

            if (!chosenVariation || !variationLabels.includes(chosenVariation)) {
              const variationsFromConfig = uiConfig.abTesting.variations || []
              if (variationsFromConfig.length > 0) {
                // Weighted random choice
                const totalWeight = variationsFromConfig.reduce(
                  (sum, v) => sum + (v.weight || 1),
                  0
                )
                let random = Math.random() * totalWeight
                for (const v of variationsFromConfig) {
                  random -= v.weight || 1
                  if (random <= 0) {
                    chosenVariation = v.value
                    break
                  }
                }
              } else {
                // Simple random choice from available published variations
                const idx = Math.floor(Math.random() * publishedVariations.length)
                chosenVariation = publishedVariations[idx].abVariation
              }

              // Persist choice if strategy is cookie
              if (uiConfig.abTesting.strategy === 'cookie' || !uiConfig.abTesting.strategy) {
                response.cookie(cookieName, chosenVariation, { maxAge: '30d', path: '/' })
              }
            }

            // Swap post if the chosen variation is different from the matched one
            const match = publishedVariations.find((v) => v.abVariation === chosenVariation)
            if (match && match.id !== post.id) {
              post = await Post.findOrFail(match.id)
              isAbSwapped = true
            }

            // Track A/B view
            try {
              await db.table('post_variation_views').insert({
                id: (await import('node:crypto')).randomUUID(),
                post_id: post.id,
                ab_group_id: abGroupId,
                ab_variation: chosenVariation || post.abVariation || 'A',
                created_at: new Date(),
              })
            } catch (e) {
              console.error('[AB] Failed to track variation view:', e)
            }
          }
        }
      }

      // For hierarchical paths, verify the full path matches
      // Skip strict check if we swapped for an A/B variation (which has a different internal slug)
      if (usesPath && fullPath && !isAbSwapped) {
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

      // Draft and archived posts are not visible to unauthenticated users
      if ((post.status === 'draft' || post.status === 'archived') && !isAuthenticated) {
        return inertia.render('site/errors/not_found')
      }

      // Handle protected/private statuses
      if (post.status === 'private') {
        if (!isAuthenticated) {
          return response.redirect(adminPath('login'), true)
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
        draftMode:
          viewParam === 'ai-review' ? 'ai-review' : viewParam === 'review' ? 'review' : 'auto',
      })

      // Get post-type-specific additional props (delegated to service)
      const user = auth.use('web').user
      const role = (user as any)?.role
      const roleDefinition = role ? roleRegistry.get(role) : null
      const permissions = roleDefinition?.permissions || []

      const additionalProps = await postTypeViewService.getAdditionalProps(post, { permissions })

      // Load variations if user is authenticated and A/B testing is enabled
      let abVariations: Array<{ id: string; variation: string; status: string }> = []
      if (isAuthenticated && uiConfig.abTesting?.enabled) {
        const abGroupId = post.abGroupId || post.id
        const variationRows = await Post.query()
          .where('abGroupId', abGroupId)
          .where('locale', locale)
          .select('id', 'ab_variation', 'status')

        abVariations = variationRows.map((v) => ({
          id: String(v.id),
          variation: String(v.abVariation || (v.id === abGroupId ? 'A' : 'A'))
            .trim()
            .toUpperCase(),
          status: String(v.status),
        }))

        // Ensure current post is in the list with its ID
        if (!abVariations.some((v) => v.id === post.id)) {
          abVariations.push({
            id: post.id,
            variation: String(post.abVariation || 'A')
              .trim()
              .toUpperCase(),
            status: post.status,
          })
        }
        abVariations.sort((a, b) => a.variation.localeCompare(b.variation))
      }

      const overrideComponent = getSiteInertiaOverrideForPost(post.type, post.slug)

      // Load translations for the locale switcher in SiteAdminBar
      const originalPost = await post.getOriginal()
      const family = await originalPost.getAllTranslations()
      const translations = await Promise.all(
        family.map(async (t) => ({
          id: t.id,
          locale: t.locale,
          path: await urlPatternService.buildPostPathForPost(t.id),
        }))
      )

      return inertia.render(overrideComponent || 'site/post', {
        post: pageData.post,
        hasReviewDraft: pageData.hasReviewDraft,
        siteSettings: pageData.siteSettings,
        customFields: pageData.customFields,
        modules: pageData.modules,
        seo: pageData.seo,
        breadcrumbTrail: pageData.breadcrumbTrail,
        inertiaOverride: overrideComponent ? { key: `${post.type}:${post.slug}` } : null,
        abVariations,
        translations,
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
