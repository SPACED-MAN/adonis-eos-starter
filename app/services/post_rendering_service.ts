import db from '@adonisjs/lucid/services/db'
import MediaAsset from '#models/media_asset'
import Post from '#models/post'
import PostModule from '#models/post_module'
import urlPatternService from '#services/url_pattern_service'
import siteSettingsService from '#services/site_settings_service'
import moduleRegistry from '#services/module_registry'
import tokenService from '#services/token_service'
import { robotsConfigToString, DEFAULT_ROBOTS, type PostSeoData } from '#types/seo'

/**
 * Module data for rendering
 */
export interface ModuleRenderData {
  id: string
  type: string
  props: Record<string, unknown>
  scope: string
  overrides?: Record<string, unknown> | null
  reviewProps?: Record<string, unknown> | null
  reviewOverrides?: Record<string, unknown> | null
  aiReviewProps?: Record<string, unknown> | null
  aiReviewOverrides?: Record<string, unknown> | null
  globalSlug?: string | null
  globalLabel?: string | null
  locked?: boolean
  orderIndex: number
  reviewAdded?: boolean
  reviewDeleted?: boolean
  aiReviewAdded?: boolean
  aiReviewDeleted?: boolean
}

/**
 * Author data
 */
export interface AuthorData {
  id: number
  email: string
  fullName: string | null
  profileUrl?: string | null
  customFields?: Record<string, any>
}

/**
 * Post data for rendering
 */
export interface PostRenderData {
  id: string
  type: string
  locale: string
  slug: string
  title: string
  excerpt: string | null
  metaTitle: string | null
  metaDescription: string | null
  socialTitle: string | null
  socialDescription: string | null
  socialImageId: string | null
  noindex: boolean
  nofollow: boolean
  status: string
  author: AuthorData | null
  featuredImageId?: string | null
  reviewDraft?: Record<string, unknown> | null
  aiReviewDraft?: Record<string, unknown> | null
}

/**
 * Full page data for rendering
 */
import { coerceJsonObject } from '../helpers/jsonb.js'

export interface PageRenderData {
  post: PostRenderData
  modules: Array<{
    id: string
    type: string
    componentName: string
    renderingMode: 'static' | 'react' | 'hybrid'
    props: Record<string, unknown>
    html?: string
    sourceProps?: Record<string, unknown> | null
    sourceOverrides?: Record<string, unknown> | null
    reviewProps?: Record<string, unknown> | null
    aiReviewProps?: Record<string, unknown> | null
    overrides?: Record<string, unknown> | null
    reviewOverrides?: Record<string, unknown> | null
    aiReviewOverrides?: Record<string, unknown> | null
    reviewAdded?: boolean
    reviewDeleted?: boolean
    aiReviewAdded?: boolean
    aiReviewDeleted?: boolean
  }>
  seo: PostSeoData
  siteSettings: Record<string, unknown>
  customFields?: Record<string, any>
  hasReviewDraft: boolean
  breadcrumbTrail?: Array<{ label: string; url: string; current?: boolean }>
}

/**
 * Post Rendering Service
 *
 * Centralizes logic for preparing post data for view rendering.
 * Used by both public post viewing and admin preview.
 */
class PostRenderingService {
  /**
   * Load post modules with optional review context
   */
  async loadPostModules(
    postId: string,
    options: { includeReviewFields?: boolean } = {}
  ): Promise<ModuleRenderData[]> {
    const { includeReviewFields = false } = options

    const rows = await PostModule.query()
      .where('postId', postId)
      .orderBy('orderIndex', 'asc')
      .preload('moduleInstance')

    return rows.map((row) => {
      const module = row.moduleInstance
      return {
        id: row.id,
        type: module?.type || 'unknown',
        scope: module?.scope || 'post',
        props: coerceJsonObject((module as any)?.props),
        overrides: coerceJsonObject(row.overrides),
        reviewProps:
          includeReviewFields && (module as any)?.reviewProps
            ? coerceJsonObject((module as any).reviewProps)
            : null,
        reviewOverrides:
          includeReviewFields && row.reviewOverrides ? coerceJsonObject(row.reviewOverrides) : null,
        aiReviewProps:
          includeReviewFields && (module as any)?.aiReviewProps
            ? coerceJsonObject((module as any).aiReviewProps)
            : null,
        aiReviewOverrides:
          includeReviewFields && (row as any).aiReviewOverrides
            ? coerceJsonObject((row as any).aiReviewOverrides)
            : null,
        locked: row.locked,
        orderIndex: row.orderIndex,
        globalSlug: module?.globalSlug || (module as any)?.global_slug || null,
        globalLabel: module?.globalLabel || (module as any)?.global_label || null,
        reviewAdded: includeReviewFields ? row.reviewAdded || false : false,
        reviewDeleted: includeReviewFields ? row.reviewDeleted || false : false,
        aiReviewAdded: includeReviewFields ? (row as any).aiReviewAdded || false : false,
        aiReviewDeleted: includeReviewFields ? (row as any).aiReviewDeleted || false : false,
      }
    })
  }

