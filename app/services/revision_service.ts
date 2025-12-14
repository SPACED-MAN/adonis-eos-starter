import db from '@adonisjs/lucid/services/db'
import env from '#start/env'

export type RevisionMode = 'approved' | 'review' | 'ai-review'
export type ActiveVersion = 'source' | 'review' | 'ai-review'

type RecordRevisionParams = {
  postId: string
  mode: RevisionMode | ActiveVersion
  snapshot: Record<string, any>
  userId?: number | null
}

export default class RevisionService {
  /**
   * Record a revision snapshot and prune older ones based on CMS_REVISIONS_LIMIT.
   */
  static async record({ postId, mode, snapshot, userId }: RecordRevisionParams): Promise<void> {
    // DB uses legacy enum values; map Source -> approved for storage.
    const dbMode: RevisionMode = mode === 'source' ? 'approved' : (mode as RevisionMode)
    const now = new Date()
    await db.table('post_revisions').insert({
      post_id: postId,
      user_id: userId ?? null,
      mode: dbMode,
      snapshot,
      created_at: now,
    })

    const limit = Number((env.get('CMS_REVISIONS_LIMIT') as any) ?? 20)
    if (limit > 0) {
      const oldRows = await db
        .from('post_revisions')
        .where('post_id', postId)
        .orderBy('created_at', 'desc')
        .offset(limit)
        .select('id')

      if (oldRows.length > 0) {
        await db
          .from('post_revisions')
          .whereIn(
            'id',
            oldRows.map((r: any) => r.id)
          )
          .delete()
      }
    }
  }
}
