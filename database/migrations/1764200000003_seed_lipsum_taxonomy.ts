import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  async up() {
    await this.schema.raw(`
      INSERT INTO taxonomies (id, slug, name, created_at, updated_at)
      VALUES (gen_random_uuid(), 'lipsum', 'Lipsum', now(), now())
      ON CONFLICT (slug) DO NOTHING
    `)
  }

  async down() {
    await this.schema.raw(`DELETE FROM taxonomies WHERE slug = 'lipsum'`)
  }
}
