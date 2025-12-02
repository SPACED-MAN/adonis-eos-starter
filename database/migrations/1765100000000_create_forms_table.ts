import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'forms'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.uuid('id').primary().defaultTo(this.db.rawQuery('gen_random_uuid()').knexQuery)
      table.string('slug', 100).notNullable().unique()
      table.string('title', 255).notNullable()
      table.text('description').nullable()
      table
        .jsonb('fields_json')
        .notNullable()
        .defaultTo(this.db.rawQuery(`'[]'::jsonb`).knexQuery)
      table
        .jsonb('subscriptions_json')
        .notNullable()
        .defaultTo(this.db.rawQuery(`'[]'::jsonb`).knexQuery)
      table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(this.now())
      table.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(this.now())
    })

    this.schema.alterTable(this.tableName, (table) => {
      table.index(['slug'], 'idx_forms_slug')
      table.index(['created_at'], 'idx_forms_created_at')
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}


