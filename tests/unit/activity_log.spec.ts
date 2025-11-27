import { test } from '@japa/runner'
import db from '@adonisjs/lucid/services/db'
import activityLogService from '#services/activity_log_service'

test.group('ActivityLogService', (group) => {
	group.each.teardown(async () => {
		await db.from('activity_logs').delete()
	})

	test('logs activity record', async ({ assert }) => {
		await activityLogService.log({
			action: 'test.action',
			userId: null,
			entityType: 'test',
			entityId: '123',
			metadata: { ok: true },
		})
		const row = await db.from('activity_logs').where({ action: 'test.action', entity_type: 'test', entity_id: '123' }).first()
		assert.exists(row, 'activity row should exist')
		assert.equal((row as any).metadata?.ok, true)
	})
})



