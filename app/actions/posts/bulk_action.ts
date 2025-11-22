import Post from '#models/post'
import authorizationService from '#services/authorization_service'
import db from '@adonisjs/lucid/services/db'

export default class BulkPostsAction {
  static async handle(input: {
    action: 'publish' | 'draft' | 'archive' | 'delete'
    ids: string[]
    role?: 'admin' | 'editor' | 'translator'
  }): Promise<{ message: string; count: number }> {
    const { action, ids, role } = input
    const uniqueIds = Array.from(new Set(ids.map((v) => String(v))))

    if (!authorizationService.canBulkAction(role, action)) {
      const err = new Error('Not allowed to perform this action') as any
      err.statusCode = 403
      throw err
    }

    if (action === 'delete') {
      const notArchived = await Post.query()
        .whereIn('id', uniqueIds)
        .whereNot('status', 'archived')
        .select('id', 'status')
      if (notArchived.length > 0) {
        const err = new Error('Only archived posts can be deleted') as any
        err.statusCode = 400
        err.meta = { notArchived: notArchived.map((p) => ({ id: p.id, status: p.status })) }
        throw err
      }
      await Post.query().whereIn('id', uniqueIds).delete()
      return { message: 'Deleted archived posts', count: uniqueIds.length }
    }

    let nextStatus: 'published' | 'draft' | 'archived'
    switch (action) {
      case 'publish':
        nextStatus = 'published'
        break
      case 'draft':
        nextStatus = 'draft'
        break
      case 'archive':
        nextStatus = 'archived'
        break
      default:
        const err = new Error('Invalid action') as any
        err.statusCode = 400
        throw err
    }
    const now = new Date()
    await db.from('posts').whereIn('id', uniqueIds).update({ status: nextStatus, updated_at: now })
    return { message: `Updated status to ${nextStatus}`, count: uniqueIds.length }
  }
}


