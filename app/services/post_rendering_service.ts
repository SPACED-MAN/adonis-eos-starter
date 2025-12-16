import db from '@adonisjs/lucid/services/db'
import Post from '#models/post'
import PostModule from '#models/post_module'
import urlPatternService from '#services/url_pattern_service'
import siteSettingsService from '#services/site_settings_service'
import moduleRegistry from '#services/module_registry'
import { robotsConfigToString, DEFAULT_ROBOTS, type PostSeoData } from '#types/seo'
import { resolvePostReferences } from '#helpers/resolve_post_references'

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
  status: string
  author: AuthorData | null
}

/**
 * Full page data for rendering
 */
export interface PageRenderData {
  post: PostRenderData
  modules: Array<{
    id: string
    type: string
    componentName: string
    renderingMode: 'static' | 'react'
    props: Record<string, unknown>
    html?: string
  }>
  seo: PostSeoData
  siteSettings: Record<string, unknown>
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
        props: (module as any)?.props || {},
        overrides: row.overrides || null,
        reviewProps: includeReviewFields ? (module as any)?.reviewProps || null : null,
        reviewOverrides: includeReviewFields ? row.reviewOverrides || null : null,
        aiReviewProps: includeReviewFields ? (module as any)?.aiReviewProps || null : null,
        aiReviewOverrides: includeReviewFields ? (row as any).aiReviewOverrides || null : null,
        locked: row.locked,
        orderIndex: row.orderIndex,
        globalSlug: (module as any)?.globalSlug || null,
        globalLabel: (module as any)?.globalLabel || null,
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
    } = {}
  ): Promise<
    Array<{
      id: string
      type: string
      componentName: string
      renderingMode: 'static' | 'react'
      props: Record<string, unknown>
      html?: string
      reviewProps?: Record<string, unknown> | null
      aiReviewProps?: Record<string, unknown> | null
      overrides?: Record<string, unknown> | null
      reviewOverrides?: Record<string, unknown> | null
      aiReviewOverrides?: Record<string, unknown> | null
    }>
  > {
    let { wantReview = false, reviewDraft = null, draftMode = 'review' } = options

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

    const prepared = await Promise.all(
      filtered.map(async (pm) => {
        const isLocal = pm.scope === 'post'

        // Draft selection:
        // - review: only use review_* fields (requires reviewDraft)
        // - ai-review: only use ai_review_* fields (requires aiReviewDraft)
        // - auto: prefer reviewDraft when present; otherwise fall back to ai-review fields
        const useReviewDraft = (() => {
          if (!wantReview) return false
          if (draftMode === 'ai-review') return false
          return Boolean(reviewDraft)
        })()

        const useAiReviewDraft = (() => {
          if (!wantReview) return false
          if (draftMode === 'review') return false
          // auto: use ai-review when no reviewDraft
          return !reviewDraft
        })()

        let mergedProps: Record<string, unknown>

        // Always start from module defaults to prevent SSR crashes when props are partial/malformed.
        // This is especially important for AI-generated drafts.
        const module = moduleRegistry.get(pm.type)
        const defaultProps = (module.getConfig?.().defaultProps || {}) as Record<string, unknown>

        if (useReviewDraft) {
          if (isLocal) {
            const baseProps = (pm as any).reviewProps || pm.props || {}
            const overrides = (pm as any).overrides || {}
            mergedProps = { ...defaultProps, ...(baseProps as any), ...(overrides as any) }
          } else {
            const baseProps = pm.props || {}
            const overrides = (pm as any).reviewOverrides || (pm as any).overrides || {}
            mergedProps = { ...defaultProps, ...(baseProps as any), ...(overrides as any) }
          }
        } else if (useAiReviewDraft) {
          if (isLocal) {
            const baseProps = (pm as any).aiReviewProps || pm.props || {}
            const overrides = (pm as any).overrides || {}
            mergedProps = { ...defaultProps, ...(baseProps as any), ...(overrides as any) }
          } else {
            const baseProps = pm.props || {}
            const overrides = (pm as any).aiReviewOverrides || (pm as any).overrides || {}
            mergedProps = { ...defaultProps, ...(baseProps as any), ...(overrides as any) }
          }
        } else {
          const baseProps = pm.props || {}
          const overrides = (pm as any).overrides || {}
          mergedProps = { ...defaultProps, ...(baseProps as any), ...(overrides as any) }
        }

        // Resolve post references to actual URLs
        mergedProps = await resolvePostReferences(mergedProps)

        // Determine rendering mode
        const componentName = module.getComponentName()
        const renderingMode = module.getRenderingMode()

        return {
          id: pm.id,
          type: pm.type,
          scope: pm.scope || 'post',
          globalSlug: (pm as any)?.globalSlug || null,
          globalLabel: (pm as any)?.globalLabel || null,
          componentName,
          renderingMode,
          props: mergedProps,
          reviewProps: (pm as any).reviewProps || null,
          aiReviewProps: (pm as any).aiReviewProps || null,
          overrides: (pm as any).overrides || null,
          reviewOverrides: (pm as any).reviewOverrides || null,
          aiReviewOverrides: (pm as any).aiReviewOverrides || null,
        }
      })
    )

    return prepared
  }

  /**
   * Load author data for a post
   */
  async loadAuthor(authorId: number | null | undefined): Promise<AuthorData | null> {
    if (!authorId) return null

    try {
      const row = await db.from('users').where('id', authorId).first()
      if (row) {
        return {
          id: Number(row.id),
          email: row.email,
          fullName: row.full_name ?? null,
        }
      }
    } catch {
      // Ignore errors
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
    }
  ): Promise<PostSeoData> {
    const { protocol, host, wantReview = false, reviewDraft = null } = options
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
    const robotsConfig = post.robotsJson || DEFAULT_ROBOTS[post.status] || DEFAULT_ROBOTS.draft
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

    const defaultJsonLd: Record<string, unknown> = {
      '@context': 'https://schema.org',
      '@type': 'BlogPosting',
      'headline': title,
      'inLanguage': post.locale,
      'mainEntityOfPage': canonical,
      ...(description && { description }),
    }
    const jsonLd = { ...defaultJsonLd, ...(post.jsonldOverrides || {}) }

    return {
      canonical,
      alternates,
      robots,
      jsonLd,
      og: {
        title,
        description: description || undefined,
        url: canonical,
        type: 'article',
      },
      twitter: {
        card: 'summary_large_image',
        title,
        description: description || undefined,
      },
    }
  }

  /**
   * Resolve post fields with review draft fallback
   */
  resolvePostFields(
    post: Post,
    options: { wantReview?: boolean; reviewDraft?: Record<string, unknown> | null } = {}
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
      status: post.status,
      author: null, // To be filled by caller
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

    // Load modules
    const modulesRaw = await this.loadPostModules(post.id, { includeReviewFields: true })
    const modules = await this.buildModulesForView(modulesRaw, {
      wantReview,
      reviewDraft: draftMode === 'ai-review' ? null : reviewDraft,
      draftMode: draftMode === 'auto' ? (reviewDraft ? 'review' : 'ai-review') : draftMode,
    })

    // Load author
    const authorId = (post as any).authorId || (post as any).author_id
    const author = await this.loadAuthor(authorId)

    // Build SEO
    // SEO is currently derived from reviewDraft; for AI review previews, fall back to aiReviewDraft
    const seo = await this.buildSeoData(post, {
      ...options,
      reviewDraft: draftMode === 'ai-review' ? (aiReviewDraft as any) : reviewDraft,
    })

    // Load site settings
    const siteSettings = await siteSettingsService.get()

    // Resolve post fields
    const postData = this.resolvePostFields(post, {
      wantReview,
      reviewDraft: draftMode === 'ai-review' ? (aiReviewDraft as any) : reviewDraft,
    })
    postData.author = author

    // Build breadcrumb trail from hierarchy
    const breadcrumbTrail = await this.buildBreadcrumbTrail(post)

    return {
      post: postData,
      modules,
      seo,
      siteSettings: siteSettings as Record<string, unknown>,
      hasReviewDraft: Boolean(reviewDraft || aiReviewDraft),
      breadcrumbTrail,
    }
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

    // Convert ancestors to breadcrumb items
    for (let i = 0; i < ancestors.length; i++) {
      const ancestor = ancestors[i]
      const isLast = i === ancestors.length - 1

      // Get the URL for this post
      const url = await urlPatternService.buildPostPathForPost(ancestor.id)

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
