import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  async up() {
    await this.schema.raw(
      'CREATE INDEX IF NOT EXISTS posts_robots_json_gin ON posts USING GIN (robots_json)'
    )
    await this.schema.raw(
      'CREATE INDEX IF NOT EXISTS posts_jsonld_overrides_gin ON posts USING GIN (jsonld_overrides)'
    )
  }

  async down() {
    await this.schema.raw('DROP INDEX IF EXISTS posts_robots_json_gin')
    await this.schema.raw('DROP INDEX IF EXISTS posts_jsonld_overrides_gin')
  }
}



