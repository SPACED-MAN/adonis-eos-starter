import type { HttpContext } from '@adonisjs/core/http'
import Post from '#models/post'
import CreatePost, { CreatePostException } from '#actions/posts/create_post'
import UpdatePost, { UpdatePostException } from '#actions/posts/update_post'
import AddModuleToPost, { AddModuleToPostException } from '#actions/posts/add_module_to_post'
import UpdatePostModule, { UpdatePostModuleException } from '#actions/posts/update_post_module'
import moduleRenderer from '#services/module_renderer'

/**
 * Posts Controller
 *
 * Handles CRUD operations for posts and their modules.
 */
export default class PostsController {
  /**
   * POST /api/posts
   *
   * Create a new post, optionally with a template.
   */
  async store({ request, response, auth }: HttpContext) {
    const { type, locale, slug, title, status, excerpt, metaTitle, metaDescription, templateId } =
      request.only([
        'type',
        'locale',
        'slug',
        'title',
        'status',
        'excerpt',
        'metaTitle',
        'metaDescription',
        'templateId',
      ])

    try {
      const post = await CreatePost.handle({
        type,
        locale,
        slug,
        title,
        status,
        excerpt,
        metaTitle,
        metaDescription,
        templateId,
        userId: auth.user!.id,
      })

      return response.created({
        data: {
          id: post.id,
          type: post.type,
          locale: post.locale,
          slug: post.slug,
          title: post.title,
          status: post.status,
          createdAt: post.createdAt,
        },
        message: 'Post created successfully',
      })
    } catch (error) {
      if (error instanceof CreatePostException) {
        return response.status(error.statusCode).json({
          error: error.message,
          ...error.meta,
        })
      }
      throw error
    }
  }

  /**
   * PUT /api/posts/:id
   *
   * Update an existing post.
   */
  async update({ params, request, response }: HttpContext) {
    const { id } = params
    const { slug, title, status, excerpt, metaTitle, metaDescription } = request.only([
      'slug',
      'title',
      'status',
      'excerpt',
      'metaTitle',
      'metaDescription',
    ])

    try {
      const post = await UpdatePost.handle({
        postId: id,
        slug,
        title,
        status,
        excerpt,
        metaTitle,
        metaDescription,
      })

      return response.ok({
        data: {
          id: post.id,
          slug: post.slug,
          title: post.title,
          status: post.status,
          updatedAt: post.updatedAt,
        },
        message: 'Post updated successfully',
      })
    } catch (error) {
      if (error instanceof UpdatePostException) {
        return response.status(error.statusCode).json({
          error: error.message,
          ...error.meta,
        })
      }
      throw error
    }
  }

  /**
   * GET /api/posts/:slug
   *
   * Get a post by slug with rendered modules.
   */
  async show({ params, request, response }: HttpContext) {
    const { slug } = params
    const locale = request.input('locale', 'en')

    try {
      // Find post by slug and locale
      const post = await Post.query().where('slug', slug).where('locale', locale).first()

      if (!post) {
        return response.notFound({
          error: 'Post not found',
          slug,
          locale,
        })
      }

      // Render the post with its modules
      const rendered = await moduleRenderer.renderPost(post.id, locale, {
        postType: post.type,
        isPreview: false,
      })

      return response.ok({
        data: {
          post: {
            id: post.id,
            type: post.type,
            locale: post.locale,
            slug: post.slug,
            title: post.title,
            excerpt: post.excerpt,
            metaTitle: post.metaTitle,
            metaDescription: post.metaDescription,
            status: post.status,
          },
          html: rendered.html,
          jsonLd: rendered.jsonLd,
        },
      })
    } catch (error) {
      return response.internalServerError({
        error: 'Failed to load post',
        message: error.message,
      })
    }
  }

  /**
   * POST /api/posts/:id/modules
   *
   * Add a module to a post.
   */
  async storeModule({ params, request, response }: HttpContext) {
    const { id } = params
    const { moduleType, scope, props, globalSlug, orderIndex, locked } = request.only([
      'moduleType',
      'scope',
      'props',
      'globalSlug',
      'orderIndex',
      'locked',
    ])

    try {
      const result = await AddModuleToPost.handle({
        postId: id,
        moduleType,
        scope,
        props,
        globalSlug,
        orderIndex,
        locked,
      })

      return response.created({
        data: {
          postModuleId: result.postModule.id,
          moduleInstanceId: result.moduleInstanceId,
          orderIndex: result.postModule.order_index,
        },
        message: 'Module added to post successfully',
      })
    } catch (error) {
      if (error instanceof AddModuleToPostException) {
        return response.status(error.statusCode).json({
          error: error.message,
          ...error.meta,
        })
      }
      throw error
    }
  }

  /**
   * PUT /api/post-modules/:id
   *
   * Update a post module (reorder, update overrides, lock/unlock).
   */
  async updateModule({ params, request, response }: HttpContext) {
    const { id } = params
    const { orderIndex, overrides, locked } = request.only(['orderIndex', 'overrides', 'locked'])

    try {
      const updated = await UpdatePostModule.handle({
        postModuleId: id,
        orderIndex,
        overrides,
        locked,
      })

      return response.ok({
        data: {
          id: updated.id,
          orderIndex: updated.order_index,
          overrides: updated.overrides,
          locked: updated.locked,
          updatedAt: updated.updated_at,
        },
        message: 'Post module updated successfully',
      })
    } catch (error) {
      if (error instanceof UpdatePostModuleException) {
        return response.status(error.statusCode).json({
          error: error.message,
          ...error.meta,
        })
      }
      throw error
    }
  }
}
