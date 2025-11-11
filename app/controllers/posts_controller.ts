import type { HttpContext } from '@adonisjs/core/http'
import Post from '#models/post'
import CreatePost, { CreatePostException } from '#actions/posts/create_post'
import UpdatePost, { UpdatePostException } from '#actions/posts/update_post'
import AddModuleToPost, { AddModuleToPostException } from '#actions/posts/add_module_to_post'
import UpdatePostModule, { UpdatePostModuleException } from '#actions/posts/update_post_module'
import db from '@adonisjs/lucid/services/db'

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
  async show({ params, request, response, inertia }: HttpContext) {
    const { slug } = params
    const locale = request.input('locale', 'en')

    try {
      // Find post by slug and locale
      const post = await Post.query()
        .where('slug', slug)
        .where('locale', locale)
        .first()

      if (!post) {
        return response.notFound({
          error: 'Post not found',
          slug,
          locale,
        })
      }

      // Load post modules with their data
      const postModules = await db
        .from('post_modules')
        .join('module_instances', 'post_modules.module_id', 'module_instances.id')
        .where('post_modules.post_id', post.id)
        .select(
          'post_modules.id as postModuleId',
          'module_instances.type',
          'module_instances.scope',
          'module_instances.props',
          'post_modules.overrides',
          'post_modules.locked',
          'post_modules.order_index as orderIndex'
        )
        .orderBy('post_modules.order_index', 'asc')

      // Merge props with overrides for each module
      const modules = postModules.map((pm) => {
        const baseProps = pm.props || {}
        const overrides = pm.overrides || {}

        return {
          id: pm.postModuleId,
          type: pm.type,
          props: { ...baseProps, ...overrides }, // Merge base props with overrides
        }
      })

      // Return as Inertia page for public viewing
      return inertia.render('site/post', {
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
        modules,
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