  /**
   * Build modules array for view, applying review context if needed
   */
  async buildModulesForView(
    modules: ModuleRenderData[],
    options: {
      wantReview?: boolean
      reviewDraft?: Record<string, unknown> | null
      draftMode?: 'review' | 'ai-review' | 'auto'
      featuredImageId?: string | null
    } = {}
  ): Promise<{
    modules: Array<{
      id: string
      type: string
      componentName: string
      renderingMode: 'static' | 'react' | 'hybrid'
      props: Record<string, unknown>
      html?: string
      sourceProps?: Record<string, unknown> | null
      sourceOverrides?: Record<string, unknown> | null
      reviewProps?: Record<string, unknown> | null
      aiReviewProps?: Record<string, unknown> | null
      overrides?: Record<string, unknown> | null
      reviewOverrides?: Record<string, unknown> | null
      aiReviewOverrides?: Record<string, unknown> | null
      reviewAdded?: boolean
      reviewDeleted?: boolean
      aiReviewAdded?: boolean
      aiReviewDeleted?: boolean
    }>
    resolvedMedia: Map<string, any>
  }> {
    let {
      wantReview = false,
      reviewDraft = null,
      draftMode = 'review',
      featuredImageId = null,
    } = options

    // If not in review mode, check if we need to fall back to AI Review content
    if (!wantReview) {
      const hasApprovedModules = modules.some(
        (pm) =>
          pm.reviewAdded !== true &&
          (pm as any).aiReviewAdded !== true &&
          !pm.reviewDeleted &&
          !(pm as any).aiReviewDeleted
      )
      const hasAiReviewContent = modules.some(
        (pm) => (pm as any).aiReviewProps || (pm as any).aiReviewOverrides
      )

      // If no approved modules but AI Review content exists, use AI Review as fallback
      if (!hasApprovedModules && hasAiReviewContent) {
        wantReview = true
        draftMode = 'ai-review'
        // Clear reviewDraft since we're using AI Review mode
        reviewDraft = null
      }
    }

    // Get removed module IDs from review draft
    const removedInReview = new Set<string>(
      wantReview && reviewDraft && Array.isArray((reviewDraft as any).removedModuleIds)
        ? (reviewDraft as any).removedModuleIds
        : []
    )

    const filtered = modules
      .filter((pm) => !removedInReview.has(pm.id))
      .filter((pm) => !(wantReview && pm.reviewDeleted === true))
      .filter((pm) => {
        if (wantReview) return true
        // When not in review mode, only show approved modules (not in review/AI review)
        return pm.reviewAdded !== true && (pm as any).aiReviewAdded !== true
      })

    const moduleStates = filtered.map((pm) => {
      const useReviewDraft = (() => {
        if (!wantReview) return false
        if (draftMode === 'ai-review') return false
        return true
      })()

      const useAiReviewDraft = (() => {
        if (!wantReview) return false
        if (draftMode === 'review') return false
        return draftMode === 'ai-review' || (draftMode === 'auto' && !reviewDraft)
      })()

      const module = moduleRegistry.get(pm.type)
      const defaultProps = (module?.getConfig?.().defaultValues || {}) as Record<string, unknown>

      const draftModulesArray = (reviewDraft as any)?.modules || []
      const draftModuleState = Array.isArray(draftModulesArray)
        ? draftModulesArray.find((dm: any) => dm.id === pm.id)
        : null

      let mergedProps: Record<string, unknown>

      if (useReviewDraft) {
        if (draftModuleState) {
          const baseProps = coerceJsonObject(draftModuleState.props)
          const overrides = coerceJsonObject(draftModuleState.overrides)
          mergedProps = { ...defaultProps, ...(baseProps as any), ...(overrides as any) }
        } else {
          // If the module instance itself has review props (global or local), use them.
          // Note: for global modules, these are stored on the moduleInstance.
          const reviewProps = (pm as any).reviewProps
          const hasReviewProps = reviewProps && Object.keys(reviewProps).length > 0
          const baseProps = hasReviewProps ? reviewProps : pm.props || {}

          const reviewOverrides = (pm as any).reviewOverrides
          const hasReviewOverrides = reviewOverrides && Object.keys(reviewOverrides).length > 0
          const overrides = hasReviewOverrides ? reviewOverrides : (pm as any).overrides || {}

          // For global modules, we want to prioritize the global props (baseProps)
          // and only apply overrides if they are actually DIFFERENT from the baseProps
          // or are not part of the defaultProps.
          if (pm.scope === 'global') {
            const filteredOverrides: Record<string, any> = {}
            Object.keys(overrides).forEach((key) => {
              if (
                overrides[key] !== undefined &&
                overrides[key] !== null &&
                overrides[key] !== defaultProps[key]
              ) {
                filteredOverrides[key] = overrides[key]
              }
            })
            mergedProps = { ...defaultProps, ...(baseProps as any), ...filteredOverrides }
          } else {
            mergedProps = { ...defaultProps, ...(baseProps as any), ...(overrides as any) }
          }
        }
      } else if (useAiReviewDraft) {
        if (draftModuleState) {
          const baseProps = coerceJsonObject(draftModuleState.props)
          const overrides = coerceJsonObject(draftModuleState.overrides)
          mergedProps = { ...defaultProps, ...(baseProps as any), ...(overrides as any) }
        } else {
          const aiReviewProps = (pm as any).aiReviewProps
          const hasAiReviewProps = aiReviewProps && Object.keys(aiReviewProps).length > 0
          const baseProps = hasAiReviewProps ? aiReviewProps : pm.props || {}

          const aiReviewOverrides = (pm as any).aiReviewOverrides
          const hasAiReviewOverrides =
            aiReviewOverrides && Object.keys(aiReviewOverrides).length > 0
          const overrides = hasAiReviewOverrides ? aiReviewOverrides : (pm as any).overrides || {}

          if (pm.scope === 'global') {
            const filteredOverrides: Record<string, any> = {}
            Object.keys(overrides).forEach((key) => {
              if (
                overrides[key] !== undefined &&
                overrides[key] !== null &&
                overrides[key] !== defaultProps[key]
              ) {
                filteredOverrides[key] = overrides[key]
              }
            })
            mergedProps = { ...defaultProps, ...(baseProps as any), ...filteredOverrides }
          } else {
            mergedProps = { ...defaultProps, ...(baseProps as any), ...(overrides as any) }
          }
        }
      } else {
        const baseProps = pm.props || {}
        const overrides = (pm as any).overrides || {}

        if (pm.scope === 'global') {
          const filteredOverrides: Record<string, any> = {}
          Object.keys(overrides).forEach((key) => {
            if (
              overrides[key] !== undefined &&
              overrides[key] !== null &&
              overrides[key] !== defaultProps[key]
            ) {
              filteredOverrides[key] = overrides[key]
            }
          })
          mergedProps = { ...defaultProps, ...(baseProps as any), ...filteredOverrides }
        } else {
          mergedProps = { ...defaultProps, ...(baseProps as any), ...(overrides as any) }
        }
      }

      return { pm, mergedProps, module }
    })

    // Batch resolve post references across all modules for performance
    const allPostIds = new Set<string>()
    const allMediaIds = new Set<string>()

    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    if (featuredImageId && uuidRegex.test(featuredImageId)) {
      allMediaIds.add(featuredImageId.toLowerCase())
    }

    const extractPostIds = (obj: any) => {
      if (!obj || typeof obj !== 'object') return
      if (obj.kind === 'post' && obj.postId) allPostIds.add(String(obj.postId))
      if (Array.isArray(obj)) obj.forEach(extractPostIds)
      else Object.values(obj).forEach(extractPostIds)
    }

    moduleStates.forEach((s) => {
      const fieldSchema = s.module.getConfig().fieldSchema || []
      extractPostIds(s.mergedProps)
      this.extractMediaIdsFromProps(fieldSchema, s.mergedProps, allMediaIds)

      // Also extract from source/review props and overrides
      if (s.pm.props) {
        this.extractMediaIdsFromProps(fieldSchema, s.pm.props, allMediaIds)
      }
      if (s.pm.overrides) {
        this.extractMediaIdsFromProps(fieldSchema, s.pm.overrides, allMediaIds)
      }
      if (s.pm.reviewProps) {
        this.extractMediaIdsFromProps(fieldSchema, s.pm.reviewProps, allMediaIds)
      }
      if (s.pm.reviewOverrides) {
        this.extractMediaIdsFromProps(fieldSchema, s.pm.reviewOverrides, allMediaIds)
      }
      if (s.pm.aiReviewProps) {
        this.extractMediaIdsFromProps(fieldSchema, s.pm.aiReviewProps, allMediaIds)
      }
      if (s.pm.aiReviewOverrides) {
        this.extractMediaIdsFromProps(fieldSchema, s.pm.aiReviewOverrides, allMediaIds)
      }
    })

    const [resolvedPaths, resolvedMedia] = await Promise.all([
      urlPatternService.buildPostPaths(Array.from(allPostIds)),
      this.resolveMediaAssets(Array.from(allMediaIds)),
    ])

    const injectResolved = (obj: any): any => {
      if (!obj || typeof obj !== 'object') return obj
      if (obj.kind === 'post' && obj.postId) {
        const path = resolvedPaths.get(String(obj.postId))
        if (path) {
          return { kind: 'url', url: path, target: obj.target || '_self' }
        }
        return obj
      }
      if (Array.isArray(obj)) return obj.map(injectResolved)
      const out: any = {}
      for (const [k, v] of Object.entries(obj)) out[k] = injectResolved(v)
      return out
    }

    const renderedModules = moduleStates.map(({ pm, mergedProps, module }) => {
      const fieldSchema = module.getConfig().fieldSchema || []
      const propsWithPosts = injectResolved(mergedProps)
      let finalProps = this.injectResolvedMedia(fieldSchema, propsWithPosts, resolvedMedia)

      // Helper to apply Hero fallback to a prop set
      const applyHeroFallback = (props: any) => {
        const hasNoUsableImage =
          !props.image ||
          (typeof props.image === 'string' && uuidRegex.test(props.image)) ||
          (typeof props.image === 'object' && !props.image.url)

        if (
          (pm.type === 'hero-with-media' || pm.type === 'HeroWithMedia') &&
          hasNoUsableImage &&
          featuredImageId
        ) {
          const fallbackAsset = resolvedMedia.get(featuredImageId.toLowerCase())
          if (fallbackAsset) {
            return { ...props, image: fallbackAsset }
          }
        }
        return props
      }

      // Apply fallback logic to finalProps
      finalProps = applyHeroFallback(finalProps)

      const componentName = module.getComponentName()

      // Resolve rendering mode (hybrid logic)
      let renderingMode = module.getRenderingMode()
      if (renderingMode === 'hybrid') {
        renderingMode = finalProps._useReact === true ? 'react' : 'static'
      }

      // Resolve media in all prop/override sets so InlineEditorContext sees resolved objects
      // Note: we include defaultProps here so the Inline Editor has the full set of values
      const defaultProps = module.getConfig().defaultValues || {}

      // Helper to filter overrides for global modules
      const filterOverrides = (overrides: Record<string, any> | null | undefined) => {
        if (!overrides || pm.scope !== 'global') return overrides
        const filtered: Record<string, any> = {}
        Object.keys(overrides).forEach((key) => {
          if (
            overrides[key] !== undefined &&
            overrides[key] !== null &&
            overrides[key] !== defaultProps[key]
          ) {
            filtered[key] = overrides[key]
          }
        })
        return Object.keys(filtered).length > 0 ? filtered : null
      }

      let sourcePropsResolved = this.injectResolvedMedia(
        fieldSchema,
        injectResolved({ ...defaultProps, ...(pm.props || {}) }),
        resolvedMedia
      )
      if (sourcePropsResolved) {
        sourcePropsResolved = applyHeroFallback(sourcePropsResolved)
      }

      let sourceOverridesResolved =
        pm.overrides && Object.keys(pm.overrides).length > 0
          ? this.injectResolvedMedia(
              fieldSchema,
              injectResolved(filterOverrides(pm.overrides)),
              resolvedMedia
            )
          : null
      if (sourceOverridesResolved) {
        sourceOverridesResolved = applyHeroFallback(sourceOverridesResolved)
      }

      let reviewPropsResolved =
        (pm as any).reviewProps && Object.keys((pm as any).reviewProps).length > 0
          ? this.injectResolvedMedia(
              fieldSchema,
              injectResolved({ ...defaultProps, ...(pm as any).reviewProps }),
              resolvedMedia
            )
          : sourcePropsResolved
      if (reviewPropsResolved) {
        reviewPropsResolved = applyHeroFallback(reviewPropsResolved)
      }

      let reviewOverridesResolved =
        (pm as any).reviewOverrides && Object.keys((pm as any).reviewOverrides).length > 0
          ? this.injectResolvedMedia(
              fieldSchema,
              injectResolved(filterOverrides((pm as any).reviewOverrides)),
              resolvedMedia
            )
          : sourceOverridesResolved
      if (reviewOverridesResolved) {
        reviewOverridesResolved = applyHeroFallback(reviewOverridesResolved)
      }

      let aiReviewPropsResolved =
        (pm as any).aiReviewProps && Object.keys((pm as any).aiReviewProps).length > 0
          ? this.injectResolvedMedia(
              fieldSchema,
              injectResolved({ ...defaultProps, ...(pm as any).aiReviewProps }),
              resolvedMedia
            )
          : reviewPropsResolved || sourcePropsResolved
      if (aiReviewPropsResolved) {
        aiReviewPropsResolved = applyHeroFallback(aiReviewPropsResolved)
      }

      let aiReviewOverridesResolved =
        (pm as any).aiReviewOverrides && Object.keys((pm as any).aiReviewOverrides).length > 0
          ? this.injectResolvedMedia(
              fieldSchema,
              injectResolved(filterOverrides((pm as any).aiReviewOverrides)),
              resolvedMedia
            )
          : reviewOverridesResolved || sourceOverridesResolved
      if (aiReviewOverridesResolved) {
        aiReviewOverridesResolved = applyHeroFallback(aiReviewOverridesResolved)
      }

      return {
        id: pm.id,
        type: pm.type,
        scope: pm.scope || 'post',
        globalSlug: pm.globalSlug || null,
        globalLabel: pm.globalLabel || null,
        componentName,
        renderingMode,
        props: finalProps,
        sourceProps: sourcePropsResolved,
        sourceOverrides: sourceOverridesResolved,
        reviewProps: reviewPropsResolved,
        aiReviewProps: aiReviewPropsResolved,
        overrides: sourceOverridesResolved, // Map sourceOverrides to overrides for consistency
        reviewOverrides: reviewOverridesResolved,
        aiReviewOverrides: aiReviewOverridesResolved,
        reviewAdded: pm.reviewAdded || false,
        reviewDeleted: pm.reviewDeleted || false,
        aiReviewAdded: pm.aiReviewAdded || false,
        aiReviewDeleted: pm.aiReviewDeleted || false,
      }
    })

    return { modules: renderedModules, resolvedMedia }
  }

