import Post from '#models/post'
import db from '@adonisjs/lucid/services/db'
import moduleScopeService from '#services/module_scope_service'
import moduleRegistry from '#services/module_registry'
import { randomUUID } from 'node:crypto'
import type { ModuleScope } from '#types/module_types'

type AddModuleToPostParams = {
  postId: string
  moduleType: string
  scope: ModuleScope
  props?: Record<string, any>
  globalSlug?: string | null
  orderIndex?: number
  locked?: boolean
}

export class AddModuleToPostException extends Error {
  constructor(
    message: string,
    public statusCode: number = 400,
    public meta?: Record<string, any>
  ) {
    super(message)
    this.name = 'AddModuleToPostException'
  }
}

export default class AddModuleToPost {
  static async handle({
    postId,
    moduleType,
    scope,
    props = {},
    globalSlug = null,
    orderIndex,
    locked = false,
  }: AddModuleToPostParams) {
    // Find the post
    const post = await Post.find(postId)

    if (!post) {
      throw new AddModuleToPostException('Post not found', 404, { postId })
    }

    // Validate module type exists
    if (!moduleRegistry.has(moduleType)) {
      throw new AddModuleToPostException(`Module type '${moduleType}' is not registered`, 404, {
        moduleType,
      })
    }

    // Validate module is allowed for this post type
    await moduleScopeService.validateModuleAttachment(moduleType, post.type)

    // Validate scope-specific requirements
    if (scope === 'global' && !globalSlug) {
      throw new AddModuleToPostException(
        'Global modules require a globalSlug',
        400,
        { scope, globalSlug }
      )
    }

    // Use transaction
    const result = await db.transaction(async (trx) => {
      let moduleInstanceId: string

      if (scope === 'global' && globalSlug) {
        // Find or create global module instance
        const existingGlobal = await trx
          .from('module_instances')
          .where('scope', 'global')
          .where('global_slug', globalSlug)
          .first()

        if (existingGlobal) {
          moduleInstanceId = existingGlobal.id
        } else {
          // Create new global module
          const moduleConfig = moduleRegistry.get(moduleType).getConfig()
          const [newGlobal] = await trx
            .table('module_instances')
            .insert({
              id: randomUUID(),
              scope: 'global',
              type: moduleType,
              global_slug: globalSlug,
              props: props || moduleConfig.defaultProps,
              created_at: new Date(),
              updated_at: new Date(),
            })
            .returning('id')

          moduleInstanceId = newGlobal.id
        }
      } else {
        // Create local or static module instance
        const moduleConfig = moduleRegistry.get(moduleType).getConfig()
        const [newInstance] = await trx
          .table('module_instances')
          .insert({
            id: randomUUID(),
            scope,
            type: moduleType,
            global_slug: null,
            props: props || moduleConfig.defaultProps,
            created_at: new Date(),
            updated_at: new Date(),
          })
          .returning('id')

        moduleInstanceId = newInstance.id
      }

      // Determine order index
      let finalOrderIndex = orderIndex
      if (finalOrderIndex === undefined) {
        // Get max order index for this post
        const maxOrder = await trx
          .from('post_modules')
          .where('post_id', postId)
          .max('order_index as max')
          .first()

        finalOrderIndex = (maxOrder?.max || -1) + 1
      }

      // Create post_module join
      const [postModule] = await trx
        .table('post_modules')
        .insert({
          id: randomUUID(),
          post_id: postId,
          module_id: moduleInstanceId,
          order_index: finalOrderIndex,
          overrides: null,
          locked,
          created_at: new Date(),
          updated_at: new Date(),
        })
        .returning('*')

      return {
        postModule,
        moduleInstanceId,
      }
    })

    return result
  }
}
