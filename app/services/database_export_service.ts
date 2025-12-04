import db from '@adonisjs/lucid/services/db'
import { DateTime } from 'luxon'
import dbConfig from '#config/database'

/**
 * Export format version for compatibility checking
 */
const EXPORT_FORMAT_VERSION = '1.0.0'

/**
 * Tables to exclude from export (session data, temporary data, etc.)
 */
const EXCLUDED_TABLES = [
  'adonis_schema',
  'adonis_schema_versions',
  // Add other temporary tables as needed
]

/**
 * Database Export Service
 * Handles exporting the entire database to a portable JSON format
 */
class DatabaseExportService {
  /**
   * Export the entire database to a JSON structure
   * @returns Promise<object> Export data with metadata and table data
   */
  async exportDatabase(): Promise<{
    metadata: {
      version: string
      exportedAt: string
      databaseType: string
      tableCount: number
    }
    tables: Record<string, any[]>
  }> {
    const tables = await this.getExportableTables()
    const tableData: Record<string, any[]> = {}

    // Export each table
    for (const tableName of tables) {
      try {
        const rows = await db.from(tableName).select('*')
        tableData[tableName] = rows
        // Exported table
      } catch (error) {
        // Failed to export table
        throw new Error(`Failed to export table ${tableName}: ${(error as Error).message}`)
      }
    }

    return {
      metadata: {
        version: EXPORT_FORMAT_VERSION,
        exportedAt: DateTime.now().toISO(),
        databaseType: dbConfig.connections[dbConfig.connection].client,
        tableCount: tables.length,
      },
      tables: tableData,
    }
  }

  /**
   * Get list of tables to export (excluding system tables)
   */
  private async getExportableTables(): Promise<string[]> {
    // Get the database client type from the config
    const connectionName = dbConfig.connection
    const dialectName = dbConfig.connections[connectionName].client

    let tables: string[] = []

    if (dialectName === 'postgres' || dialectName === 'pg') {
      // PostgreSQL
      const result = await db.rawQuery(
        `SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename`
      )
      tables = result.rows.map((row: any) => row.tablename)
    } else if (dialectName === 'mysql' || dialectName === 'mysql2') {
      // MySQL
      const result = await db.rawQuery(`SHOW TABLES`)
      const key = Object.keys(result[0][0])[0]
      tables = result[0].map((row: any) => row[key])
    } else if (dialectName === 'sqlite' || dialectName === 'better-sqlite3') {
      // SQLite
      const result = await db.rawQuery(
        `SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name`
      )
      tables = result.map((row: any) => row.name)
    } else {
      throw new Error(`Unsupported database dialect: ${dialectName}`)
    }

    // Filter out excluded tables
    return tables.filter((table) => !EXCLUDED_TABLES.includes(table))
  }

  /**
   * Export database and return as JSON string
   */
  async exportToJson(): Promise<string> {
    const data = await this.exportDatabase()
    return JSON.stringify(data, null, 2)
  }

  /**
   * Export database and return as Buffer (for file downloads)
   */
  async exportToBuffer(): Promise<Buffer> {
    const json = await this.exportToJson()
    return Buffer.from(json, 'utf-8')
  }

  /**
   * Get export filename with timestamp
   */
  getExportFilename(): string {
    const timestamp = DateTime.now().toFormat('yyyy-MM-dd_HHmmss')
    return `adonis-eos-export_${timestamp}.json`
  }

  /**
   * Get export statistics without performing full export
   */
  async getExportStats(): Promise<{
    tables: Array<{ name: string; rowCount: number }>
    totalRows: number
    estimatedSize: string
  }> {
    const tables = await this.getExportableTables()
    const stats: Array<{ name: string; rowCount: number }> = []
    let totalRows = 0

    for (const tableName of tables) {
      try {
        const result = await db.from(tableName).count('* as count').first()
        const rowCount = Number(result?.count || 0)
        stats.push({ name: tableName, rowCount })
        totalRows += rowCount
      } catch (error) {
        // Failed to count rows
        stats.push({ name: tableName, rowCount: 0 })
      }
    }

    // Rough estimate: ~500 bytes per row on average
    const estimatedBytes = totalRows * 500
    const estimatedSize =
      estimatedBytes < 1024 * 1024
        ? `${(estimatedBytes / 1024).toFixed(1)} KB`
        : `${(estimatedBytes / (1024 * 1024)).toFixed(1)} MB`

    return {
      tables: stats,
      totalRows,
      estimatedSize,
    }
  }
}

const databaseExportService = new DatabaseExportService()
export default databaseExportService