  /**
   * Load author data for a post
   */
  async loadAuthor(
    authorId: number | null | undefined,
    options: { locale?: string; protocol?: string; host?: string } = {}
  ): Promise<AuthorData | null> {
    if (!authorId) return null

    const { locale, protocol = 'https', host = 'localhost' } = options

    try {
      const row = await db.from('users').where('id', authorId).first()
      if (row) {
        const author: AuthorData = {
          id: Number(row.id),
          email: row.email,
          fullName: row.full_name ?? null,
          customFields: {},
        }

        // Try to find a profile post for this user
        // We look for a post of type 'profile' where author_id is this user
        const profilePost = await Post.query()
          .where('type', 'profile')
          .where('authorId', authorId)
          .where('status', 'published')
          .if(locale, (q) => q.where('locale', locale!))
          .first()

        if (profilePost) {
          // Resolve profile URL
          author.profileUrl = await urlPatternService.buildPostUrlForPost(
            profilePost.id,
            protocol,
            host
          )

          // Load custom fields for the profile
          const cfRows = await db
            .from('post_custom_field_values')
            .where('post_id', profilePost.id)
            .select('field_slug', 'value')

          cfRows.forEach((cf) => {
            if (author.customFields) {
              author.customFields[cf.field_slug] = cf.value
            }
          })
        }

        return author
      }
    } catch (e) {
      console.error('[PostRenderingService] Failed to load author:', e)
    }
    return null
  }

