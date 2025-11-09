import Post from '#models/post'

/**
 * Parameters for deleting a translation
 */
type DeleteTranslationParams = {
  postId: string
  locale: string
}

/**
 * Exception thrown when translation deletion fails
 */
export class DeleteTranslationException extends Error {
  constructor(
    message: string,
    public statusCode: number = 400,
    public meta?: Record<string, any>
  ) {
    super(message)
    this.name = 'DeleteTranslationException'
  }
}

/**
 * Action to delete a translation of a post
 *
 * This action handles the business logic for deleting translations:
 * - Finding the translation
 * - Preventing deletion of original posts
 * - Safely removing the translation
 */
export default class DeleteTranslation {
  /**
   * Delete a translation for a specific locale
   *
   * @param params - Post ID and locale to delete
   * @returns The deleted translation post
   * @throws DeleteTranslationException if validation fails or translation not found
   */
  static async handle({ postId, locale }: DeleteTranslationParams): Promise<Post> {
    // Step 1: Find the post
    const post = await this.findPost(postId)

    // Step 2: Prevent deletion of original posts via this method (check BEFORE getting translation)
    this.preventOriginalDeletion(post, locale)

    // Step 3: Get the translation to delete
    const translation = await this.getTranslation(post, locale)

    // Step 4: Delete the translation
    await translation.delete()

    return translation
  }

  /**
   * Find the post by ID
   *
   * @private
   */
  private static async findPost(postId: string): Promise<Post> {
    const post = await Post.find(postId)

    if (!post) {
      throw new DeleteTranslationException('Post not found', 404)
    }

    return post
  }

  /**
   * Get the translation for the specified locale
   *
   * @private
   */
  private static async getTranslation(post: Post, locale: string): Promise<Post> {
    const translation = await post.getTranslation(locale)

    if (!translation) {
      throw new DeleteTranslationException(
        `Translation not found for locale: ${locale}`,
        404,
        { locale }
      )
    }

    return translation
  }

  /**
   * Prevent deletion of original posts via the translations endpoint
   *
   * Original posts should be deleted directly, not via the translations API.
   *
   * @private
   */
  private static preventOriginalDeletion(post: Post, locale: string): void {
    // If the found post is not a translation and matches the requested locale,
    // it's the original post, which should not be deleted via this endpoint
    if (!post.isTranslation() && post.locale === locale) {
      throw new DeleteTranslationException(
        'Cannot delete original post via translations endpoint. Use the posts endpoint instead.',
        400,
        { postId: post.id, locale }
      )
    }
  }
}
