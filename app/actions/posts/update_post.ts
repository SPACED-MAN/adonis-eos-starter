import Post from '#models/post'
import crypto from 'node:crypto'
import db from '@adonisjs/lucid/services/db'
import urlPatternService from '#services/url_pattern_service'
import postTypeConfigService from '#services/post_type_config_service'

type UpdatePostParams = {
  postId: string
  slug?: string
  title?: string
  status?: 'draft' | 'review' | 'scheduled' | 'published' | 'private' | 'protected' | 'archived'
  excerpt?: string | null
  parentId?: string | null
  orderIndex?: number
  metaTitle?: string | null
  metaDescription?: string | null
  canonicalUrl?: string | null
  robotsJson?: Record<string, any> | null
  jsonldOverrides?: Record<string, any> | null
  featuredImageId?: string | null
  taxonomyTermIds?: string[]
}

export class UpdatePostException extends Error {
  constructor(
    message: string,
    public statusCode: number = 400,
    public meta?: Record<string, any>
  ) {
    super(message)
    this.name = 'UpdatePostException'
  }
}

export default class UpdatePost {
  static async handle({
    postId,
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
    featuredImageId,
    taxonomyTermIds,
  }: UpdatePostParams): Promise<Post> {
    // Find the post
    const post = await Post.find(postId)

    if (!post) {
      throw new UpdatePostException('Post not found', 404, { postId })
    }

    // If slug is being changed, normalize and check uniqueness
    if (slug) {
      let newSlug = slug
      if (newSlug.includes('/')) {
        newSlug = newSlug.replace(/^\/+/, '').split('/').pop() || newSlug
      }
      if (newSlug !== post.slug) {
        const existingPost = await Post.query()
          .where('slug', newSlug)
          .where('locale', post.locale)
          .whereNot('id', postId)
          .first()

        if (existingPost) {
          throw new UpdatePostException(
            'A post with this slug already exists for this locale',
            409,
            { slug: newSlug, locale: post.locale }
          )
        }

        // Conditionally create a 301 redirect from old path to new path (locale-aware)
        // IMPORTANT: Must check and create redirect BEFORE changing the slug
        const shouldAutoRedirect = await (async () => {
          // Check database settings first (runtime configuration takes precedence)
          const dbSettings = await db
            .from('post_type_settings')
            .where('post_type', post.type)
            .first()

          if (dbSettings && (dbSettings as any).settings?.autoRedirectOnSlugChange !== undefined) {
            return !!(dbSettings as any).settings.autoRedirectOnSlugChange
          }

          // Fall back to post type config file
          const cfg = postTypeConfigService.getUiConfig(post.type)
          return (cfg as any).autoRedirectOnSlugChange !== undefined
            ? !!(cfg as any).autoRedirectOnSlugChange
            : false // default false when not provided (auto-redirects disabled by default)
        })()

        if (shouldAutoRedirect) {
          // Capture old URL BEFORE changing slug
          const fromPath =
            post.canonicalUrl || (await urlPatternService.buildPostPathForPost(post.id))

          // Generate new URL using the NEW slug but WITHOUT relying on DB state
          const toPath = await urlPatternService.buildPostPathForPostWithSlug(post.id, newSlug)

          try {
            const existing = await db.from('url_redirects').where('from_path', fromPath).first()
            if (!existing) {
              const now = new Date()
              await db.table('url_redirects').insert({
                from_path: fromPath,
                to_path: toPath,
                locale: post.locale,
                http_status: 301,
                post_id: post.id,
                created_at: now,
                updated_at: now,
              })
            }
          } catch {
            // ignore redirect insert errors
          }
        }

        // Now save the new slug
        post.slug = newSlug
      }
    }

    // Update other fields if provided
    if (title !== undefined) post.title = title
    if (status !== undefined) post.status = status
    if (excerpt !== undefined) post.excerpt = excerpt
    if (parentId !== undefined) {
      // Normalize: empty string => null
      const normalized = parentId === '' ? null : parentId
      // Prevent self-parenting
      if (normalized && normalized === postId) {
        post.parentId = null
      } else {
        post.parentId = (normalized as any) ?? null
      }
    }
    if (orderIndex !== undefined && !Number.isNaN(Number(orderIndex))) {
      post.orderIndex = Number(orderIndex)
    }
    if (metaTitle !== undefined) post.metaTitle = metaTitle
    if (metaDescription !== undefined) post.metaDescription = metaDescription
    if (canonicalUrl !== undefined) post.canonicalUrl = canonicalUrl
    if (robotsJson !== undefined) post.robotsJson = robotsJson
    if (jsonldOverrides !== undefined) post.jsonldOverrides = jsonldOverrides
    if (featuredImageId !== undefined) {
      // Normalize: empty string => null
      post.featuredImageId = featuredImageId === '' ? null : featuredImageId
    }

    await post.save()

    if (taxonomyTermIds) {
      const cfg = postTypeConfigService.getUiConfig(post.type)
      const allowedTaxonomies = Array.isArray((cfg as any).taxonomies) ? (cfg as any).taxonomies : []
      if (allowedTaxonomies.length > 0) {
        const allowedTerms = await db
          .from('taxonomy_terms as tt')
          .join('taxonomies as t', 'tt.taxonomy_id', 't.id')
          .whereIn('tt.id', taxonomyTermIds)
          .whereIn('t.slug', allowedTaxonomies)
          .select('tt.id')
        const allowedTermIds = Array.from(new Set(allowedTerms.map((r: any) => String(r.id))))

        // Remove existing assignments for the allowed taxonomies, then reinsert the provided ones
        const allowedTaxonomyIds = await db.from('taxonomies').whereIn('slug', allowedTaxonomies).select('id')
        const allowedIds = allowedTaxonomyIds.map((r: any) => String(r.id))
        if (allowedIds.length > 0) {
          await db
            .from('post_taxonomy_terms as ptt')
            .join('taxonomy_terms as tt', 'ptt.taxonomy_term_id', 'tt.id')
            .where('ptt.post_id', post.id)
            .whereIn('tt.taxonomy_id', allowedIds)
            .delete()
        }

        if (allowedTermIds.length > 0) {
          const now = new Date()
          const rows = allowedTermIds.map((tid) => ({
            id: crypto.randomUUID(),
            post_id: post.id,
            taxonomy_term_id: tid,
            created_at: now,
            updated_at: now,
          }))
          await db.table('post_taxonomy_terms').insert(rows)
        }
      }
    }

    // Auto-update canonical URL if slug changed or if it's not set and wasn't explicitly provided
    if ((slug && post.slug !== slug) || (canonicalUrl === undefined && !post.canonicalUrl)) {
      try {
        const newCanonicalPath = await urlPatternService.buildPostPathForPost(post.id)
        post.canonicalUrl = newCanonicalPath
        await post.save()
      } catch {
        // If canonical URL generation fails, continue without it
      }
    }

    return post
  }
}
