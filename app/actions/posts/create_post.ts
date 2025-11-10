import Post from '#models/post'
import db from '@adonisjs/lucid/services/db'
import { randomUUID } from 'node:crypto'

type CreatePostParams = {
  type: string
  locale: string
  slug: string
  title: string
  status?: 'draft' | 'published' | 'archived'
  excerpt?: string | null
  metaTitle?: string | null
  metaDescription?: string | null
  templateId?: string | null
  userId: number
}

export class CreatePostException extends Error {
  constructor(
    message: string,
    public statusCode: number = 400,
    public meta?: Record<string, any>
  ) {
    super(message)
    this.name = 'CreatePostException'
  }
}

export default class CreatePost {
  static async handle({
    type,
    locale,
    slug,
    title,
    status = 'draft',
    excerpt = null,
    metaTitle = null,
    metaDescription = null,
    templateId = null,
    userId,
  }: CreatePostParams): Promise<Post> {
    // Validate slug uniqueness for this locale
    const existingPost = await Post.query().where('slug', slug).where('locale', locale).first()

    if (existingPost) {
      throw new CreatePostException(
        'A post with this slug already exists for this locale',
        409,
        { slug, locale }
      )
    }

    // Create the post using a transaction
    const post = await db.transaction(async (trx) => {
      // Create post
      const newPost = await Post.create(
        {
          type,
          locale,
          slug,
          title,
          status,
          excerpt,
          metaTitle,
          metaDescription,
          userId,
        },
        { client: trx }
      )

      // If template is specified, seed modules from template
      if (templateId) {
        await this.seedModulesFromTemplate(newPost.id, templateId, trx)
      }

      return newPost
    })

    return post
  }

  /**
   * Seed modules from a template
   *
   * Copies all modules from a template to the post, maintaining order and locks.
   */
  private static async seedModulesFromTemplate(
    postId: string,
    templateId: string,
    trx: any
  ): Promise<void> {
    // Load template modules
    const templateModules = await trx
      .from('template_modules')
      .where('template_id', templateId)
      .orderBy('order_index', 'asc')

    if (templateModules.length === 0) {
      return
    }

    // Create post_modules entries for each template module
    const postModules = templateModules.map((tm: any) => ({
      id: randomUUID(),
      post_id: postId,
      module_id: tm.module_id,
      order_index: tm.order_index,
      overrides: null, // No overrides initially
      locked: tm.locked,
      created_at: new Date(),
      updated_at: new Date(),
    }))

    await trx.table('post_modules').insert(postModules)
  }
}
