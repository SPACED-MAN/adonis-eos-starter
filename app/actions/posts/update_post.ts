import Post from '#models/post'
import db from '@adonisjs/lucid/services/db'
import urlPatternService from '#services/url_pattern_service'

type UpdatePostParams = {
  postId: string
  slug?: string
  title?: string
  status?: 'draft' | 'review' | 'scheduled' | 'published' | 'archived'
  excerpt?: string | null
  metaTitle?: string | null
  metaDescription?: string | null
  canonicalUrl?: string | null
  robotsJson?: Record<string, any> | null
  jsonldOverrides?: Record<string, any> | null
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
    metaTitle,
    metaDescription,
    canonicalUrl,
    robotsJson,
    jsonldOverrides,
  }: UpdatePostParams): Promise<Post> {
    // Find the post
    const post = await Post.find(postId)

    if (!post) {
      throw new UpdatePostException('Post not found', 404, { postId })
    }

    // If slug is being changed, check uniqueness
    if (slug && slug !== post.slug) {
      const oldSlug = post.slug
      const existingPost = await Post.query()
        .where('slug', slug)
        .where('locale', post.locale)
        .whereNot('id', postId)
        .first()

      if (existingPost) {
        throw new UpdatePostException(
          'A post with this slug already exists for this locale',
          409,
          { slug, locale: post.locale }
        )
      }

      // Save new slug
      post.slug = slug
      // Create a 301 redirect from old path to new path (locale-aware)
      const fromPath = await urlPatternService.buildPostPath(oldSlug, post.locale)
      const toPath = await urlPatternService.buildPostPath(slug, post.locale)
      try {
        await db
          .table('url_redirects')
          .insert({
            from_path: fromPath,
            to_path: toPath,
            locale: post.locale,
            status_code: 301,
          })
          .onConflict(['from_path', 'locale'])
          .ignore()
      } catch {
        // ignore redirect insert errors
      }
    }

    // Update other fields if provided
    if (title !== undefined) post.title = title
    if (status !== undefined) post.status = status
    if (excerpt !== undefined) post.excerpt = excerpt
    if (metaTitle !== undefined) post.metaTitle = metaTitle
    if (metaDescription !== undefined) post.metaDescription = metaDescription
    if (canonicalUrl !== undefined) post.canonicalUrl = canonicalUrl
    if (robotsJson !== undefined) post.robotsJson = robotsJson
    if (jsonldOverrides !== undefined) post.jsonldOverrides = jsonldOverrides

    await post.save()

    return post
  }
}
