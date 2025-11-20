import { BaseSchema } from '@adonisjs/lucid/schema'

export default class AddReviewFieldsToModules extends BaseSchema {
  async up() {
    this.schema.alterTable('module_instances', (table) => {
      table.jsonb('review_props').nullable()
    })
    this.schema.alterTable('post_modules', (table) => {
      table.jsonb('review_overrides').nullable()
    })
  }

  async down() {
    this.schema.alterTable('post_modules', (table) => {
      table.dropColumn('review_overrides')
    })
    this.schema.alterTable('module_instances', (table) => {
      table.dropColumn('review_props')
    })
  }
}