  /**
   * Build SEO data for a post
   */
  async buildSeoData(
    post: Post,
    options: {
      protocol: string
      host: string
      wantReview?: boolean
      reviewDraft?: Record<string, unknown> | null
      modules?: any[]
    }
  ): Promise<PostSeoData> {
    const { protocol, host, wantReview = false, reviewDraft = null, modules = [] } = options
    const useReview = wantReview && reviewDraft

    // Build canonical URL
    const canonical = await urlPatternService.buildPostUrlForPost(post.id, protocol, host)

    // Build alternates for translations
    const baseId = post.translationOfId || post.id
    const family = await Post.query().where((q) => {
      q.where('translationOfId', baseId).orWhere('id', baseId)
    })

    const alternates = await Promise.all(
      family.map(async (p) => ({
        locale: p.locale,
        href: await urlPatternService.buildPostUrlForPost(p.id, protocol, host),
      }))
    )

    // Build robots directive
    const robotsConfig = {
      ...(post.robotsJson || DEFAULT_ROBOTS[post.status] || DEFAULT_ROBOTS.draft),
    }
    if (useReview) {
      if ((reviewDraft as any).noindex !== undefined)
        robotsConfig.index = !(reviewDraft as any).noindex
      if ((reviewDraft as any).nofollow !== undefined)
        robotsConfig.follow = !(reviewDraft as any).nofollow
    } else {
      if (post.noindex) robotsConfig.index = false
      if (post.nofollow) robotsConfig.follow = false
    }
    const robots = robotsConfigToString(robotsConfig)

    // Build JSON-LD
    const title = useReview
      ? ((reviewDraft as any).metaTitle ??
        (reviewDraft as any).title ??
        post.metaTitle ??
        post.title)
      : post.metaTitle || post.title
    const description = useReview
      ? ((reviewDraft as any).metaDescription ?? post.metaDescription)
      : post.metaDescription

    // Social (OG/Twitter)
    const socialTitle = useReview
      ? ((reviewDraft as any).socialTitle ?? title)
      : post.socialTitle || title
    const socialDescription = useReview
      ? ((reviewDraft as any).socialDescription ?? description)
      : post.socialDescription || description
    const socialImageId = useReview
      ? ((reviewDraft as any).socialImageId ??
        (reviewDraft as any).featuredImageId ??
        post.socialImageId ??
        post.featuredImageId)
      : post.socialImageId || post.featuredImageId

    let socialImageUrl: string | undefined
    if (socialImageId) {
      const asset = await MediaAsset.find(socialImageId)
      if (asset) {
        socialImageUrl = asset.url
      }
    }

    let schemaType = 'BlogPosting'
    const schemaExtras: Record<string, any> = {}

    // Special handling for Local SEO on 'company' post type
    if (post.type === 'company') {
      schemaType = 'LocalBusiness'
      // Load custom fields to populate schema
      const fieldRows = await db
        .from('post_custom_field_values')
        .where('post_id', post.id)
        .select('field_slug', 'value')
      const fields = new Map(fieldRows.map((r) => [r.field_slug, r.value]))

      if (fields.has('address'))
        schemaExtras.address = { '@type': 'PostalAddress', 'streetAddress': fields.get('address') }
      if (fields.has('phone')) schemaExtras.telephone = fields.get('phone')
      if (fields.has('openingHours')) schemaExtras.openingHours = fields.get('openingHours')
      if (fields.has('geo')) {
        const coords = String(fields.get('geo'))
          .split(',')
          .map((s) => s.trim())
        if (coords.length === 2) {
          schemaExtras.geo = {
            '@type': 'GeoCoordinates',
            'latitude': coords[0],
            'longitude': coords[1],
          }
        }
      }
    }

    const defaultJsonLd: Record<string, unknown> = {
      '@context': 'https://schema.org',
      '@type': schemaType,
      'headline': title,
      'inLanguage': post.locale,
      'mainEntityOfPage': canonical,
      ...(description && { description }),
      ...schemaExtras,
    }

    // Collect ItemList from modules (e.g. Company List)
    const jsonLdGraph: any[] = [{ ...defaultJsonLd, ...(post.jsonldOverrides || {}) }]

    const companyListModules = modules.filter((m) => m.type === 'company-list')
    if (companyListModules.length > 0) {
      const allCompanyIds = new Set<string>()
      let fetchAll = false
      for (const m of companyListModules) {
        const ids = Array.isArray(m.props?.companies) ? m.props.companies : []
        if (ids.length === 0) {
          fetchAll = true
          break
        }
        ids.forEach((id: string) => allCompanyIds.add(String(id)))
      }

      const companiesQuery = Post.query()
        .where('type', 'company')
        .where('status', 'published')
        .preload('customFieldValues')

      if (!fetchAll && allCompanyIds.size > 0) {
        companiesQuery.whereIn('id', Array.from(allCompanyIds))
      }

      if (fetchAll || allCompanyIds.size > 0) {
        const companies = await companiesQuery.orderBy('title', 'asc').limit(fetchAll ? 50 : 100)

        if (companies.length > 0) {
          const itemList: any = {
            '@type': 'ItemList',
            'itemListElement': companies.map((c, idx) => {
              const fields = new Map(c.customFieldValues.map((v) => [v.fieldSlug, v.value]))
              const cExtras: Record<string, any> = {}
              if (fields.has('address'))
                cExtras.address = {
                  '@type': 'PostalAddress',
                  'streetAddress': fields.get('address'),
                }
              if (fields.has('phone')) cExtras.telephone = fields.get('phone')

              return {
                '@type': 'ListItem',
                'position': idx + 1,
                'item': {
                  '@type': 'LocalBusiness',
                  'name': c.title,
                  ...cExtras,
                },
              }
            }),
          }
          jsonLdGraph.push(itemList)
        }
      }
    }

    const jsonLd =
      jsonLdGraph.length === 1
        ? jsonLdGraph[0]
        : {
            '@context': 'https://schema.org',
            '@graph': jsonLdGraph,
          }

    return {
      canonical,
      alternates,
      robots,
      jsonLd,
      og: {
        title: socialTitle,
        description: socialDescription || undefined,
        url: canonical,
        type: 'article',
        image: socialImageUrl,
      },
      twitter: {
        card: 'summary_large_image',
        title: socialTitle,
        description: socialDescription || undefined,
        image: socialImageUrl,
      },
    }
  }

