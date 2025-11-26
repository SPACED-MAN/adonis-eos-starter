import Post from '#models/post'
import db from '@adonisjs/lucid/services/db'
import urlPatternService from '#services/url_pattern_service'
import LocaleService from '#services/locale_service'
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

    // Resolve default template when none provided
    let effectiveTemplateId: string | null = templateId
    if (!effectiveTemplateId) {
      const defaultName = `${type}-default`
      const defaultTemplate = await db.from('templates').where({ post_type: type, name: defaultName }).first()
      if (defaultTemplate) {
        effectiveTemplateId = (defaultTemplate as any).id as string
      } else {
        const candidates = await db.from('templates').where({ post_type: type }).select('id')
        if (Array.isArray(candidates) && candidates.length === 1) {
          effectiveTemplateId = (candidates[0] as any).id as string
        }
      }
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
          templateId: effectiveTemplateId,
          userId,
        },
        { client: trx }
      )

      // If template is specified, seed modules from template
      if (effectiveTemplateId) {
        await this.seedModulesFromTemplate(newPost.id, effectiveTemplateId, trx)
      }

      return newPost
    })

    // Ensure default URL patterns for this post type across supported locales
    try {
      const locales = await LocaleService.getSupportedLocales()
      await urlPatternService.ensureDefaultsForPostType(type, locales)
    } catch { }

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
    // Load template modules in order
    const templateModules = await trx
      .from('template_modules')
      .where('template_id', templateId)
      .orderBy('order_index', 'asc')

    if (!Array.isArray(templateModules) || templateModules.length === 0) {
      return
    }

    const now = new Date()
    for (const tm of templateModules) {
      const isGlobal = (tm as any).scope === 'global' && (tm as any).global_slug
      let moduleInstanceId: string
      if (isGlobal) {
        // Find existing global
        const global = await trx
          .from('module_instances')
          .where('scope', 'global')
          .where('global_slug', (tm as any).global_slug)
          .first()
        if (!global) {
          // If missing, create a new global instance using template default props
          const [created] = await trx.table('module_instances').insert({
            scope: 'global',
            type: tm.type,
            global_slug: (tm as any).global_slug,
            props: tm.default_props || {},
            created_at: now,
            updated_at: now,
          }).returning('*')
          moduleInstanceId = (created as any).id
        } else {
          moduleInstanceId = (global as any).id
        }
      } else {
        // Create local instance
      const [instance] = await trx
        .table('module_instances')
        .insert({
          scope: 'post',
          type: tm.type,
          global_slug: null,
          props: tm.default_props || {},
          created_at: now,
          updated_at: now,
        })
        .returning('*')
        moduleInstanceId = (instance as any).id
      }

      await trx.table('post_modules').insert({
      id: randomUUID(),
      post_id: postId,
        module_id: moduleInstanceId,
        order_index: (tm as any).order_index,
        overrides: null,
        locked: !!(tm as any).locked,
        created_at: now,
        updated_at: now,
      })
    }
  }
}
