import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'agent_executions'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      // Make post_id nullable to support global agents (no post context)
      table.uuid('post_id').nullable().alter()
      // Add index for agent_id + scope queries (for global agents)
      table.index(['agent_id', 'created_at'])
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      // Note: We can't easily make it not nullable again if there are NULL values
      // This migration assumes we're okay with keeping it nullable
      table.uuid('post_id').notNullable().alter()
      table.dropIndex(['agent_id', 'created_at'])
    })
  }
}