  /**
   * Resolve post fields with review draft fallback
   */
  resolvePostFields(
    post: Post,
    options: {
      wantReview?: boolean
      reviewDraft?: Record<string, unknown> | null
    } = {}
  ): PostRenderData {
    const { wantReview = false, reviewDraft = null } = options
    const useReview = wantReview && reviewDraft

    return {
      id: post.id,
      type: post.type,
      locale: post.locale,
      slug: useReview ? ((reviewDraft as any).slug ?? post.slug) : post.slug,
      title: useReview ? ((reviewDraft as any).title ?? post.title) : post.title,
      excerpt: useReview ? ((reviewDraft as any).excerpt ?? post.excerpt) : post.excerpt,
      metaTitle: useReview ? ((reviewDraft as any).metaTitle ?? post.metaTitle) : post.metaTitle,
      metaDescription: useReview
        ? ((reviewDraft as any).metaDescription ?? post.metaDescription)
        : post.metaDescription,
      socialTitle: useReview
        ? ((reviewDraft as any).socialTitle ?? post.socialTitle)
        : post.socialTitle,
      socialDescription: useReview
        ? ((reviewDraft as any).socialDescription ?? post.socialDescription)
        : post.socialDescription,
      socialImageId: useReview
        ? ((reviewDraft as any).socialImageId ?? post.socialImageId)
        : post.socialImageId,
      noindex: useReview
        ? Boolean((reviewDraft as any).noindex ?? post.noindex)
        : Boolean(post.noindex),
      nofollow: useReview
        ? Boolean((reviewDraft as any).nofollow ?? post.nofollow)
        : Boolean(post.nofollow),
      status: post.status,
      author: null, // To be filled by caller
      featuredImageId: useReview
        ? ((reviewDraft as any).featuredImageId ?? post.featuredImageId)
        : post.featuredImageId,
      reviewDraft: (post as any).reviewDraft || (post as any).review_draft || null,
      aiReviewDraft: (post as any).aiReviewDraft || (post as any).ai_review_draft || null,
    }
  }

