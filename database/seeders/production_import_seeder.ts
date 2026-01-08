import { BaseSeeder } from '@adonisjs/lucid/seeders'
import { readFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import db from '@adonisjs/lucid/services/db'
import databaseImportService from '#services/database_import_service'

/**
 * Production Import Seeder
 *
 * Intended for first-time launches. It imports a curated JSON export into an
 * empty production database using the same DatabaseImportService as the admin UI.
 * Safety checks ensure we don't overwrite existing live data.
 */
export default class ProductionImportSeeder extends BaseSeeder {
  public static environment = ['production']

  public async run() {
    // Try to find the file in the project root or the build directory
    let filePath = join(process.cwd(), 'database', 'seed_data', 'production-export.json')

    if (!existsSync(filePath)) {
      filePath = join(process.cwd(), 'build', 'database', 'seed_data', 'production-export.json')
    }

    if (!existsSync(filePath)) {
      console.error('❌ Production export file not found at:')
      console.error(`   - ${join(process.cwd(), 'database', 'seed_data', 'production-export.json')}`)
      console.error(`   - ${join(process.cwd(), 'build', 'database', 'seed_data', 'production-export.json')}`)
      return
    }

    console.log('📥 Production import seeder starting. File:', filePath)

    // Safety: require mostly empty key tables to avoid clobbering live data.
    // We allow a few users because system preloads may create default agent/admin users on boot.
    const keyTables = [
      { name: 'users', limit: 10 },
      { name: 'posts', limit: 0 },
      { name: 'menus', limit: 0 },
      { name: 'module_instances', limit: 0 },
      { name: 'forms', limit: 0 }
    ]

    for (const table of keyTables) {
      const row = await db.from(table.name).count('* as total').first()
      const count = Number((row as any)?.total || 0)
      if (count > table.limit) {
        console.log(
          `⏭️  Aborting production import: table "${table.name}" has existing data (count=${count}, limit=${table.limit}).`
        )
        return
      }
    }

    try {
      const buffer = await readFile(filePath)

      const result = await databaseImportService.importFromBuffer(buffer, {
        strategy: 'replace', // safe because we assert emptiness first
        preserveIds: true,
        disableForeignKeyChecks: true,
      })

      console.log(
        `✅ Production import completed: ${result.tablesImported} tables, ${result.rowsImported} rows`
      )
      if (result.skippedTables.length > 0) {
        console.log(`⏭️  Skipped tables: ${result.skippedTables.join(', ')}`)
      }
      if (result.errors.length > 0) {
        console.log(`⚠️  Import reported ${result.errors.length} table errors`)
        result.errors.slice(0, 5).forEach((err) => console.log(`   - ${err.table}: ${err.error}`))
      }
    } catch (error) {
      console.error('❌ Failed to import production export:', (error as Error).message)
      throw error
    }
  }
}
