import db from '@adonisjs/lucid/services/db'

type ActivityMeta = Record<string, any> | null | undefined

class ActivityLogService {
	async log(params: {
		action: string
		userId?: number | null
		entityType?: string | null
		entityId?: string | number | null
		ip?: string | null
		userAgent?: string | null
		metadata?: ActivityMeta
	}) {
		const now = new Date()
		await db.table('activity_logs').insert({
			id: (await import('node:crypto')).randomUUID(),
			user_id: params.userId ?? null,
			action: params.action,
			entity_type: params.entityType ?? null,
			entity_id: params.entityId != null ? String(params.entityId) : null,
			metadata: params.metadata ?? null,
			ip: params.ip ?? null,
			user_agent: params.userAgent ?? null,
			created_at: now,
		})
	}
}

const activityLogService = new ActivityLogService()
export default activityLogService