  /**
   * Build complete page render data
   */
  async buildPageData(
    post: Post,
    options: {
      protocol: string
      host: string
      wantReview?: boolean
      draftMode?: 'review' | 'ai-review' | 'auto'
    } = { protocol: 'https', host: 'localhost' }
  ): Promise<PageRenderData> {
    const reviewDraft = (post as any).reviewDraft || (post as any).review_draft || null
    const aiReviewDraft = (post as any).aiReviewDraft || (post as any).ai_review_draft || null
    const { wantReview = false, draftMode = 'review' } = options

    // Load site settings and custom fields first for token resolution
    const siteSettings = await siteSettingsService.get()
    const customFieldRows = await db
      .from('post_custom_field_values')
      .where('post_id', post.id)
      .select('field_slug', 'value')
    const customFields: Record<string, any> = {}
    customFieldRows.forEach((row) => {
      customFields[row.field_slug] = row.value
    })

    // Pre-resolve media IDs in site settings if they exist
    const siteMediaIds = new Set<string>()
    if (siteSettings.logoMediaId) siteMediaIds.add(siteSettings.logoMediaId)
    if (siteSettings.faviconMediaId) siteMediaIds.add(siteSettings.faviconMediaId)
    if (siteSettings.defaultOgMediaId) siteMediaIds.add(siteSettings.defaultOgMediaId)

    const siteResolvedMedia = await this.resolveMediaAssets(Array.from(siteMediaIds))
    const siteSettingsWithMedia = {
      ...siteSettings,
      logoMedia: siteSettings.logoMediaId ? siteResolvedMedia.get(siteSettings.logoMediaId) : null,
      faviconMedia: siteSettings.faviconMediaId
        ? siteResolvedMedia.get(siteSettings.faviconMediaId)
        : null,
      defaultOgMedia: siteSettings.defaultOgMediaId
        ? siteResolvedMedia.get(siteSettings.defaultOgMediaId)
        : null,
    }

    // Load author
    const authorId = (post as any).authorId || (post as any).author_id
    const author = await this.loadAuthor(authorId, {
      locale: post.locale,
      protocol: options.protocol,
      host: options.host,
    })

    // Resolve post fields (handles drafts and fallback logic)
    const postData = this.resolvePostFields(post, {
      wantReview,
      reviewDraft: draftMode === 'ai-review' ? (aiReviewDraft as any) : reviewDraft,
    })
    postData.author = author

    const tokenContext = {
      post, // Use raw model (published/base values) for initial token resolution
      author,
      siteSettings: siteSettingsWithMedia,
      customFields,
    }

    // Load modules
    const modulesRaw = await this.loadPostModules(post.id, { includeReviewFields: true })
    const { modules } = await this.buildModulesForView(modulesRaw, {
      wantReview,
      reviewDraft:
        draftMode === 'ai-review'
          ? (aiReviewDraft as any)
          : draftMode === 'auto'
            ? (reviewDraft as any) || (aiReviewDraft as any)
            : (reviewDraft as any),
      draftMode: draftMode === 'auto' ? (reviewDraft ? 'review' : 'ai-review') : draftMode,
      featuredImageId: postData.featuredImageId,
    })

    // Resolve tokens in post data (title, excerpt, meta fields)
    // Note: this uses the raw post in context to avoid recursion if draft contains tokens
    const resolvedPostData = tokenService.resolveRecursive(postData, tokenContext)

    // Update tokenContext with the resolved post data for module/SEO resolution
    // This allows modules to see draft values for fields other than themselves
    tokenContext.post = resolvedPostData

    // Resolve tokens in modules
    const resolvedModules = modules.map((m) => ({
      ...m,
      props: tokenService.resolveRecursive(m.props, tokenContext),
      overrides: tokenService.resolveRecursive(m.overrides, tokenContext),
      sourceProps: tokenService.resolveRecursive(m.sourceProps, tokenContext),
      sourceOverrides: tokenService.resolveRecursive(m.sourceOverrides, tokenContext),
      reviewProps: tokenService.resolveRecursive(m.reviewProps, tokenContext),
      reviewOverrides: tokenService.resolveRecursive(m.reviewOverrides, tokenContext),
      aiReviewProps: tokenService.resolveRecursive(m.aiReviewProps, tokenContext),
      aiReviewOverrides: tokenService.resolveRecursive(m.aiReviewOverrides, tokenContext),
    }))

    // Build SEO
    // SEO is currently derived from reviewDraft; for AI review previews, fall back to aiReviewDraft
    const seoRaw = await this.buildSeoData(post, {
      ...options,
      reviewDraft: draftMode === 'ai-review' ? (aiReviewDraft as any) : reviewDraft,
      modules: resolvedModules,
    })
    // Resolve tokens in SEO (canonical URL, meta titles, OG fields)
    const seo = tokenService.resolveRecursive(seoRaw, tokenContext)

    // Build breadcrumb trail from hierarchy
    const breadcrumbTrail = await this.buildBreadcrumbTrail(post)

    return {
      post: resolvedPostData,
      modules: resolvedModules,
      seo,
      siteSettings: siteSettingsWithMedia as Record<string, unknown>,
      customFields,
      hasReviewDraft: Boolean(reviewDraft || aiReviewDraft),
      breadcrumbTrail,
    }
  }

