import db from '@adonisjs/lucid/services/db'
import dbConfig from '#config/database'

/**
 * Import strategy for handling existing data
 */
export type ImportStrategy = 'replace' | 'merge' | 'skip'

/**
 * Import options
 */
export interface ImportOptions {
  /**
   * How to handle existing data
   * - 'replace': Drop all tables and recreate (destructive)
   * - 'merge': Insert new records, skip conflicts
   * - 'skip': Only import if table is empty
   */
  strategy?: ImportStrategy

  /**
   * Specific tables to import (if undefined, imports all)
   */
  tables?: string[]

  /**
   * Whether to disable foreign key checks during import
   * (Required for proper import order)
   */
  disableForeignKeyChecks?: boolean
}

/**
 * Import result
 */
export interface ImportResult {
  success: boolean
  tablesImported: number
  rowsImported: number
  errors: Array<{ table: string; error: string }>
  skippedTables: string[]
}

/**
 * Database Import Service
 * Handles importing database from JSON export format
 */
class DatabaseImportService {
  /**
   * Validate export data structure
   */
  validateExportData(data: any): { valid: boolean; error?: string } {
    if (!data || typeof data !== 'object') {
      return { valid: false, error: 'Invalid export data: not an object' }
    }

    if (!data.metadata || !data.tables) {
      return { valid: false, error: 'Invalid export data: missing metadata or tables' }
    }

    if (!data.metadata.version) {
      return { valid: false, error: 'Invalid export data: missing version' }
    }

    // Check version compatibility (currently accepting 1.x.x)
    const version = data.metadata.version
    if (!version.startsWith('1.')) {
      return {
        valid: false,
        error: `Incompatible export version: ${version} (expected 1.x.x)`,
      }
    }

    return { valid: true }
  }

  /**
   * Import database from JSON export
   */
  async importDatabase(
    exportData: any,
    options: ImportOptions = {}
  ): Promise<ImportResult> {
    const { strategy = 'merge', tables: tablesToImport, disableForeignKeyChecks = true } = options

    // Validate export data
    const validation = this.validateExportData(exportData)
    if (!validation.valid) {
      throw new Error(validation.error)
    }

    const result: ImportResult = {
      success: true,
      tablesImported: 0,
      rowsImported: 0,
      errors: [],
      skippedTables: [],
    }

    const tables = Object.keys(exportData.tables)
    const tablesToProcess = tablesToImport
      ? tables.filter((t) => tablesToImport.includes(t))
      : tables

    // Order tables by dependency (users first, then posts, etc.)
    const orderedTables = this.orderTablesByDependency(tablesToProcess)

    // Use transaction for atomicity
    const trx = await db.transaction()

    try {
      // Disable foreign key checks if requested
      if (disableForeignKeyChecks) {
        await this.disableForeignKeyChecks(trx)
      }

      for (const tableName of orderedTables) {
        try {
          const rows = exportData.tables[tableName]

          if (!rows || rows.length === 0) {
            console.log(`⊘ Skipped ${tableName}: no data`)
            result.skippedTables.push(tableName)
            continue
          }

          // Check if table exists
          const tableExists = await this.tableExists(trx, tableName)
          if (!tableExists) {
            console.warn(`⚠️  Table ${tableName} does not exist in target database`)
            result.skippedTables.push(tableName)
            continue
          }

          // Handle based on strategy
          if (strategy === 'replace') {
            await trx.from(tableName).delete()
            console.log(`🗑️  Cleared ${tableName}`)
          } else if (strategy === 'skip') {
            const count = await trx.from(tableName).count('* as count').first()
            if (Number(count?.count || 0) > 0) {
              console.log(`⊘ Skipped ${tableName}: table not empty`)
              result.skippedTables.push(tableName)
              continue
            }
          }

          // Import rows
          let importedCount = 0
          for (const row of rows) {
            try {
              if (strategy === 'merge') {
                // Use insert ignore or on conflict do nothing
                await this.insertOrIgnore(trx, tableName, row)
              } else {
                await trx.table(tableName).insert(row)
              }
              importedCount++
            } catch (error) {
              // Continue on individual row errors in merge mode
              if (strategy === 'merge') {
                continue
              } else {
                throw error
              }
            }
          }

          result.tablesImported++
          result.rowsImported += importedCount
          console.log(`✓ Imported ${tableName}: ${importedCount}/${rows.length} rows`)
        } catch (error) {
          const errorMsg = (error as Error).message
          console.error(`✗ Failed to import ${tableName}:`, errorMsg)
          result.errors.push({ table: tableName, error: errorMsg })

          // Continue with other tables in merge mode
          if (strategy !== 'merge') {
            throw error
          }
        }
      }

      // Re-enable foreign key checks
      if (disableForeignKeyChecks) {
        await this.enableForeignKeyChecks(trx)
      }

      await trx.commit()
      console.log(`\n✅ Import complete: ${result.tablesImported} tables, ${result.rowsImported} rows`)
    } catch (error) {
      await trx.rollback()
      result.success = false
      console.error('❌ Import failed:', error)
      throw error
    }

    return result
  }

