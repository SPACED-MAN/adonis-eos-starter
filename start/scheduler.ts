import db from '@adonisjs/lucid/services/db'

export async function publishDueScheduledPosts() {
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
		} catch { }
	}
}

// Run scheduler only in app/server runtime (not tests or ACE CLI commands)
const isTestEnv = process.env.NODE_ENV === 'test'
const isAceCli = Array.isArray(process.argv) && process.argv.some((arg) => arg.includes('/ace') || arg === 'ace')
const isSchedulerDisabled = process.env.SCHEDULER_DISABLED === '1'

if (!isTestEnv && !isAceCli && !isSchedulerDisabled) {
	const intervalMs = process.env.NODE_ENV === 'development' ? 30_000 : 60_000
	setInterval(() => {
		publishDueScheduledPosts().catch(() => { })
	}, intervalMs)
}


