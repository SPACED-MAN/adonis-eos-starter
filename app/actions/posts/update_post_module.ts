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

    // Check if module is locked and trying to change important properties
    if (postModule.locked && locked === false) {
      throw new UpdatePostModuleException(
        'Cannot unlock a locked module',
        403,
        { postModuleId }
      )
    }

    // Build update object
    const updateData: Record<string, any> = {
      updated_at: new Date(),
    }

    if (orderIndex !== undefined) {
      updateData.order_index = orderIndex
    }

    if (overrides !== undefined) {
      updateData.overrides = overrides
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