  /**
   * Order tables by dependency to avoid foreign key issues
   */
  private orderTablesByDependency(tables: string[]): string[] {
    // Define dependency order (tables with no dependencies first)
    const order = [
      'users',
      'user_profiles',
      'post_types',
      'menu_definitions',
      'form_definitions',
      'media_assets',
      'global_modules',
      'posts',
      'post_translations',
      'post_modules',
      'module_instances',
      'post_revisions',
      'menu_items',
      'form_submissions',
      'webhooks',
      'activity_logs',
    ]

    const ordered: string[] = []
    const remaining = [...tables]

    // Add tables in defined order
    for (const table of order) {
      const index = remaining.indexOf(table)
      if (index !== -1) {
        ordered.push(table)
        remaining.splice(index, 1)
      }
    }

    // Add remaining tables at the end
    ordered.push(...remaining)

    return ordered
  }

  /**
   * Check if a table exists
   */
  private async tableExists(trx: any, tableName: string): Promise<boolean> {
    const dialectName = dbConfig.connections[dbConfig.connection].client

    try {
      if (dialectName === 'postgres' || dialectName === 'pg') {
        const result = await trx.rawQuery(
          `SELECT EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = ?)`,
          [tableName]
        )
        return result.rows[0].exists
      } else if (dialectName === 'mysql' || dialectName === 'mysql2') {
        const result = await trx.rawQuery(`SHOW TABLES LIKE ?`, [tableName])
        return result[0].length > 0
      } else if (dialectName === 'sqlite' || dialectName === 'better-sqlite3') {
        const result = await trx.rawQuery(
          `SELECT name FROM sqlite_master WHERE type='table' AND name=?`,
          [tableName]
        )
        return result.length > 0
      }
    } catch {
      return false
    }

    return false
  }

  /**
   * Insert row or ignore conflicts
   */
  private async insertOrIgnore(trx: any, tableName: string, row: any): Promise<void> {
    const dialectName = dbConfig.connections[dbConfig.connection].client

    try {
      if (dialectName === 'postgres' || dialectName === 'pg') {
        await trx.raw(`INSERT INTO ?? (${Object.keys(row).join(',')}) VALUES (${Object.keys(row).map(() => '?').join(',')}) ON CONFLICT DO NOTHING`, [
          tableName,
          ...Object.values(row),
        ])
      } else if (dialectName === 'mysql' || dialectName === 'mysql2') {
        await trx.raw(`INSERT IGNORE INTO ?? (${Object.keys(row).join(',')}) VALUES (${Object.keys(row).map(() => '?').join(',')})`, [
          tableName,
          ...Object.values(row),
        ])
      } else {
        // SQLite and others - try insert, ignore on error
        try {
          await trx.table(tableName).insert(row)
        } catch {
          // Ignore constraint errors
        }
      }
    } catch (error) {
      // Ignore constraint violations in merge mode
      if ((error as any).code !== '23505' && (error as any).errno !== 1062) {
        throw error
      }
    }
  }

  /**
   * Disable foreign key checks (database-specific)
   */
  private async disableForeignKeyChecks(trx: any): Promise<void> {
    const dialectName = dbConfig.connections[dbConfig.connection].client

    try {
      if (dialectName === 'postgres' || dialectName === 'pg') {
        await trx.raw('SET session_replication_role = replica')
      } else if (dialectName === 'mysql' || dialectName === 'mysql2') {
        await trx.raw('SET FOREIGN_KEY_CHECKS=0')
      } else if (dialectName === 'sqlite' || dialectName === 'better-sqlite3') {
        await trx.raw('PRAGMA foreign_keys = OFF')
      }
    } catch (error) {
      console.warn('Failed to disable foreign key checks:', error)
    }
  }

  /**
   * Enable foreign key checks (database-specific)
   */
  private async enableForeignKeyChecks(trx: any): Promise<void> {
    const dialectName = dbConfig.connections[dbConfig.connection].client

    try {
      if (dialectName === 'postgres' || dialectName === 'pg') {
        await trx.raw('SET session_replication_role = DEFAULT')
      } else if (dialectName === 'mysql' || dialectName === 'mysql2') {
        await trx.raw('SET FOREIGN_KEY_CHECKS=1')
      } else if (dialectName === 'sqlite' || dialectName === 'better-sqlite3') {
        await trx.raw('PRAGMA foreign_keys = ON')
      }
    } catch (error) {
      console.warn('Failed to enable foreign key checks:', error)
    }
  }

  /**
   * Import from JSON string
   */
  async importFromJson(jsonString: string, options: ImportOptions = {}): Promise<ImportResult> {
    const data = JSON.parse(jsonString)
    return this.importDatabase(data, options)
  }

  /**
   * Import from Buffer
   */
  async importFromBuffer(buffer: Buffer, options: ImportOptions = {}): Promise<ImportResult> {
    const jsonString = buffer.toString('utf-8')
    return this.importFromJson(jsonString, options)
  }
}

const databaseImportService = new DatabaseImportService()
export default databaseImportService

