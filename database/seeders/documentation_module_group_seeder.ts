import { BaseSeeder } from '@adonisjs/lucid/seeders'
import db from '@adonisjs/lucid/services/db'

/**
 * Documentation Template Seeder
 *
 * Creates the default template for documentation posts with:
 * - Breadcrumb navigation (locked at top)
 * - Reading Progress bar (locked at top)
 * - Content modules area (unlocked for flexible content)
 */
export default class extends BaseSeeder {
	async run() {
		const now = new Date()

		// Check if documentation template already exists
		const existingTemplate = await db
			.from('module_groups')
			.where({ post_type: 'documentation', name: 'documentation-default' })
			.first()

		if (existingTemplate) {
			console.log('✅ Documentation template already exists')
			return
		}

		// Create documentation module group
		const [template] = await db
			.table('module_groups')
			.insert({
				name: 'documentation-default',
				post_type: 'documentation',
				description: 'Default module group for documentation pages with breadcrumb and reading progress',
				locked: false, // Allow adding custom modules
				created_at: now,
				updated_at: now,
			})
			.returning('*')

		console.log('✅ Created documentation template:', template.name)

		// Add module group modules (in order)
		const templateModules = [
			{
				type: 'reading-progress',
				default_props: {
					position: 'top',
					height: 4,
					zIndex: 50,
				},
				order_index: 0,
				locked: true, // Lock reading progress - always at top
				scope: 'local',
			},
			{
				type: 'breadcrumb',
				default_props: {},
				order_index: 1,
				locked: true, // Lock breadcrumb - always after reading progress
				scope: 'local',
			},
		]

		for (const moduleData of templateModules) {
			await db.table('module_group_modules').insert({
				module_group_id: template.id,
				type: moduleData.type,
				default_props: JSON.stringify(moduleData.default_props),
				order_index: moduleData.order_index,
				locked: moduleData.locked,
				scope: moduleData.scope,
				created_at: now,
				updated_at: now,
			})
			console.log(`  ✅ Added ${moduleData.type} module (order: ${moduleData.order_index})`)
		}

		console.log('✅ Documentation template setup complete')
	}
}

