import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'users'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id').notNullable()
      table.string('full_name').nullable()
      table.string('email', 254).notNullable().unique()
      table.string('username', 50).nullable()
      table.string('password').notNullable()
      table.string('role', 20).notNullable().defaultTo('admin')

      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at').nullable()
    })
    // Case-insensitive unique username
    await this.schema.raw(`
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_name='${this.tableName}' AND table_schema = current_schema()
  ) THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_indexes WHERE indexname = 'users_username_lower_unique'
    ) THEN
      CREATE UNIQUE INDEX users_username_lower_unique ON ${this.tableName} (LOWER(username));
    END IF;
  END IF;
END $$;
    `)
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}