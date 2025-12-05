import Post from '#models/post'
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
        const oldSlug = post.slug
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

        // Save new slug
        post.slug = newSlug
        // Conditionally create a 301 redirect from old path to new path (locale-aware)
        const shouldAutoRedirect = (() => {
          const cfg = postTypeConfigService.getUiConfig(post.type)
          // default true when not provided
          return (cfg as any).autoRedirectOnSlugChange !== undefined
            ? !!(cfg as any).autoRedirectOnSlugChange
            : true
        })()
        if (shouldAutoRedirect) {
          // Use canonical URL as fromPath (the old URL before slug change)
          const fromPath = post.canonical_url || (await urlPatternService.buildPostPathForPost(post.id))
          
          // Temporarily update post slug to generate new path
          const oldSlugForRestore = post.slug
          post.slug = newSlug
          const toPath = await urlPatternService.buildPostPathForPost(post.id)
          post.slug = oldSlugForRestore
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
