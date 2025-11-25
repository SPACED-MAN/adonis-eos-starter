import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
	protected tableName = 'media_assets'

	async up() {
		this.schema.alterTable(this.tableName, (table) => {
			// Postgres text array for free-tag categories
			table.specificType('categories', 'text[]').notNullable().defaultTo('{}')
		})
	}

	async down() {
		this.schema.alterTable(this.tableName, (table) => {
			table.dropColumn('categories')
		})
	}
}


