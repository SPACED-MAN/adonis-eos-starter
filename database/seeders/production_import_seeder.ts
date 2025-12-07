import { BaseSeeder } from '@adonisjs/lucid/seeders'
import { readFile } from 'node:fs/promises'
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
		const filePath = join(process.cwd(), 'database', 'seed_data', 'production-export.json')
		console.log('📥 Production import seeder starting. File:', filePath)

		// Safety: require empty key tables to avoid clobbering live data.
		const keyTables = ['users', 'posts', 'menus', 'module_instances', 'forms']
		for (const table of keyTables) {
			const row = await db.from(table).count('* as total').first()
			const count = Number((row as any)?.total || 0)
			if (count > 0) {
				console.log(
					`⏭️  Aborting production import: table "${table}" is not empty (count=${count}).`
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
				result.errors.slice(0, 5).forEach((err) =>
					console.log(`   - ${err.table}: ${err.error}`)
				)
			}
		} catch (error) {
			console.error('❌ Failed to import production export:', (error as Error).message)
			throw error
		}
	}
}

