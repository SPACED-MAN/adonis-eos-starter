import type { HttpContext } from '@adonisjs/core/http'
import Post from '#models/post'
import CreateTranslation, {
  CreateTranslationException,
} from '#actions/translations/create_translation'
import DeleteTranslation, {
  DeleteTranslationException,
} from '#actions/translations/delete_translation'

/**
 * Controller for managing post translations
 *
 * This controller delegates business logic to action classes
 * to keep the controller thin and focused on HTTP concerns.
 */
export default class TranslationsController {
  /**
   * GET /api/posts/:id/translations
   * List all translations for a post
   */
  async index({ params, response }: HttpContext) {
    const { id } = params

    // Find the post
    const post = await Post.find(id)
    if (!post) {
      return response.notFound({
        error: 'Post not found',
      })
    }

    // Get all translations (including original)
    const translations = await post.getAllTranslations()

    return response.json({
      data: translations.map((translation) => ({
        id: translation.id,
        locale: translation.locale,
        slug: translation.slug,
        title: translation.title,
        status: translation.status,
        isOriginal: !translation.isTranslation(),
        translationOfId: translation.translationOfId,
        createdAt: translation.createdAt,
        updatedAt: translation.updatedAt,
      })),
      meta: {
        total: translations.length,
        postId: id,
      },
    })
  }

  /**
   * POST /api/posts/:id/translations
   * Create a new translation for a post
   */
  async store({ params, request, response }: HttpContext) {
    const { id } = params

    // Extract translation data from request
    const { locale, slug, title, metaTitle, metaDescription } = request.only([
      'locale',
      'slug',
      'title',
      'metaTitle',
      'metaDescription',
    ])

    try {
      // Delegate to action
      const translation = await CreateTranslation.handle({
        postId: id,
        locale,
        // slug/title optional: action will generate sensible defaults when omitted
        slug,
        title,
        metaTitle,
        metaDescription,
      })

      return response.created({
        data: {
          id: translation.id,
          locale: translation.locale,
          slug: translation.slug,
          title: translation.title,
          status: translation.status,
          translationOfId: translation.translationOfId,
          createdAt: translation.createdAt,
        },
        message: 'Translation created successfully',
      })
    } catch (error) {
      if (error instanceof CreateTranslationException) {
        return response.status(error.statusCode).json({
          error: error.message,
          ...error.meta,
        })
      }
      throw error
    }
  }

  /**
   * GET /api/posts/:id/translations/:locale
   * Get a specific translation
   */
  async show({ params, response }: HttpContext) {
    const { id, locale } = params

    // Find the post
    const post = await Post.find(id)
    if (!post) {
      return response.notFound({
        error: 'Post not found',
      })
    }

    // Get translation for the requested locale
    const translation = await post.getTranslation(locale)
    if (!translation) {
      return response.notFound({
        error: 'Translation not found for this locale',
        locale,
      })
    }

    return response.json({
      data: {
        id: translation.id,
        locale: translation.locale,
        slug: translation.slug,
        title: translation.title,
        status: translation.status,
        type: translation.type,
        metaTitle: translation.metaTitle,
        metaDescription: translation.metaDescription,
        translationOfId: translation.translationOfId,
        moduleGroupId: (translation as any).moduleGroupId,
        createdAt: translation.createdAt,
        updatedAt: translation.updatedAt,
      },
    })
  }

  /**
   * DELETE /api/posts/:id/translations/:locale
   * Delete a translation
   */
  async destroy({ params, response }: HttpContext) {
    const { id, locale } = params

    try {
      // Delegate to action
      await DeleteTranslation.handle({
        postId: id,
        locale,
      })

      return response.json({
        message: 'Translation deleted successfully',
        locale,
      })
    } catch (error) {
      if (error instanceof DeleteTranslationException) {
        return response.status(error.statusCode).json({
          error: error.message,
          ...error.meta,
        })
      }
      throw error
    }
  }
}
