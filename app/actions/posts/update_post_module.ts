import db from '@adonisjs/lucid/services/db'

type UpdatePostModuleParams = {
  postModuleId: string
  orderIndex?: number
  overrides?: Record<string, any> | null
  locked?: boolean
}

export class UpdatePostModuleException extends Error {
  constructor(
    message: string,
    public statusCode: number = 400,
    public meta?: Record<string, any>
  ) {
    super(message)
    this.name = 'UpdatePostModuleException'
  }
}

export default class UpdatePostModule {
  static async handle({
    postModuleId,
    orderIndex,
    overrides,
    locked,
  }: UpdatePostModuleParams) {
    // Find the post_module
    const postModule = await db.from('post_modules').where('id', postModuleId).first()

    if (!postModule) {
      throw new UpdatePostModuleException('Post module not found', 404, { postModuleId })
    }

    // Build update object for post_modules
    const updateData: Record<string, any> = {
      updated_at: new Date(),
    }

    if (orderIndex !== undefined) {
      updateData.order_index = orderIndex
    }

    // If overrides provided and module is local (scope='post'), merge into module props instead
    // to reflect that local modules own their props rather than using per-post overrides.
    if (overrides !== undefined) {
      const moduleInstance = await db.from('module_instances').where('id', postModule.module_id).first()
      if (moduleInstance && moduleInstance.scope === 'post') {
        const baseProps = moduleInstance.props || {}
        const mergedProps = { ...baseProps, ...(overrides || {}) }
        await db
          .from('module_instances')
          .where('id', postModule.module_id)
          .update({ props: mergedProps, updated_at: new Date() })
        // ensure post_modules overrides cleared for local modules
        updateData.overrides = null
      } else {
        updateData.overrides = overrides
      }
    }

    if (locked !== undefined) {
      updateData.locked = locked
    }

    // Update the post_module
    const [updated] = await db
      .from('post_modules')
      .where('id', postModuleId)
      .update(updateData)
      .returning('*')

    return updated
  }
}
