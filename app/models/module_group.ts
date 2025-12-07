import { BaseModel, column, hasMany } from '@adonisjs/lucid/orm'
import { DateTime } from 'luxon'
import type { HasMany } from '@adonisjs/lucid/types/relations'
import ModuleGroupModule from './module_group_module.js'

/**
 * ModuleGroup
 */
export default class ModuleGroup extends BaseModel {
	public static table = 'module_groups'

	@column({ isPrimary: true })
	declare id: string

	@column()
	declare name: string

	@column({ columnName: 'post_type' })
	declare postType: string

	@column()
	declare description: string | null

	@column()
	declare locked: boolean

	@column.dateTime({ autoCreate: true, columnName: 'created_at' })
	declare createdAt: DateTime

	@column.dateTime({ autoCreate: true, autoUpdate: true, columnName: 'updated_at' })
	declare updatedAt: DateTime

	@hasMany(() => ModuleGroupModule, { foreignKey: 'moduleGroupId' })
	declare modules: HasMany<typeof ModuleGroupModule>
}

