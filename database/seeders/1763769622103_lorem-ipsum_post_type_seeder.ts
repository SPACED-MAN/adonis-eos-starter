import { BaseSeeder } from '@adonisjs/lucid/seeders'
import db from '@adonisjs/lucid/services/db'

export default class extends BaseSeeder {
  public static environment = ['development', 'production', 'test']

  public async run() {
    const now = new Date()
    const templateName = 'lorem-ipsum-default'

    // Ensure default template exists
    const existingTemplate = await db.from('templates').where({ name: templateName }).first()
    if (!existingTemplate) {
      await db.table('templates').insert({
        name: templateName,
        post_type: 'lorem-ipsum',
        description: 'Default template for lorem-ipsum',
        locked: false,
        created_at: now,
        updated_at: now,
      })
    }

    // Get enabled locales, fallback to 'en' when locales table not available
    let locales: Array<{ code: string }> = []
    try {
      locales = await db.from('locales').select('code').where('is_enabled', true)
    } catch {
      locales = [{ code: 'en' }]
    }

    // Insert default URL patterns for missing locales
    const existing = await db.from('url_patterns').where('post_type', 'lorem-ipsum').select('locale')
    const existingSet = new Set(existing.map((r: any) => r.locale))
    const toInsert = locales
      .map((l) => l.code)
      .filter((code) => !existingSet.has(code))
      .map((code) => ({
        post_type: 'lorem-ipsum',
        locale: code,
        pattern: '/{locale}/lorem-ipsum/{slug}',
        is_default: true,
        created_at: now,
        updated_at: now,
      }))
    if (toInsert.length > 0) {
      await db.table('url_patterns').insert(toInsert)
    }
  }
}
