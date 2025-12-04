import Post from '#models/post'
import localeService from '#services/locale_service'

/**
 * Parameters for creating a translation
 */
type CreateTranslationParams = {
  postId: string
  locale: string
  slug?: string
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
    return this.createTranslation(basePost, {
      locale,
      slug,
      title,
      metaTitle,
      metaDescription,
    })
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

  private static async ensureLocaleSupported(locale: string): Promise<void> {
    const supported = await localeService.isLocaleSupported(locale)
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
   * Inherits type and template from the base post.
   * Sets initial status to 'draft'.
   *
   * @private
   */
  private static async createTranslation(
    basePost: Post,
    data: {
      locale: string
      slug?: string
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

    return Post.create({
      type: basePost.type,
      slug: generatedSlug,
      title: generatedTitle,
      status: 'draft',
      locale: data.locale,
      translationOfId: basePost.id,
      templateId: basePost.templateId,
      userId: basePost.userId,
      metaTitle: data.metaTitle || null,
      metaDescription: data.metaDescription || null,
      canonicalUrl: null,
      robotsJson: basePost.robotsJson,
      jsonldOverrides: null,
      publishedAt: null,
      scheduledAt: null,
    })
  }
}