  /**
   * Extract media IDs from module props based on its field schema
   */
  private extractMediaIdsFromProps(schema: any[], props: any, mediaIds: Set<string>): void {
    if (!props || typeof props !== 'object' || !schema) return

    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

    for (const field of schema) {
      const value = props[field.slug]
      if (!value) continue

      if (field.type === 'media') {
        const id = typeof value === 'string' ? value : (value as any)?.id
        if (typeof id === 'string' && uuidRegex.test(id)) {
          mediaIds.add(id.toLowerCase())
        }
      } else if (field.type === 'object' && field.fields) {
        this.extractMediaIdsFromProps(field.fields, value, mediaIds)
      } else if (field.type === 'repeater' && field.item) {
        if (Array.isArray(value)) {
          value.forEach((item) => {
            if (field.item.fields) {
              this.extractMediaIdsFromProps(field.item.fields, item, mediaIds)
            } else if (field.item.type === 'media') {
              const id = typeof item === 'string' ? item : (item as any)?.id
              if (typeof id === 'string' && uuidRegex.test(id)) {
                mediaIds.add(id.toLowerCase())
              }
            }
          })
        }
      }
    }
  }

  /**
   * Inject resolved media objects into module props
   */
  private injectResolvedMedia(schema: any[], props: any, resolvedMedia: Map<string, any>): any {
    if (!props || typeof props !== 'object' || !schema) return props

    const out = { ...props }
    for (const field of schema) {
      const value = out[field.slug]
      if (!value) continue

      if (field.type === 'media') {
        const id = typeof value === 'string' ? value : (value as any)?.id
        if (typeof id === 'string') {
          const asset = resolvedMedia.get(id.toLowerCase())
          if (asset) {
            out[field.slug] = asset
          }
        }
      } else if (field.type === 'object' && field.fields) {
        out[field.slug] = this.injectResolvedMedia(field.fields, value, resolvedMedia)
      } else if (field.type === 'repeater' && field.item) {
        if (Array.isArray(value)) {
          out[field.slug] = value.map((item) => {
            if (field.item.fields) {
              return this.injectResolvedMedia(field.item.fields, item, resolvedMedia)
            } else if (field.item.type === 'media') {
              const id = typeof item === 'string' ? item : (item as any)?.id
              if (typeof id === 'string') {
                const asset = resolvedMedia.get(id.toLowerCase())
                if (asset) return asset
              }
              return item
            }
            return item
          })
        }
      }
    }
    return out
  }

