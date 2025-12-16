import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'agent_executions'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.uuid('id').primary().defaultTo(this.db.rawQuery('gen_random_uuid()').knexQuery)

      // Link to post
      table.uuid('post_id').notNullable().references('id').inTable('posts').onDelete('CASCADE')

      // Agent identifier
      table.string('agent_id', 100).notNullable()

      // View mode when the agent was run (which version was being edited)
      table.enum('view_mode', ['source', 'review', 'ai-review']).notNullable()

      // User who ran the agent
      table.integer('user_id').unsigned().nullable().references('users.id').onDelete('SET NULL')

      // User's request/prompt
      table.text('request').nullable()

      // Agent's response (raw response, summary, applied changes)
      table.jsonb('response').nullable()

      // Context that was sent to the agent (viewMode, locale, etc.)
      table.jsonb('context').nullable()

      table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(this.now())

      // Indexes for efficient queries
      table.index(['post_id', 'agent_id', 'created_at'])
      table.index(['post_id', 'view_mode'])
      table.index('user_id')
    })

    // GIN index for JSONB queries
    this.schema.raw('CREATE INDEX agent_executions_response_gin ON agent_executions USING GIN (response)')
    this.schema.raw('CREATE INDEX agent_executions_context_gin ON agent_executions USING GIN (context)')
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}