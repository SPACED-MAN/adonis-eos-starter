import db from '@adonisjs/lucid/services/db'

async function publishDueScheduledPosts() {
  const now = new Date()
  const rows = await db
    .from('posts')
    .where('status', 'scheduled')
    .andWhere('scheduled_at', '<=', now)
    .select('id')
  if (!Array.isArray(rows) || rows.length === 0) return
  const ids = rows.map((r: any) => String((r as any).id))
  const activity = (await import('#services/activity_log_service')).default
  const when = new Date()
  await db.transaction(async (trx) => {
    await trx.from('posts').whereIn('id', ids).update({ status: 'published', published_at: when, updated_at: when } as any)
  })
  // Fire-and-forget activity logs
  for (const id of ids) {
    try {
      await activity.log({ action: 'post.publish.auto', entityType: 'post', entityId: id, metadata: { reason: 'scheduled', at: when.toISOString() } })
    } catch {}
  }
}

const intervalMs = process.env.NODE_ENV === 'development' ? 30_000 : 60_000
setInterval(() => {
  publishDueScheduledPosts().catch(() => {})
}, intervalMs)


