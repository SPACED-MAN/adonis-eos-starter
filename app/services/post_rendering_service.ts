import db from '@adonisjs/lucid/services/db'
import Post from '#models/post'
import urlPatternService from '#services/url_pattern_service'
import siteSettingsService from '#services/site_settings_service'
import { robotsConfigToString, DEFAULT_ROBOTS, type PostSeoData } from '#types/seo'

/**
 * Module data for rendering
 */
export interface ModuleRenderData {
  id: string
  type: string
  props: Record<string, unknown>
  scope: string
  globalSlug?: string | null
  globalLabel?: string | null
  locked?: boolean
  orderIndex: number
  reviewAdded?: boolean
  reviewDeleted?: boolean
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
  modules: Array<{ id: string; type: string; props: Record<string, unknown> }>
  seo: PostSeoData
  siteSettings: Record<string, unknown>
  hasReviewDraft: boolean
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

    const query = db
      .from('post_modules')
      .join('module_instances', 'post_modules.module_id', 'module_instances.id')
      .where('post_modules.post_id', postId)
      .orderBy('post_modules.order_index', 'asc')

    const columns = [
      'post_modules.id as postModuleId',
      'module_instances.type',
      'module_instances.scope',
      'module_instances.props',
      'post_modules.overrides',
      'post_modules.locked',
      'post_modules.order_index as orderIndex',
      'module_instances.global_slug as globalSlug',
      'module_instances.global_label as globalLabel',
    ]

    if (includeReviewFields) {
      columns.push(
        'post_modules.review_added as reviewAdded',
        'post_modules.review_deleted as reviewDeleted',
        'module_instances.review_props',
        'post_modules.review_overrides'
      )
    }

    const rows = await query.select(...columns)

    return rows.map((row) => ({
      id: row.postModuleId,
      type: row.type,
      scope: row.scope,
      props: row.props || {},
      overrides: row.overrides || null,
      reviewProps: (row as any).review_props || null,
      reviewOverrides: (row as any).review_overrides || null,
      locked: row.locked,
      orderIndex: row.orderIndex,
      globalSlug: row.globalSlug || null,
      globalLabel: row.globalLabel || null,
      reviewAdded: (row as any).reviewAdded || false,
      reviewDeleted: (row as any).reviewDeleted || false,
    }))
  }

  /**
   * Build modules array for view, applying review context if needed
   */
  buildModulesForView(
    modules: ModuleRenderData[],
    options: {
      wantReview?: boolean
      reviewDraft?: Record<string, unknown> | null
    } = {}
  ): Array<{ id: string; type: string; props: Record<string, unknown> }> {
    const { wantReview = false, reviewDraft = null } = options

    // Get removed module IDs from review draft
    const removedInReview = new Set<string>(
      wantReview && reviewDraft && Array.isArray((reviewDraft as any).removedModuleIds)
        ? (reviewDraft as any).removedModuleIds
        : []
    )

    return modules
      .filter((pm) => !removedInReview.has(pm.id))
      .filter((pm) => !(wantReview && pm.reviewDeleted === true))
      .filter((pm) => (wantReview ? true : pm.reviewAdded !== true))
      .map((pm) => {
        const isLocal = pm.scope === 'post'
        const useReview = wantReview && reviewDraft

        if (useReview) {
          if (isLocal) {
            const baseProps = (pm as any).reviewProps || pm.props || {}
            const overrides = (pm as any).overrides || {}
            return { id: pm.id, type: pm.type, props: { ...baseProps, ...overrides } }
          } else {
            const baseProps = pm.props || {}
            const overrides = (pm as any).reviewOverrides || (pm as any).overrides || {}
            return { id: pm.id, type: pm.type, props: { ...baseProps, ...overrides } }
          }
        }

        const baseProps = pm.props || {}
        const overrides = (pm as any).overrides || {}
        return { id: pm.id, type: pm.type, props: { ...baseProps, ...overrides } }
      })
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
    } = { protocol: 'https', host: 'localhost' }
  ): Promise<PageRenderData> {
    const reviewDraft = (post as any).reviewDraft || (post as any).review_draft || null
    const { wantReview = false } = options

    // Load modules
    const modulesRaw = await this.loadPostModules(post.id, { includeReviewFields: true })
    const modules = this.buildModulesForView(modulesRaw, { wantReview, reviewDraft })

    // Load author
    const authorId = (post as any).authorId || (post as any).author_id
    const author = await this.loadAuthor(authorId)

    // Build SEO
    const seo = await this.buildSeoData(post, { ...options, reviewDraft })

    // Load site settings
    const siteSettings = await siteSettingsService.get()

    // Resolve post fields
    const postData = this.resolvePostFields(post, { wantReview, reviewDraft })
    postData.author = author

    return {
      post: postData,
      modules,
      seo,
      siteSettings: siteSettings as Record<string, unknown>,
      hasReviewDraft: Boolean(reviewDraft),
    }
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
