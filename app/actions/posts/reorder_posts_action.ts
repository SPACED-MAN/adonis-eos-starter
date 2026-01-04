import db from '@adonisjs/lucid/services/db'
import logActivityAction from '#actions/log_activity_action'

export interface ReorderPostsOptions {
  scope: { type: string; locale: string }
  items: Array<{ id: string; orderIndex: number; parentId?: string | null }>
  userId?: number | null
}

export class ReorderPostsAction {
  async handle(options: ReorderPostsOptions) {
    const { scope, items, userId } = options
    const now = new Date()

    await db.transaction(async (trx) => {
      const ids = items.map((i) => i.id)
      const rows = await trx.from('posts').whereIn('id', ids)
      const idToRow = new Map(rows.map((r: any) => [r.id, r]))

      for (const item of items) {
        const row = idToRow.get(item.id)
        if (!row) {
          throw new Error(`Post not found: ${item.id}`)
        }
        if (row.type !== scope.type || row.locale !== scope.locale) {
          throw new Error('Reorder items must match scope type/locale')
        }
      }

      for (const item of items) {
        const update: any = { order_index: item.orderIndex, updated_at: now }
        if (item.parentId !== undefined) {
          update.parent_id = item.parentId
        }
        await trx.from('posts').where('id', item.id).update(update)
      }
    })

    await logActivityAction.handle({
      action: 'post.reorder',
      userId,
      entityType: 'post',
      entityId: 'bulk',
      metadata: { count: items.length },
    })

    return { updated: items.length }
  }
}

export default new ReorderPostsAction()

