import { BaseSeeder } from '@adonisjs/lucid/seeders'
import db from '@adonisjs/lucid/services/db'
import { randomUUID } from 'node:crypto'

export default class extends BaseSeeder {
  async run() {
    // Seed Lipsum taxonomy
    const existing = await db.from('taxonomies').where('slug', 'lipsum').first()
    if (!existing) {
      await db.table('taxonomies').insert({
        id: randomUUID(),
        slug: 'lipsum',
        name: 'Lipsum',
        created_at: new Date(),
        updated_at: new Date(),
      })
    }
  }
}
