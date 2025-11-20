import db from '@adonisjs/lucid/services/db'

type UpdatePostModuleParams = {
  postModuleId: string
  orderIndex?: number
  overrides?: Record<string, any> | null
  locked?: boolean
  mode?: 'review' | 'publish'
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
    mode,
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
        // Local module: edit props; in review mode, write to review_props
        const baseProps =
          mode === 'review'
            ? (moduleInstance as any).review_props || {}
            : moduleInstance.props || {}
        const mergedProps = { ...baseProps, ...(overrides || {}) }
        const propsColumn = mode === 'review' ? 'review_props' : 'props'
        await db.from('module_instances').where('id', postModule.module_id).update({
          [propsColumn]: mergedProps,
          updated_at: new Date(),
        } as any)
        // Clear standard overrides for local modules (both fields)
        if (mode === 'review') {
          updateData.review_overrides = null
        } else {
          updateData.overrides = null
        }
      } else {
        // Global/static: edit overrides on join table; in review mode, write to review_overrides
        if (mode === 'review') {
          updateData.review_overrides = overrides
        } else {
          updateData.overrides = overrides
        }
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