  /**
   * Batch resolve media IDs to asset objects
   */
  async resolveMediaAssets(ids: string[]): Promise<Map<string, any>> {
    const map = new Map<string, any>()
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    const uniqueIds = Array.from(new Set(ids.filter((id) => id && uuidRegex.test(id))))
    if (uniqueIds.length === 0) return map

    try {
      const assets = await MediaAsset.query().whereIn('id', uniqueIds)
      assets.forEach((asset) => {
        const id = String(asset.id).toLowerCase()
        map.set(id, {
          id: asset.id,
          url: asset.url,
          mimeType: asset.mimeType,
          altText: asset.altText,
          metadata: asset.metadata || {},
        })
      })
    } catch (e) {
      console.error('[PostRenderingService] Failed to resolve media assets:', e)
    }

    return map
  }

  /**
   * Build breadcrumb trail from post hierarchy
   *
   * @param post - Current post
   * @returns Array of breadcrumb items from root to current post
   */
  private async buildBreadcrumbTrail(
    post: Post
  ): Promise<Array<{ label: string; url: string; current?: boolean }>> {
    const trail: Array<{ label: string; url: string; current?: boolean }> = []

    // Build ancestor chain (from current post up to root)
    const ancestors: Array<{ id: string; title: string; parentId: string | null }> = []
    let currentPostId: string | null = post.id

    // Traverse up the hierarchy (limit to 10 levels to prevent infinite loops)
    let depth = 0
    const maxDepth = 10

    while (currentPostId && depth < maxDepth) {
      // Load post data
      const postData = await db
        .from('posts')
        .select('id', 'title', 'parent_id')
        .where('id', currentPostId)
        .where('status', 'published')
        .first()

      if (!postData) {
        break // Post not found
      }

      // Add to beginning of ancestors array
      ancestors.unshift({
        id: postData.id,
        title: postData.title || 'Untitled',
        parentId: postData.parent_id,
      })

      // Move to parent
      currentPostId = postData.parent_id
      depth++
    }

    // Check for aggregate page for this post type
    const pattern = await urlPatternService.getDefaultPattern(post.type, post.locale)
    if (pattern?.aggregatePostId) {
      // Load aggregate post - we need to find the variation for the current locale
      const Post = (await import('#models/post')).default
      const aggPostBase = await Post.find(pattern.aggregatePostId)

      if (aggPostBase) {
        // Try to find translation for the current locale
        const aggPostVariation = await aggPostBase.getTranslation(post.locale)
        const finalAggPost =
          aggPostVariation || (aggPostBase.locale === post.locale ? aggPostBase : null)

        if (finalAggPost && !ancestors.some((a) => a.id === finalAggPost.id)) {
          // Prepend aggregate page to ancestors
          ancestors.unshift({
            id: finalAggPost.id,
            title: finalAggPost.title || 'Untitled',
            parentId: null,
          })
        }
      }
    }

    // Convert ancestors to breadcrumb items
    const ancestorIds = ancestors.map((a) => a.id)
    const resolvedPaths = await urlPatternService.buildPostPaths(ancestorIds)

    for (let i = 0; i < ancestors.length; i++) {
      const ancestor = ancestors[i]
      const isLast = i === ancestors.length - 1

      // Get the URL for this post
      const url = resolvedPaths.get(String(ancestor.id))

      trail.push({
        label: ancestor.title,
        url: url || '/',
        current: isLast,
      })
    }

    return trail
  }

  /**
   * Extract protocol from request
   */
  getProtocolFromRequest(request: any): string {
    if (typeof request.protocol === 'function') {
      return request.protocol()
    }
    if (typeof request.secure === 'function') {
      return request.secure() ? 'https' : 'http'
    }
    return 'http'
  }

  /**
   * Extract host from request
   */
  getHostFromRequest(request: any): string {
    if (typeof request.host === 'function') {
      return request.host()
    }
    return request.header('host') || 'localhost'
  }
}

const postRenderingService = new PostRenderingService()
export default postRenderingService
