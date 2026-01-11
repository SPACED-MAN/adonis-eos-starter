import Post from '#models/post'
import PostModule from '#models/post_module'
import ModuleInstance from '#models/module_instance'
import PostCustomFieldValue from '#models/post_custom_field_value'
import localeService from '#services/locale_service'
import postTypeConfigService from '#services/post_type_config_service'
import agentTriggerService from '#services/agent_trigger_service'
import db from '@adonisjs/lucid/services/db'
import { randomUUID } from 'node:crypto'
import { DateTime } from 'luxon'

/**
 * Parameters for creating a translation
 */
type CreateTranslationParams = {
  postId: string
  locale: string
  slug?: string | null
  title?: string
  metaTitle?: string | null
  metaDescription?: string | null
}

/**
 * Exception thrown when translation creation fails
 */
export class CreateTranslationException extends Error {
  constructor(
    message: string,
    public statusCode: number = 400,
    public meta?: Record<string, any>
  ) {
    super(message)
    this.name = 'CreateTranslationException'
  }
}

/**
 * Action to create a new translation for a post
 *
 * This action handles all business logic for creating translations:
 * - Finding and validating the base post
 * - Validating the locale
 * - Checking for duplicate translations
 * - Creating the translation with proper defaults
 */
export default class CreateTranslation {
  /**
   * Create a new translation for a post
   *
   * @param params - Translation creation parameters
   * @returns The newly created translation post
   * @throws CreateTranslationException if validation fails or post not found
   */
  static async handle({
    postId,
    locale,
    slug,
    title,
    metaTitle,
    metaDescription,
  }: CreateTranslationParams): Promise<Post> {
    // Step 1: Find and validate the base post
    const basePost = await this.getBasePost(postId)

    // Step 2: Validate the target locale
    this.validateLocale(locale)

    // Step 3: Check for duplicate translations
    await this.checkDuplicateTranslation(basePost, locale)

    // Step 4: Create the translation
    const translation = await this.createTranslation(basePost, {
      locale,
      slug,
      title,
      metaTitle,
      metaDescription,
    })

    // Step 5: Trigger automatic agents for translation creation
    // We await this to ensure the translation is ready (or at least agents have started their work)
    // before returning to the UI. This keeps the loading indicator active.
    await agentTriggerService.runAgentsForScope('post.create-translation', translation.id, {
      userId: basePost.userId,
      sourcePostId: basePost.id,
      targetLocale: locale,
    })

    return translation
  }

  /**
   * Get the base (original) post for translation
   *
   * If the provided post is itself a translation, returns its original.
   * Otherwise, returns the post itself.
   *
   * @private
   */
  private static async getBasePost(postId: string): Promise<Post> {
    const post = await Post.find(postId)

    if (!post) {
      throw new CreateTranslationException('Post not found', 404)
    }

    // If the post is a translation, get the original
    if (post.isTranslation()) {
      return await post.getOriginal()
    }

    return post
  }

  /**
   * Validate that the locale is supported
   *
   * @private
   */
  private static validateLocale(locale: string): void {
    const supported = localeService.isLocaleSupported(locale)
    if (!supported) {
      throw new CreateTranslationException(`Unsupported locale: ${locale}`, 400, { locale })
    }
  }

  /**
   * Check if a translation already exists for the given locale
   *
   * @private
   */
  private static async checkDuplicateTranslation(basePost: Post, locale: string): Promise<void> {
    const existingTranslation = await basePost.getTranslation(locale)

    if (existingTranslation) {
      throw new CreateTranslationException(
        `Translation already exists for locale: ${locale}`,
        409,
        {
          locale,
          translationId: existingTranslation.id,
        }
      )
    }
  }

  /**
   * Create the translation post
   *
   * Inherits type and module group from the base post.
   * Sets initial status to 'draft'.
   *
   * @private
   */
  private static async createTranslation(
    basePost: Post,
    data: {
      locale: string
      slug?: string | null
      title?: string
      metaTitle?: string | null
      metaDescription?: string | null
    }
  ): Promise<Post> {
    const generatedSlug =
      (data.slug || '').trim() || `${basePost.slug}-${data.locale}-${Date.now()}`
    const generatedTitle =
      (data.title || '').trim() ||
      basePost.title ||
      `${basePost.type} (${data.locale.toUpperCase()})`

    const uiConfig = postTypeConfigService.getUiConfig(basePost.type)
    const moduleGroupsEnabled =
      uiConfig.moduleGroupsEnabled !== false && uiConfig.urlPatterns.length > 0

    return await db.transaction(async (trx) => {
      const translation = await Post.create(
        {
          type: basePost.type,
          slug: generatedSlug,
          title: generatedTitle,
          status: 'draft',
          locale: data.locale,
          translationOfId: basePost.id,
          moduleGroupId: moduleGroupsEnabled ? (basePost as any).moduleGroupId : null,
          userId: basePost.userId,
          metaTitle: data.metaTitle || null,
          metaDescription: data.metaDescription || null,
          canonicalUrl: null,
          robotsJson: basePost.robotsJson,
          jsonldOverrides: null,
          publishedAt: null,
          scheduledAt: null,
          abVariation: basePost.abVariation,
          abGroupId: basePost.abGroupId,
        },
        { client: trx }
      )

      // 1. Clone modules (cloning local modules; reusing global)
      const modules = await PostModule.query({ client: trx })
        .where('postId', basePost.id)
        .orderBy('orderIndex', 'asc')
        .preload('moduleInstance')

      for (const pm of modules) {
        const mi = pm.moduleInstance as any as ModuleInstance
        let targetModuleId = mi?.id

        if (String(mi?.scope) === 'post') {
          const createdMi = await ModuleInstance.create(
            {
              id: randomUUID(),
              scope: 'post',
              type: String(mi.type),
              globalSlug: null,
              props: mi.props ?? {},
            },
            { client: trx }
          )
          targetModuleId = createdMi.id
        }

        await PostModule.create(
          {
            id: randomUUID(),
            postId: translation.id,
            moduleId: targetModuleId!,
            orderIndex: Number(pm.orderIndex ?? 0),
            overrides: pm.overrides ?? null,
            locked: !!pm.locked,
            adminLabel: pm.adminLabel ?? null,
          },
          { client: trx }
        )
      }

      // 2. Clone custom field values
      const cfValues = await PostCustomFieldValue.query({ client: trx }).where(
        'postId',
        basePost.id
      )
      if (Array.isArray(cfValues) && cfValues.length) {
        const now = DateTime.now()
        const rows = cfValues.map((r) => ({
          id: randomUUID(),
          postId: translation.id,
          fieldSlug: r.fieldSlug,
          value: r.value,
          createdAt: now,
          updatedAt: now,
        }))
        await PostCustomFieldValue.createMany(rows, { client: trx })
      }

      return translation
    })
  }
}
