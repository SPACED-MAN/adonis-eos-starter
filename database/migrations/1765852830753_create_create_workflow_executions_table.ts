import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'workflow_executions'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.uuid('id').primary().defaultTo(this.db.rawQuery('gen_random_uuid()').knexQuery)

      // Workflow identifier
      table.string('workflow_id', 100).notNullable()

      // Trigger that activated the workflow
      table.string('trigger', 50).notNullable()

      // User who triggered the workflow (if applicable)
      table.integer('user_id').unsigned().nullable().references('users.id').onDelete('SET NULL')

      // Execution result
      table.boolean('success').notNullable()
      table.integer('status_code').nullable() // HTTP status code if webhook
      table.text('error_message').nullable()

      // Retry attempt number
      table.integer('attempt').notNullable().defaultTo(1)

      table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(this.now())
      table.timestamp('updated_at', { useTz: true }).nullable()

      // Indexes for efficient queries
      table.index(['workflow_id', 'created_at'])
      table.index(['trigger', 'created_at'])
      table.index('user_id')
      table.index('success')
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
