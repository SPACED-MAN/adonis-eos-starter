import { BaseSchema } from '@adonisjs/lucid/schema'

export default class AddReviewDraftToPosts extends BaseSchema {
	protected tableName = 'posts'

	async up() {
		this.schema.alterTable(this.tableName, (table) => {
			table.jsonb('review_draft').nullable()
		})
	}

	async down() {
		this.schema.alterTable(this.tableName, (table) => {
			table.dropColumn('review_draft')
		})
	}
}


