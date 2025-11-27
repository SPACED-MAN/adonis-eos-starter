import { test } from '@japa/runner'
import db from '@adonisjs/lucid/services/db'
import { publishDueScheduledPosts } from '../../start/scheduler.ts'

test.group('Scheduler publish', (group) => {
	group.each.setup(async () => {
		// ensure a user exists
		const user = await db.from('users').where('email', 'scheduler@test.local').first()
		if (!user) {
			await db.table('users').insert({
				full_name: null,
				email: 'scheduler@test.local',
				password: 'x',
				role: 'admin',
				created_at: new Date(),
				updated_at: new Date(),
			})
		}
	})
	group.each.teardown(async () => {
		await db.from('posts').where('slug', 'sched-test').delete()
	})

	test('publishes due scheduled posts', async ({ assert }) => {
		const user = await db.from('users').where('email', 'scheduler@test.local').first()
		const now = new Date()
		const [post] = await db.table('posts').insert({
			type: 'blog',
			slug: 'sched-test',
			title: 'Scheduled Test',
			status: 'scheduled',
			locale: 'en',
			user_id: (user as any).id,
			author_id: (user as any).id,
			order_index: 0,
			review_draft: null,
			published_at: null,
			scheduled_at: now,
			created_at: now,
			updated_at: now,
		}).returning('*')
		assert.exists(post.id)
		await publishDueScheduledPosts()
		const row = await db.from('posts').where('id', (post as any).id).first()
		assert.equal((row as any).status, 'published')
	})
})


