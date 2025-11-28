import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'activity_logs'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.uuid('id').primary().defaultTo(this.db.rawQuery('gen_random_uuid()').knexQuery)
      table.integer('user_id').unsigned().nullable().references('users.id').onDelete('SET NULL')
      table.string('action', 100).notNullable()
      table.string('entity_type', 100).nullable()
      table.string('entity_id', 100).nullable()
      table.jsonb('metadata').nullable()
      table.string('ip', 64).nullable()
      table.text('user_agent').nullable()
      table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(this.now())
    })
    await this.schema.raw(`
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_name='${this.tableName}' AND table_schema = current_schema()
  ) THEN
    CREATE INDEX IF NOT EXISTS activity_logs_user_id_idx ON ${this.tableName}(user_id);
    CREATE INDEX IF NOT EXISTS activity_logs_action_idx ON ${this.tableName}(action);
    CREATE INDEX IF NOT EXISTS activity_logs_entity_idx ON ${this.tableName}(entity_type, entity_id);
    CREATE INDEX IF NOT EXISTS activity_logs_metadata_gin ON ${this.tableName} USING GIN (metadata);
  END IF;
END $$;
    `)
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}


