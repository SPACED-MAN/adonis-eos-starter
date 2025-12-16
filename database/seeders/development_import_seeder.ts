import { BaseSeeder } from '@adonisjs/lucid/seeders'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import databaseImportService from '#services/database_import_service'

/**
 * Development Import Seeder
 *
 * Imports the development export JSON (full DB export) using the same
 * DatabaseImportService that powers the admin import UI. This lets us reseed
 * development by dropping table contents and reloading from the export file.
 */
export default class DevelopmentImportSeeder extends BaseSeeder {
  public static environment = ['development']

  public async run() {
    const filePath = join(process.cwd(), 'database', 'seed_data', 'development-export.json')
    console.log('📥 Importing development export from file:', filePath)

    try {
      const buffer = await readFile(filePath)

      const result = await databaseImportService.importFromBuffer(buffer, {
        strategy: 'replace', // clear tables then insert exported rows
        preserveIds: true,
        disableForeignKeyChecks: true,
      })

      console.log(
        `✅ Development import completed: ${result.tablesImported} tables, ${result.rowsImported} rows`
      )
      if (result.skippedTables.length > 0) {
        console.log(`⏭️  Skipped tables: ${result.skippedTables.join(', ')}`)
      }
      if (result.errors.length > 0) {
        console.log(`⚠️  Import reported ${result.errors.length} table errors`)
        result.errors.slice(0, 5).forEach((err) => console.log(`   - ${err.table}: ${err.error}`))
      }
    } catch (error) {
      console.error('❌ Failed to import development export:', (error as Error).message)
      throw error
    }
  }
}
